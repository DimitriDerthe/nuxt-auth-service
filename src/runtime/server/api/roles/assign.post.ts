import { readBody } from 'h3'
import { requirePermission, assignRole } from '../../utils/rbac'
import { getCurrentTenantId } from '../../utils/tenant'
import { getUserSession } from '../../utils/session'
import { authRateLimiters } from '../../utils/rate-limit'
import { validationSchemas, withValidation } from '../../utils/validation'
import { secureErrors, withSecureErrorHandling } from '../../utils/secure-error'
import { logAuthEvent } from '../../utils/audit'

export default defineEventHandler(withSecureErrorHandling(async (event) => {
  // Apply rate limiting
  await authRateLimiters.api(event)

  // Require permission to manage roles
  await requirePermission(event, 'roles.manage')

  const body = await readBody(event)

  // Validate input
  const validatedData = withValidation(validationSchemas.roleAssign)(body)
  const { userId, roleSlug } = validatedData

  const organizationId = getCurrentTenantId(event)
  const session = await getUserSession(event)
  const assignedBy = session.user?.id

  try {
    const success = await assignRole(userId, roleSlug, organizationId, assignedBy)

    if (!success) {
      // Log failed role assignment
      await logAuthEvent(event, 'password_change', 'failure', {
        targetUserId: userId,
        roleSlug,
        organizationId,
        assignedBy,
        reason: 'assignment_failed',
      })

      throw secureErrors.databaseError()
    }

    // Log successful role assignment
    await logAuthEvent(event, 'password_change', 'success', {
      targetUserId: userId,
      roleSlug,
      organizationId,
      assignedBy,
    })

    return {
      success: true,
      message: 'Role assigned successfully',
    }
  }
  catch (error) {
    if (!(error instanceof Error && 'statusCode' in error)) {
      await logAuthEvent(event, 'password_change', 'error', {
        targetUserId: userId,
        roleSlug,
        error: 'unexpected_error',
      })
    }
    throw error
  }
}, 'role-assignment'))
