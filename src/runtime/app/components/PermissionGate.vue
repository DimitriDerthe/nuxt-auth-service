<script lang="ts" setup>
import type { PermissionCheck } from '#auth-utils'

interface Props {
  /**
   * Required roles (user must have at least one)
   */
  roles?: string[]
  /**
   * Required permissions (user must have at least one)
   */
  permissions?: (string | PermissionCheck)[]
  /**
   * Require all permissions instead of any
   */
  requireAll?: boolean
  /**
   * Show fallback content when access is denied
   */
  showFallback?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  roles: () => [],
  permissions: () => [],
  requireAll: false,
  showFallback: false,
})

const { hasRole, hasPermission, hasAnyPermission, hasAllPermissions } = usePermissions()

const hasAccess = computed(() => {
  // Check roles
  if (props.roles.length > 0) {
    const hasRequiredRole = props.roles.some(role => hasRole(role))
    if (!hasRequiredRole) return false
  }

  // Check permissions
  if (props.permissions.length > 0) {
    const hasRequiredPermission = props.requireAll
      ? hasAllPermissions(props.permissions)
      : hasAnyPermission(props.permissions)

    if (!hasRequiredPermission) return false
  }

  return true
})
</script>

<template>
  <div v-if="hasAccess">
    <slot />
  </div>
  <div v-else-if="showFallback">
    <slot name="fallback">
      <div class="text-gray-500 text-sm">
        Access denied
      </div>
    </slot>
  </div>
</template>
