import { requirePermission } from '../../utils/rbac'
import { getCurrentTenantId } from '../../utils/tenant'
import { useDatabase } from '../../utils/database'
import { schema, eq, isNull } from '../../database/connection'

export default defineEventHandler(async (event) => {
  // Require role management permission
  await requirePermission(event, 'roles.view')

  const db = useDatabase()
  const organizationId = getCurrentTenantId(event)

  try {
    // Get roles with their permissions
    const rolesWithPermissions = await db.select({
      role: schema.roles,
      permission: schema.permissions,
    })
      .from(schema.roles)
      .leftJoin(schema.rolePermissions, eq(schema.roles.id, schema.rolePermissions.roleId))
      .leftJoin(schema.permissions, eq(schema.rolePermissions.permissionId, schema.permissions.id))
      .where(
        organizationId
          ? eq(schema.roles.organizationId, organizationId)
          : isNull(schema.roles.organizationId),
      )

    // Group by role
    const rolesMap = new Map()

    for (const result of rolesWithPermissions) {
      const roleId = result.role.id

      if (!rolesMap.has(roleId)) {
        rolesMap.set(roleId, {
          ...result.role,
          permissions: [],
        })
      }

      if (result.permission) {
        rolesMap.get(roleId).permissions.push(result.permission)
      }
    }

    return {
      roles: Array.from(rolesMap.values()),
    }
  }
  catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch roles',
    })
  }
})
