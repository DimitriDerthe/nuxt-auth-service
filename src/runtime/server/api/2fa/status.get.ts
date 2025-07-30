import { requireUserSession } from '../../utils/session'
import { is2FAEnabled, getBackupCodesCount } from '../../utils/totp'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)

  try {
    const enabled = await is2FAEnabled(session.user.id!)
    const backupCodesCount = enabled ? await getBackupCodesCount(session.user.id!) : 0

    return {
      enabled,
      backupCodesCount,
    }
  }
  catch (error) {
    console.error('Error getting 2FA status:', error)
    return {
      enabled: false,
      backupCodesCount: 0,
    }
  }
})
