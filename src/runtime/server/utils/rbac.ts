import type { H3Event } from 'h3'
import { createError } from 'h3'
import { schema, eq, and, inArray } from '../database/connection'
import { useDatabase, isDatabaseFeatureEnabled } from './database'
import { getUserSession } from './session'
import { getCurrentTenantId } from './tenant'
import { isSuperAdmin } from './super-admin'
import type { Permission, Role, PermissionCheck } from '#auth-utils'

/**
 * Get user roles with permissions
 */
export async function getUserRoles(userId: string, organizationId?: string | null): Promise<Role[]> {
  if (!isDatabaseFeatureEnabled()) {
    return []
  }

  const db = useDatabase()

  try {
    const query = db.select({
      role: schema.roles,
      permission: schema.permissions,
    })
      .from(schema.userRoles)
      .innerJoin(schema.roles, eq(schema.userRoles.roleId, schema.roles.id))
      .leftJoin(schema.rolePermissions, eq(schema.roles.id, schema.rolePermissions.roleId))
      .leftJoin(schema.permissions, eq(schema.rolePermissions.permissionId, schema.permissions.id))
      .where(eq(schema.userRoles.userId, userId))

    // Filter by organization if specified
    if (organizationId !== undefined) {
      query.where(
        organizationId === null
          ? eq(schema.roles.organizationId, null)
          : eq(schema.roles.organizationId, organizationId),
      )
    }

    const results = await query

    // Group by role
    const rolesMap = new Map<string, Role>()

    for (const result of results) {
      const roleId = result.role.id

      if (!rolesMap.has(roleId)) {
        rolesMap.set(roleId, {
          ...result.role,
          permissions: [],
        })
      }

      if (result.permission) {
        rolesMap.get(roleId)!.permissions!.push(result.permission)
      }
    }

    return Array.from(rolesMap.values())
  }
  catch (error) {
    console.error('Error fetching user roles:', error)
    return []
  }
}

/**
 * Get user permissions (flattened from all roles)
 */
export async function getUserPermissions(userId: string, organizationId?: string | null): Promise<Permission[]> {
  const roles = await getUserRoles(userId, organizationId)
  const permissionsMap = new Map<string, Permission>()

  for (const role of roles) {
    if (role.permissions) {
      for (const permission of role.permissions) {
        permissionsMap.set(permission.id, permission)
      }
    }
  }

  return Array.from(permissionsMap.values())
}

/**
 * Check if user has specific permission
 */
export async function hasPermission(
  userId: string,
  check: PermissionCheck | string,
  organizationId?: string | null,
): Promise<boolean> {
  // Super admins have all permissions
  if (await isSuperAdmin(userId)) {
    return true
  }

  const permissions = await getUserPermissions(userId, organizationId)

  if (typeof check === 'string') {
    return permissions.some(p => p.slug === check)
  }

  if (check.permission) {
    return permissions.some(p => p.slug === check.permission)
  }

  if (check.resource && check.action) {
    return permissions.some(p => p.resource === check.resource && p.action === check.action)
  }

  return false
}

/**
 * Check if user has any of the specified permissions
 */
export async function hasAnyPermission(
  userId: string,
  checks: (PermissionCheck | string)[],
  organizationId?: string | null,
): Promise<boolean> {
  for (const check of checks) {
    if (await hasPermission(userId, check, organizationId)) {
      return true
    }
  }
  return false
}

/**
 * Check if user has all of the specified permissions
 */
export async function hasAllPermissions(
  userId: string,
  checks: (PermissionCheck | string)[],
  organizationId?: string | null,
): Promise<boolean> {
  for (const check of checks) {
    if (!(await hasPermission(userId, check, organizationId))) {
      return false
    }
  }
  return true
}

/**
 * Check if user has specific role
 */
export async function hasRole(
  userId: string,
  roleSlug: string,
  organizationId?: string | null,
): Promise<boolean> {
  // Super admins have all roles
  if (await isSuperAdmin(userId)) {
    return true
  }

  const roles = await getUserRoles(userId, organizationId)
  return roles.some(role => role.slug === roleSlug)
}

/**
 * Require specific permission for current user session
 */
export async function requirePermission(
  event: H3Event,
  check: PermissionCheck | string,
  options: { statusCode?: number, message?: string } = {},
): Promise<void> {
  const session = await getUserSession(event)

  if (!session.user?.id) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Authentication required',
    })
  }

  const organizationId = getCurrentTenantId(event)
  const hasAccess = await hasPermission(session.user.id, check, organizationId)

  if (!hasAccess) {
    throw createError({
      statusCode: options.statusCode || 403,
      statusMessage: options.message || 'Insufficient permissions',
    })
  }
}

/**
 * Require specific role for current user session
 */
export async function requireRole(
  event: H3Event,
  roleSlug: string,
  options: { statusCode?: number, message?: string } = {},
): Promise<void> {
  const session = await getUserSession(event)

  if (!session.user?.id) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Authentication required',
    })
  }

  const organizationId = getCurrentTenantId(event)
  const hasAccess = await hasRole(session.user.id, roleSlug, organizationId)

  if (!hasAccess) {
    throw createError({
      statusCode: options.statusCode || 403,
      statusMessage: options.message || 'Insufficient role privileges',
    })
  }
}

/**
 * Get user session with roles and permissions populated
 */
export async function getUserSessionWithRBAC(event: H3Event) {
  const session = await getUserSession(event)

  if (!session.user?.id) {
    return { ...session, roles: [], permissions: [] }
  }

  const organizationId = getCurrentTenantId(event)
  const roles = await getUserRoles(session.user.id, organizationId)
  const permissions = await getUserPermissions(session.user.id, organizationId)
  const isSuper = await isSuperAdmin(session.user.id)

  return {
    ...session,
    user: {
      ...session.user,
      isSuperAdmin: isSuper,
    },
    roles,
    permissions,
  }
}

/**
 * Assign role to user
 */
export async function assignRole(
  userId: string,
  roleSlug: string,
  organizationId: string | null,
  assignedBy?: string,
): Promise<boolean> {
  if (!isDatabaseFeatureEnabled()) {
    return false
  }

  const db = useDatabase()

  try {
    // Find role
    const role = await db.select()
      .from(schema.roles)
      .where(
        and(
          eq(schema.roles.slug, roleSlug),
          organizationId
            ? eq(schema.roles.organizationId, organizationId)
            : eq(schema.roles.organizationId, null),
        ),
      )
      .limit(1)

    if (role.length === 0) {
      return false
    }

    // Check if user already has role
    const existingRole = await db.select()
      .from(schema.userRoles)
      .where(
        and(
          eq(schema.userRoles.userId, userId),
          eq(schema.userRoles.roleId, role[0].id),
        ),
      )
      .limit(1)

    if (existingRole.length > 0) {
      return true // Already has role
    }

    // Assign role
    await db.insert(schema.userRoles).values({
      userId,
      roleId: role[0].id,
      assignedAt: new Date(),
      assignedBy,
    })

    return true
  }
  catch (error) {
    console.error('Error assigning role:', error)
    return false
  }
}

/**
 * Remove role from user
 */
export async function removeRole(
  userId: string,
  roleSlug: string,
  organizationId: string | null,
): Promise<boolean> {
  if (!isDatabaseFeatureEnabled()) {
    return false
  }

  const db = useDatabase()

  try {
    // Find role
    const role = await db.select()
      .from(schema.roles)
      .where(
        and(
          eq(schema.roles.slug, roleSlug),
          organizationId
            ? eq(schema.roles.organizationId, organizationId)
            : eq(schema.roles.organizationId, null),
        ),
      )
      .limit(1)

    if (role.length === 0) {
      return false
    }

    // Remove role assignment
    await db.delete(schema.userRoles)
      .where(
        and(
          eq(schema.userRoles.userId, userId),
          eq(schema.userRoles.roleId, role[0].id),
        ),
      )

    return true
  }
  catch (error) {
    console.error('Error removing role:', error)
    return false
  }
}
