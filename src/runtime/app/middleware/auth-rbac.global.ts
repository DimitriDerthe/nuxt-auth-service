import type { RouteLocationNormalized } from 'vue-router'
import type { PageMetaAuth } from '#auth-utils'

export default defineNuxtRouteMiddleware(async (to: RouteLocationNormalized) => {
  // Skip on server-side or if no auth meta
  if (import.meta.server) return

  const authMeta = to.meta.auth as PageMetaAuth | boolean | undefined

  if (!authMeta) return

  const { loggedIn, user } = useUserSession()
  const { hasRole, hasPermission, hasAnyPermission, hasAllPermissions } = usePermissions()

  // Simple auth requirement
  if (authMeta === true) {
    if (!loggedIn.value) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Authentication required',
      })
    }
    return
  }

  // Advanced auth configuration
  if (typeof authMeta === 'object') {
    // Check authentication requirement
    if (authMeta.auth !== false && !loggedIn.value) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Authentication required',
      })
    }

    // Skip further checks if not authenticated
    if (!loggedIn.value) return

    // Check roles
    if (authMeta.roles && authMeta.roles.length > 0) {
      const hasRequiredRole = authMeta.roles.some(role => hasRole(role))
      if (!hasRequiredRole) {
        throw createError({
          statusCode: 403,
          statusMessage: 'Insufficient role privileges',
        })
      }
    }

    // Check permissions
    if (authMeta.permissions && authMeta.permissions.length > 0) {
      const hasRequiredPermission = authMeta.requireAllPermissions
        ? hasAllPermissions(authMeta.permissions)
        : hasAnyPermission(authMeta.permissions)

      if (!hasRequiredPermission) {
        throw createError({
          statusCode: 403,
          statusMessage: 'Insufficient permissions',
        })
      }
    }

    // Custom permission check
    if (authMeta.permissionCheck && user.value) {
      const { roles, permissions } = await usePermissions()
      const hasCustomPermission = authMeta.permissionCheck(
        user.value,
        roles.value,
        permissions.value,
      )

      if (!hasCustomPermission) {
        throw createError({
          statusCode: 403,
          statusMessage: 'Access denied',
        })
      }
    }
  }
})
