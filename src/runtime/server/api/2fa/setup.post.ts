import { requireUserSession } from '../../utils/session'
import { generateTOTPSecret } from '../../utils/totp'
import { logAuthEvent } from '../../utils/audit'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)

  if (!session.user?.email) {
    throw createError({
      statusCode: 400,
      statusMessage: 'User email is required for 2FA setup',
    })
  }

  try {
    const totpData = await generateTOTPSecret(session.user.id!, session.user.email)

    await logAuthEvent(event, '2fa_setup_initiated', {
      userId: session.user.id,
    })

    return {
      secret: totpData.secret,
      qrCode: totpData.qrCode,
      backupCodes: totpData.backupCodes,
      uri: totpData.uri,
    }
  }
  catch (error) {
    console.error('2FA setup error:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to setup 2FA',
    })
  }
})
