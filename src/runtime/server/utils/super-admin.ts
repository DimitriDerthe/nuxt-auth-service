import { randomUUID } from 'uncrypto'
import { schema, eq } from '../database/connection'
import { hashPassword } from './password'
import { useDatabase, isDatabaseFeatureEnabled } from './database'
import type { User, Organization } from '#auth-utils'

/**
 * Get super admin credentials from environment
 */
export function getSuperAdminCredentials() {
  const login = process.env.NUXT_SUPER_ADMIN_LOGIN
  const password = process.env.NUXT_SUPER_ADMIN_PASSWORD

  if (!login || !password) {
    return null
  }

  return { login, password }
}

/**
 * Validate super admin credentials are set
 */
export function validateSuperAdminCredentials(): void {
  if (!isDatabaseFeatureEnabled()) {
    return // No validation needed if database is not enabled
  }

  const credentials = getSuperAdminCredentials()
  if (!credentials) {
    throw new Error(
      '🚨 NUXT_SUPER_ADMIN_LOGIN and NUXT_SUPER_ADMIN_PASSWORD environment variables are required when using database features.\n'
      + 'Please set these variables to create the initial super admin user:\n'
      + 'NUXT_SUPER_ADMIN_LOGIN=admin@example.com\n'
      + 'NUXT_SUPER_ADMIN_PASSWORD=your-secure-password',
    )
  }

  // Validate password strength
  if (credentials.password.length < 8) {
    throw new Error('🚨 NUXT_SUPER_ADMIN_PASSWORD must be at least 8 characters long')
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/
  if (!emailRegex.test(credentials.login)) {
    throw new Error('🚨 NUXT_SUPER_ADMIN_LOGIN must be a valid email address')
  }
}

/**
 * Create or update super admin user
 */
export async function ensureSuperAdminExists(): Promise<User | null> {
  if (!isDatabaseFeatureEnabled()) {
    return null
  }

  const credentials = getSuperAdminCredentials()
  if (!credentials) {
    return null
  }

  const db = useDatabase()

  try {
    // Check if super admin already exists
    const existingUser = await db.select()
      .from(schema.users)
      .where(eq(schema.users.email, credentials.login))
      .limit(1)

    if (existingUser.length > 0) {
      const user = existingUser[0]

      // Update password if it has changed
      const hashedPassword = await hashPassword(credentials.password)
      if (user.password !== hashedPassword) {
        await db.update(schema.users)
          .set({
            password: hashedPassword,
            updatedAt: new Date(),
          })
          .where(eq(schema.users.id, user.id))

        console.log('✅ Super admin password updated')
      }

      return user as User
    }

    // Create super admin user
    const userId = randomUUID()
    const hashedPassword = await hashPassword(credentials.password)

    await db.insert(schema.users).values({
      id: userId,
      organizationId: null, // Super admin is not tied to any organization
      email: credentials.login,
      emailVerified: true,
      password: hashedPassword,
      firstName: 'Super',
      lastName: 'Admin',
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    // Assign super admin role
    await assignSuperAdminRole(userId)

    console.log('✅ Super admin user created:', credentials.login)

    const newUser = await db.select()
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1)

    return newUser[0] as User
  }
  catch (error) {
    console.error('❌ Failed to create super admin:', error)
    throw error
  }
}

/**
 * Create super admin role and permissions
 */
async function createSuperAdminRole(): Promise<string> {
  const db = useDatabase()
  const roleId = randomUUID()

  // Create super admin role (not tied to any organization)
  await db.insert(schema.roles).values({
    id: roleId,
    organizationId: null,
    name: 'Super Admin',
    slug: 'super-admin',
    description: 'System-wide super administrator with full access',
    isDefault: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  }).onConflictDoNothing()

  // Get all permissions
  const allPermissions = await db.select().from(schema.permissions)

  // Assign all permissions to super admin role
  for (const permission of allPermissions) {
    await db.insert(schema.rolePermissions).values({
      roleId,
      permissionId: permission.id,
      createdAt: new Date(),
    }).onConflictDoNothing()
  }

  // Add additional super admin permissions
  const superAdminPermissions = [
    { name: 'System Administration', slug: 'system.admin', resource: 'system', action: 'admin', description: 'Full system administration access' },
    { name: 'Manage All Organizations', slug: 'organizations.manage-all', resource: 'organizations', action: 'manage-all', description: 'Manage all organizations' },
    { name: 'Manage All Users', slug: 'users.manage-all', resource: 'users', action: 'manage-all', description: 'Manage users across all organizations' },
    { name: 'View All Audit Logs', slug: 'audit.view-all', resource: 'audit', action: 'view-all', description: 'View audit logs across all organizations' },
  ]

  for (const permissionData of superAdminPermissions) {
    const permissionId = randomUUID()

    await db.insert(schema.permissions).values({
      id: permissionId,
      ...permissionData,
      createdAt: new Date(),
    }).onConflictDoNothing()

    await db.insert(schema.rolePermissions).values({
      roleId,
      permissionId,
      createdAt: new Date(),
    }).onConflictDoNothing()
  }

  return roleId
}

/**
 * Assign super admin role to user
 */
async function assignSuperAdminRole(userId: string): Promise<void> {
  const db = useDatabase()

  // Check if super admin role exists
  const superAdminRole = await db.select()
    .from(schema.roles)
    .where(eq(schema.roles.slug, 'super-admin'))
    .limit(1)

  let roleId: string
  if (superAdminRole.length === 0) {
    roleId = await createSuperAdminRole()
  }
  else {
    roleId = superAdminRole[0].id
  }

  // Assign role to user
  await db.insert(schema.userRoles).values({
    userId,
    roleId,
    assignedAt: new Date(),
    assignedBy: userId, // Self-assigned for super admin
  }).onConflictDoNothing()
}

/**
 * Check if user is super admin
 */
export async function isSuperAdmin(userId: string): Promise<boolean> {
  if (!isDatabaseFeatureEnabled()) {
    return false
  }

  const db = useDatabase()

  try {
    const result = await db.select()
      .from(schema.userRoles)
      .innerJoin(schema.roles, eq(schema.userRoles.roleId, schema.roles.id))
      .where(eq(schema.userRoles.userId, userId))
      .where(eq(schema.roles.slug, 'super-admin'))
      .limit(1)

    return result.length > 0
  }
  catch (error) {
    console.error('Error checking super admin status:', error)
    return false
  }
}

/**
 * Verify super admin login credentials
 */
export async function verifySuperAdmin(email: string, password: string): Promise<User | null> {
  if (!isDatabaseFeatureEnabled()) {
    return null
  }

  const db = useDatabase()

  try {
    const user = await db.select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1)

    if (user.length === 0) {
      return null
    }

    const userData = user[0]

    // Check if user is super admin
    const isSuper = await isSuperAdmin(userData.id)
    if (!isSuper) {
      return null
    }

    // Verify password using secure comparison to prevent timing attacks
    const { securePasswordVerify } = await import('./secure-compare')
    const isValidPassword = await securePasswordVerify(userData.password!, password)

    if (!isValidPassword) {
      return null
    }

    return userData as User
  }
  catch (error) {
    console.error('Error verifying super admin:', error)
    return null
  }
}
