import { ref, computed, type Ref } from 'vue'
import type { Role, Permission, RBACComposable, PermissionCheck } from '#auth-utils'

const roles: Ref<Role[]> = ref([])
const permissions: Ref<Permission[]> = ref([])

export function usePermissions(): RBACComposable {
  const hasRole = (roleSlug: string): boolean => {
    return roles.value.some(role => role.slug === roleSlug)
  }

  const hasPermission = (check: PermissionCheck | string): boolean => {
    if (typeof check === 'string') {
      return permissions.value.some(p => p.slug === check)
    }

    if (check.permission) {
      return permissions.value.some(p => p.slug === check.permission)
    }

    if (check.resource && check.action) {
      return permissions.value.some(p => p.resource === check.resource && p.action === check.action)
    }

    return false
  }

  const hasAnyPermission = (checks: (PermissionCheck | string)[]): boolean => {
    return checks.some(check => hasPermission(check))
  }

  const hasAllPermissions = (checks: (PermissionCheck | string)[]): boolean => {
    return checks.every(check => hasPermission(check))
  }

  const can = (action: string, resource?: string): boolean => {
    if (resource) {
      return hasPermission({ action, resource })
    }

    // Check for any permission with this action
    return permissions.value.some(p => p.action === action)
  }

  const refresh = async (): Promise<void> => {
    try {
      const response = await $fetch('/api/_auth/permissions')
      roles.value = response.roles || []
      permissions.value = response.permissions || []
    }
    catch (error) {
      console.error('Failed to refresh permissions:', error)
      roles.value = []
      permissions.value = []
    }
  }

  return {
    roles: computed(() => roles.value),
    permissions: computed(() => permissions.value),
    hasRole,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    can,
    refresh,
  }
}

// Alias for backward compatibility
export const useRBAC = usePermissions

// Initialize permissions data
if (import.meta.client) {
  const { refresh } = usePermissions()
  refresh().catch(() => {
    // Silently fail on client
  })
}
