import { readBody } from 'h3'
import { requireUserSession } from '../../utils/session'
import { verify2FA } from '../../utils/totp'
import { authRateLimiters } from '../../utils/rate-limit'
import { validationSchemas, withValidation } from '../../utils/validation'
import { secureErrors, withSecureErrorHandling } from '../../utils/secure-error'
import { logAuthEvent } from '../../utils/audit'
import { secureDelay } from '../../utils/secure-compare'

export default defineEventHandler(withSecureErrorHandling(async (event) => {
  // Apply rate limiting for 2FA attempts
  await authRateLimiters.twoFactorVerification(event)

  const session = await requireUserSession(event)
  const body = await readBody(event)

  // Validate input
  const validatedData = withValidation(validationSchemas.twoFactorVerify)(body)
  const { code } = validatedData

  try {
    const verification = await verify2FA(session.user.id!, code)

    if (!verification.isValid) {
      // Log failed 2FA attempt
      await logAuthEvent(event, '2fa_enabled', 'failure', {
        userId: session.user.id,
        reason: 'invalid_code',
      })

      // Add security delay for failed attempts
      await secureDelay(100, 30)

      throw secureErrors.invalidTwoFactor()
    }

    // Log successful 2FA verification
    await logAuthEvent(event, '2fa_enabled', 'success', {
      userId: session.user.id,
      isBackupCode: verification.isBackupCode,
      remainingBackupCodes: verification.remainingBackupCodes,
    })

    return {
      isValid: verification.isValid,
      isBackupCode: verification.isBackupCode,
      remainingBackupCodes: verification.remainingBackupCodes,
    }
  }
  catch (error) {
    // Log error if it's not already a secure error
    if (!(error instanceof Error && 'statusCode' in error)) {
      await logAuthEvent(event, '2fa_enabled', 'error', {
        userId: session.user.id,
        error: 'verification_failed',
      })
    }
    throw error
  }
}, '2fa-verification'))
