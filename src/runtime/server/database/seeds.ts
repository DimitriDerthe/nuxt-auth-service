import { randomUUID } from 'uncrypto'
import { validateSuperAdminCredentials, ensureSuperAdminExists } from '../utils/super-admin'
import type { DatabaseInstance } from './connection'
import { schema } from './connection'

/**
 * Seed default permissions
 */
export async function seedDefaultPermissions(db: DatabaseInstance) {
  const defaultPermissions = [
    // User management
    { name: 'View Users', slug: 'users.view', resource: 'users', action: 'view', description: 'View user profiles and listings' },
    { name: 'Create Users', slug: 'users.create', resource: 'users', action: 'create', description: 'Create new user accounts' },
    { name: 'Update Users', slug: 'users.update', resource: 'users', action: 'update', description: 'Update user profiles and settings' },
    { name: 'Delete Users', slug: 'users.delete', resource: 'users', action: 'delete', description: 'Delete user accounts' },

    // Role management
    { name: 'View Roles', slug: 'roles.view', resource: 'roles', action: 'view', description: 'View roles and permissions' },
    { name: 'Manage Roles', slug: 'roles.manage', resource: 'roles', action: 'manage', description: 'Create, update, and assign roles' },

    // Organization management
    { name: 'View Organization', slug: 'organization.view', resource: 'organization', action: 'view', description: 'View organization details' },
    { name: 'Manage Organization', slug: 'organization.manage', resource: 'organization', action: 'manage', description: 'Manage organization settings' },

    // Session management
    { name: 'Manage Sessions', slug: 'sessions.manage', resource: 'sessions', action: 'manage', description: 'View and revoke user sessions' },

    // Audit logs
    { name: 'View Audit Logs', slug: 'audit.view', resource: 'audit', action: 'view', description: 'View security and audit logs' },
  ]

  for (const permission of defaultPermissions) {
    await db.insert(schema.permissions).values({
      id: randomUUID(),
      ...permission,
    }).onConflictDoNothing()
  }
}

/**
 * Seed default roles for an organization
 */
export async function seedDefaultRoles(db: DatabaseInstance, organizationId: string) {
  const roles = [
    {
      name: 'Super Admin',
      slug: 'super-admin',
      description: 'Full access to all features and settings',
      permissions: ['users.view', 'users.create', 'users.update', 'users.delete', 'roles.view', 'roles.manage', 'organization.view', 'organization.manage', 'sessions.manage', 'audit.view'],
    },
    {
      name: 'Admin',
      slug: 'admin',
      description: 'Administrative access with user management',
      permissions: ['users.view', 'users.create', 'users.update', 'roles.view', 'organization.view', 'sessions.manage'],
    },
    {
      name: 'Manager',
      slug: 'manager',
      description: 'Management access with limited user operations',
      permissions: ['users.view', 'users.update', 'organization.view'],
    },
    {
      name: 'User',
      slug: 'user',
      description: 'Standard user access',
      isDefault: true,
      permissions: ['organization.view'],
    },
  ]

  for (const roleData of roles) {
    const { permissions: permissionSlugs, ...roleInfo } = roleData

    // Create role
    const roleId = randomUUID()
    await db.insert(schema.roles).values({
      id: roleId,
      organizationId,
      ...roleInfo,
    }).onConflictDoNothing()

    // Assign permissions to role
    if (permissionSlugs?.length) {
      const permissions = await db.select()
        .from(schema.permissions)
        .where(schema.permissions.slug.in(permissionSlugs))

      for (const permission of permissions) {
        await db.insert(schema.rolePermissions).values({
          roleId,
          permissionId: permission.id,
        }).onConflictDoNothing()
      }
    }
  }
}

/**
 * Create default organization
 */
export async function createDefaultOrganization(db: DatabaseInstance, organizationData: {
  name: string
  slug: string
  domain?: string
}) {
  const organizationId = randomUUID()

  await db.insert(schema.organizations).values({
    id: organizationId,
    ...organizationData,
  }).onConflictDoNothing()

  // Seed default roles for this organization
  await seedDefaultRoles(db, organizationId)

  return organizationId
}

/**
 * Run all seeds
 */
export async function runSeeds(db: DatabaseInstance) {
  console.log('🌱 Running database seeds...')

  // Seed default permissions (global)
  await seedDefaultPermissions(db)

  console.log('✅ Database seeds completed')
}

/**
 * Initialize database with default data
 */
export async function initializeDatabaseData(db: DatabaseInstance) {
  // Validate super admin credentials first
  validateSuperAdminCredentials()

  // Check if already initialized
  const existingPermissions = await db.select().from(schema.permissions).limit(1)

  if (existingPermissions.length === 0) {
    await runSeeds(db)
  }

  // Ensure super admin exists
  await ensureSuperAdminExists()
}
