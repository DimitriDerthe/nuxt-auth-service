import type { ComputedRef } from 'vue'

// TOTP/2FA Types
export interface TOTPSecret {
  secret: string
  qrCode?: string
  backupCodes?: string[]
  uri?: string
}

export interface RecoveryCode {
  id: string
  code: string
  used: boolean
  usedAt?: Date
}

export interface TOTPComposable {
  /**
   * Whether 2FA is enabled for current user
   */
  isEnabled: ComputedRef<boolean>
  /**
   * Whether 2FA setup is in progress
   */
  isSetupInProgress: ComputedRef<boolean>
  /**
   * Generate new TOTP secret and QR code
   */
  setup: () => Promise<TOTPSecret>
  /**
   * Verify TOTP code and enable 2FA
   */
  enable: (code: string) => Promise<{ success: boolean, backupCodes?: string[] }>
  /**
   * Disable 2FA
   */
  disable: (password: string) => Promise<boolean>
  /**
   * Verify TOTP code
   */
  verify: (code: string) => Promise<boolean>
  /**
   * Verify backup/recovery code
   */
  verifyRecoveryCode: (code: string) => Promise<boolean>
  /**
   * Generate new backup codes
   */
  generateBackupCodes: (password: string) => Promise<string[]>
  /**
   * Get unused backup codes count
   */
  getBackupCodesCount: () => Promise<number>
}

// Server-side TOTP verification
export interface TOTPVerification {
  isValid: boolean
  isBackupCode?: boolean
  remainingBackupCodes?: number
}

// TOTP configuration
export interface TOTPConfig {
  /**
   * Application name for TOTP apps
   */
  issuer: string
  /**
   * Key length (default: 32)
   */
  keyLength?: number
  /**
   * Time window in seconds (default: 30)
   */
  window?: number
  /**
   * Number of backup codes to generate (default: 10)
   */
  backupCodesCount?: number
  /**
   * Backup code length (default: 8)
   */
  backupCodeLength?: number
}
