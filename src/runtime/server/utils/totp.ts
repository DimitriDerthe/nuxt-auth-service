import { randomUUID, randomBytes } from 'uncrypto'
import { TOTP, Secret } from 'otpauth'
import QRCode from 'qrcode'
import { createError } from 'h3'
import { schema, eq, and, sql } from '../database/connection'
import { useDatabase, isDatabaseFeatureEnabled } from './database'
import { useRuntimeConfig } from '#imports'
import type { TOTPSecret, TOTPVerification, TOTPConfig } from '#auth-utils'

// Re-export sql from drizzle for use in this file

/**
 * Generate a new TOTP secret for user
 */
export async function generateTOTPSecret(userId: string, email: string): Promise<TOTPSecret> {
  const config = useRuntimeConfig()
  const totpConfig = config.totp?.config || getDefaultTOTPConfig()

  // Generate secret
  const secret = new Secret({
    size: totpConfig.keyLength || 32,
  })

  // Create TOTP instance
  const totp = new TOTP({
    issuer: totpConfig.issuer,
    label: email,
    algorithm: 'SHA1',
    digits: 6,
    period: totpConfig.window || 30,
    secret: secret,
  })

  // Generate QR code
  const uri = totp.toString()
  const qrCode = await QRCode.toDataURL(uri)

  // Generate backup codes
  const backupCodes = generateBackupCodes(totpConfig.backupCodesCount || 10, totpConfig.backupCodeLength || 8)

  return {
    secret: secret.base32,
    qrCode,
    uri,
    backupCodes,
  }
}

/**
 * Verify TOTP code
 */
export async function verifyTOTPCode(secret: string, token: string, window: number = 1): Promise<boolean> {
  try {
    const totp = new TOTP({
      secret: Secret.fromBase32(secret),
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
    })

    // Verify with time window tolerance
    const delta = totp.validate({ token, window })
    return delta !== null
  }
  catch (error) {
    console.error('TOTP verification error:', error)
    return false
  }
}

/**
 * Enable 2FA for user
 */
export async function enable2FA(userId: string, secret: string, token: string, backupCodes: string[]): Promise<boolean> {
  if (!isDatabaseFeatureEnabled()) {
    throw createError({
      statusCode: 500,
      statusMessage: '2FA requires database configuration',
    })
  }

  // Verify the token first
  const isValidToken = await verifyTOTPCode(secret, token)
  if (!isValidToken) {
    return false
  }

  const db = useDatabase()

  try {
    await db.transaction(async (tx) => {
      // Update user with 2FA enabled and secret
      await tx.update(schema.users)
        .set({
          twoFactorEnabled: true,
          twoFactorSecret: secret,
          updatedAt: new Date(),
        })
        .where(eq(schema.users.id, userId))

      // Clear existing recovery codes
      await tx.delete(schema.recoveryCodes)
        .where(eq(schema.recoveryCodes.userId, userId))

      // Insert new recovery codes
      for (const code of backupCodes) {
        await tx.insert(schema.recoveryCodes).values({
          id: randomUUID(),
          userId,
          code,
          used: false,
          createdAt: new Date(),
        })
      }
    })

    return true
  }
  catch (error) {
    console.error('Error enabling 2FA:', error)
    return false
  }
}

/**
 * Disable 2FA for user
 */
export async function disable2FA(userId: string): Promise<boolean> {
  if (!isDatabaseFeatureEnabled()) {
    return false
  }

  const db = useDatabase()

  try {
    await db.transaction(async (tx) => {
      // Update user with 2FA disabled
      await tx.update(schema.users)
        .set({
          twoFactorEnabled: false,
          twoFactorSecret: null,
          updatedAt: new Date(),
        })
        .where(eq(schema.users.id, userId))

      // Remove all recovery codes
      await tx.delete(schema.recoveryCodes)
        .where(eq(schema.recoveryCodes.userId, userId))
    })

    return true
  }
  catch (error) {
    console.error('Error disabling 2FA:', error)
    return false
  }
}

/**
 * Verify 2FA (TOTP or backup code)
 */
export async function verify2FA(userId: string, code: string): Promise<TOTPVerification> {
  if (!isDatabaseFeatureEnabled()) {
    return { isValid: false }
  }

  const db = useDatabase()

  try {
    // Get user's 2FA data
    const user = await db.select()
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1)

    if (user.length === 0 || !user[0].twoFactorEnabled || !user[0].twoFactorSecret) {
      return { isValid: false }
    }

    const userData = user[0]

    // Try TOTP verification first
    const isTOTPValid = await verifyTOTPCode(userData.twoFactorSecret, code)
    if (isTOTPValid) {
      return { isValid: true }
    }

    // Try backup code verification
    const backupCode = await db.select()
      .from(schema.recoveryCodes)
      .where(
        and(
          eq(schema.recoveryCodes.userId, userId),
          eq(schema.recoveryCodes.code, code),
          eq(schema.recoveryCodes.used, false),
        ),
      )
      .limit(1)

    if (backupCode.length === 0) {
      return { isValid: false }
    }

    // Mark backup code as used
    await db.update(schema.recoveryCodes)
      .set({
        used: true,
        usedAt: new Date(),
      })
      .where(eq(schema.recoveryCodes.id, backupCode[0].id))

    // Get remaining backup codes count
    const remainingCodes = await db.select({ count: sql`count(*)` })
      .from(schema.recoveryCodes)
      .where(
        and(
          eq(schema.recoveryCodes.userId, userId),
          eq(schema.recoveryCodes.used, false),
        ),
      )

    return {
      isValid: true,
      isBackupCode: true,
      remainingBackupCodes: Number(remainingCodes[0]?.count || 0),
    }
  }
  catch (error) {
    console.error('Error verifying 2FA:', error)
    return { isValid: false }
  }
}

/**
 * Generate new backup codes for user
 */
export async function generateNewBackupCodes(userId: string, count: number = 10, length: number = 8): Promise<string[]> {
  if (!isDatabaseFeatureEnabled()) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Backup codes require database configuration',
    })
  }

  const db = useDatabase()
  const backupCodes = generateBackupCodes(count, length)

  try {
    await db.transaction(async (tx) => {
      // Clear existing unused recovery codes
      await tx.delete(schema.recoveryCodes)
        .where(
          and(
            eq(schema.recoveryCodes.userId, userId),
            eq(schema.recoveryCodes.used, false),
          ),
        )

      // Insert new recovery codes
      for (const code of backupCodes) {
        await tx.insert(schema.recoveryCodes).values({
          id: randomUUID(),
          userId,
          code,
          used: false,
          createdAt: new Date(),
        })
      }
    })

    return backupCodes
  }
  catch (error) {
    console.error('Error generating backup codes:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to generate backup codes',
    })
  }
}

/**
 * Get remaining backup codes count
 */
export async function getBackupCodesCount(userId: string): Promise<number> {
  if (!isDatabaseFeatureEnabled()) {
    return 0
  }

  const db = useDatabase()

  try {
    const result = await db.select({ count: sql`count(*)` })
      .from(schema.recoveryCodes)
      .where(
        and(
          eq(schema.recoveryCodes.userId, userId),
          eq(schema.recoveryCodes.used, false),
        ),
      )

    return Number(result[0]?.count || 0)
  }
  catch (error) {
    console.error('Error getting backup codes count:', error)
    return 0
  }
}

/**
 * Check if user has 2FA enabled
 */
export async function is2FAEnabled(userId: string): Promise<boolean> {
  if (!isDatabaseFeatureEnabled()) {
    return false
  }

  const db = useDatabase()

  try {
    const user = await db.select({ twoFactorEnabled: schema.users.twoFactorEnabled })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1)

    return user[0]?.twoFactorEnabled || false
  }
  catch (error) {
    console.error('Error checking 2FA status:', error)
    return false
  }
}

/**
 * Helper: Generate backup codes
 */
function generateBackupCodes(count: number, length: number): string[] {
  const codes: string[] = []
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'

  for (let i = 0; i < count; i++) {
    let code = ''
    const bytes = randomBytes(length)

    for (let j = 0; j < length; j++) {
      code += chars[bytes[j] % chars.length]
    }

    codes.push(code)
  }

  return codes
}

/**
 * Get default TOTP configuration
 */
function getDefaultTOTPConfig(): TOTPConfig {
  return {
    issuer: 'My App',
    keyLength: 32,
    window: 30,
    backupCodesCount: 10,
    backupCodeLength: 8,
  }
}
