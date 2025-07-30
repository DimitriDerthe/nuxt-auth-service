import { readBody } from 'h3'
import { requireUserSession } from '../../utils/session'
import { enable2FA } from '../../utils/totp'
import { logAuthEvent } from '../../utils/audit'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const { secret, token, backupCodes } = await readBody(event)

  if (!secret || !token || !backupCodes) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Secret, token, and backup codes are required',
    })
  }

  try {
    const success = await enable2FA(session.user.id!, secret, token, backupCodes)

    if (!success) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid verification code',
      })
    }

    await logAuthEvent(event, '2fa_enabled', {
      userId: session.user.id,
    })

    return {
      success: true,
      message: '2FA enabled successfully',
    }
  }
  catch (error) {
    if (error.statusCode) {
      throw error
    }

    console.error('2FA enable error:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to enable 2FA',
    })
  }
})
