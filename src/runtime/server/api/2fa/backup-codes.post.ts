import { readBody } from 'h3'
import { requireUserSession } from '../../utils/session'
import { generateNewBackupCodes } from '../../utils/totp'
import { verifyPassword } from '../../utils/password'
import { logAuthEvent } from '../../utils/audit'
import { useDatabase } from '../../utils/database'
import { schema, eq } from '../../database/connection'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const { password } = await readBody(event)

  if (!password) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Password is required to generate new backup codes',
    })
  }

  try {
    // Verify password first
    const db = useDatabase()
    const user = await db.select()
      .from(schema.users)
      .where(eq(schema.users.id, session.user.id!))
      .limit(1)

    if (user.length === 0 || !user[0].password) {
      throw createError({
        statusCode: 400,
        statusMessage: 'User not found or password not set',
      })
    }

    const isValidPassword = await verifyPassword(user[0].password, password)
    if (!isValidPassword) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid password',
      })
    }

    // Check if 2FA is enabled
    if (!user[0].twoFactorEnabled) {
      throw createError({
        statusCode: 400,
        statusMessage: '2FA is not enabled',
      })
    }

    // Generate new backup codes
    const newBackupCodes = await generateNewBackupCodes(session.user.id!)

    await logAuthEvent(event, 'backup_codes_regenerated', {
      userId: session.user.id,
    })

    return {
      backupCodes: newBackupCodes,
    }
  }
  catch (error) {
    if (error.statusCode) {
      throw error
    }

    console.error('Backup codes generation error:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to generate backup codes',
    })
  }
})
