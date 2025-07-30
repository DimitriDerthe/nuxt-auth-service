import type { ComputedRef } from 'vue'

// RBAC Types
export interface Permission {
  id: string
  name: string
  slug: string
  description?: string
  resource?: string
  action?: string
}

export interface Role {
  id: string
  organizationId?: string
  name: string
  slug: string
  description?: string
  isDefault?: boolean
  permissions?: Permission[]
}

export interface UserRole {
  userId: string
  roleId: string
  role?: Role
  assignedAt: Date
  assignedBy?: string
}

// Permission checking utilities
export interface PermissionCheck {
  resource?: string
  action?: string
  permission?: string
}

export interface RBACComposable {
  /**
   * Current user roles
   */
  roles: ComputedRef<Role[]>
  /**
   * Current user permissions (flattened from roles)
   */
  permissions: ComputedRef<Permission[]>
  /**
   * Check if user has a specific role
   */
  hasRole: (roleSlug: string) => boolean
  /**
   * Check if user has a specific permission
   */
  hasPermission: (check: PermissionCheck | string) => boolean
  /**
   * Check if user has any of the specified permissions
   */
  hasAnyPermission: (checks: (PermissionCheck | string)[]) => boolean
  /**
   * Check if user has all of the specified permissions
   */
  hasAllPermissions: (checks: (PermissionCheck | string)[]) => boolean
  /**
   * Check if user can perform action on resource
   */
  can: (action: string, resource?: string) => boolean
  /**
   * Refresh roles and permissions from server
   */
  refresh: () => Promise<void>
}

// Page meta types for route protection
export interface PageMetaAuth {
  /**
   * Require authentication
   */
  auth?: boolean
  /**
   * Required roles (user must have at least one)
   */
  roles?: string[]
  /**
   * Required permissions (user must have at least one)
   */
  permissions?: (string | PermissionCheck)[]
  /**
   * All permissions required (user must have all)
   */
  requireAllPermissions?: boolean
  /**
   * Custom permission check function
   */
  permissionCheck?: (user: any, roles: Role[], permissions: Permission[]) => boolean
}

declare module '#app/nuxt' {
  interface PageMeta {
    auth?: PageMetaAuth | boolean
  }
}

// Middleware types
export interface AuthMiddlewareOptions {
  roles?: string[]
  permissions?: (string | PermissionCheck)[]
  requireAllPermissions?: boolean
  redirectTo?: string
  onUnauthorized?: (event: any) => void
}
