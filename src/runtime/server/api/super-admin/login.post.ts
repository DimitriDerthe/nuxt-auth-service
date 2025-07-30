import { readBody } from 'h3'
import { verifySuperAdmin } from '../../utils/super-admin'
import { setUserSession } from '../../utils/session'
import { authRateLimiters, clearRateLimit } from '../../utils/rate-limit'
import { validationSchemas, withValidation } from '../../utils/validation'
import { secureErrors, withSecureErrorHandling } from '../../utils/secure-error'
import { logAuthEvent } from '../../utils/audit'
import { secureDelay } from '../../utils/secure-compare'

export default defineEventHandler(withSecureErrorHandling(async (event) => {
  // Apply rate limiting
  await authRateLimiters.superAdminLogin(event)

  const body = await readBody(event)

  // Validate and sanitize input
  const validatedData = withValidation(validationSchemas.superAdminLogin)(body)
  const { email, password } = validatedData

  try {
    const superAdmin = await verifySuperAdmin(email, password)

    if (!superAdmin) {
      // Log failed attempt
      await logAuthEvent(event, 'super_admin_login', 'failure', {
        email: email.split('@')[0] + '@***', // Partially hide email in logs
        reason: 'invalid_credentials',
      })

      // Add security delay for failed attempts
      await secureDelay(150, 50)

      throw secureErrors.invalidCredentials()
    }

    // Clear rate limit on successful authentication
    clearRateLimit(event, 'super-admin')

    // Set session for super admin
    await setUserSession(event, {
      user: {
        id: superAdmin.id,
        email: superAdmin.email,
        firstName: superAdmin.firstName,
        lastName: superAdmin.lastName,
        isSuperAdmin: true,
      },
      loggedInAt: new Date(),
    })

    // Log successful super admin login
    await logAuthEvent(event, 'super_admin_login', 'success', {
      userId: superAdmin.id,
      email: email.split('@')[0] + '@***',
    })

    return {
      success: true,
      user: {
        id: superAdmin.id,
        email: superAdmin.email,
        firstName: superAdmin.firstName,
        lastName: superAdmin.lastName,
        isSuperAdmin: true,
      },
    }
  }
  catch (error) {
    // Log error if it's not already a secure error
    if (!(error instanceof Error && 'statusCode' in error)) {
      await logAuthEvent(event, 'super_admin_login', 'error', {
        email: email.split('@')[0] + '@***',
        error: 'unexpected_error',
      })
    }
    throw error
  }
}, 'super-admin-login'))
