import { sql } from 'drizzle-orm'
import { integer, text, boolean, timestamp, primaryKey, index, uniqueIndex, sqliteTable } from 'drizzle-orm/sqlite-core'

// Organizations table for multi-tenant support
export const organizations = sqliteTable('organizations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  domain: text('domain'),
  settings: text('settings', { mode: 'json' }).$type<Record<string, any>>(),
  createdAt: timestamp('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, table => ({
  slugIdx: uniqueIndex('organizations_slug_idx').on(table.slug),
  domainIdx: index('organizations_domain_idx').on(table.domain),
}))

// Enhanced users table
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  emailVerified: boolean('email_verified').default(false),
  password: text('password'),
  firstName: text('first_name'),
  lastName: text('last_name'),
  avatar: text('avatar'),
  locale: text('locale').default('en'),
  timezone: text('timezone'),
  twoFactorEnabled: boolean('two_factor_enabled').default(false),
  twoFactorSecret: text('two_factor_secret'),
  lastLoginAt: timestamp('last_login_at'),
  createdAt: timestamp('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, table => ({
  emailIdx: index('users_email_idx').on(table.email),
  orgEmailIdx: uniqueIndex('users_org_email_idx').on(table.organizationId, table.email),
}))

// Roles table
export const roles = sqliteTable('roles', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  description: text('description'),
  isDefault: boolean('is_default').default(false),
  createdAt: timestamp('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, table => ({
  orgSlugIdx: uniqueIndex('roles_org_slug_idx').on(table.organizationId, table.slug),
}))

// Permissions table
export const permissions = sqliteTable('permissions', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  resource: text('resource'),
  action: text('action'),
  createdAt: timestamp('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, table => ({
  slugIdx: uniqueIndex('permissions_slug_idx').on(table.slug),
  resourceActionIdx: index('permissions_resource_action_idx').on(table.resource, table.action),
}))

// User roles junction table
export const userRoles = sqliteTable('user_roles', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  roleId: text('role_id').notNull().references(() => roles.id, { onDelete: 'cascade' }),
  assignedAt: timestamp('assigned_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  assignedBy: text('assigned_by').references(() => users.id),
}, table => ({
  pk: primaryKey({ columns: [table.userId, table.roleId] }),
}))

// Role permissions junction table
export const rolePermissions = sqliteTable('role_permissions', {
  roleId: text('role_id').notNull().references(() => roles.id, { onDelete: 'cascade' }),
  permissionId: text('permission_id').notNull().references(() => permissions.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, table => ({
  pk: primaryKey({ columns: [table.roleId, table.permissionId] }),
}))

// Recovery codes for 2FA
export const recoveryCodes = sqliteTable('recovery_codes', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  code: text('code').notNull(),
  used: boolean('used').default(false),
  usedAt: timestamp('used_at'),
  createdAt: timestamp('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, table => ({
  userIdx: index('recovery_codes_user_idx').on(table.userId),
  codeIdx: uniqueIndex('recovery_codes_code_idx').on(table.code),
}))

// Sessions table for advanced session management
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  organizationId: text('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  userAgent: text('user_agent'),
  ipAddress: text('ip_address'),
  lastAccessedAt: timestamp('last_accessed_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, table => ({
  userIdx: index('sessions_user_idx').on(table.userId),
  tokenIdx: uniqueIndex('sessions_token_idx').on(table.token),
  expiresIdx: index('sessions_expires_idx').on(table.expiresAt),
}))

// WebAuthn credentials (enhanced from existing)
export const credentials = sqliteTable('credentials', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  publicKey: text('public_key').notNull(),
  counter: integer('counter').notNull().default(0),
  backedUp: boolean('backed_up').notNull().default(false),
  transports: text('transports').notNull(),
  name: text('name'), // User-friendly name for the credential
  createdAt: timestamp('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  lastUsedAt: timestamp('last_used_at'),
}, table => ({
  userIdx: index('credentials_user_idx').on(table.userId),
}))

// Audit log for security events
export const auditLogs = sqliteTable('audit_logs', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  action: text('action').notNull(),
  resource: text('resource'),
  resourceId: text('resource_id'),
  details: text('details', { mode: 'json' }).$type<Record<string, any>>(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, table => ({
  orgIdx: index('audit_logs_org_idx').on(table.organizationId),
  userIdx: index('audit_logs_user_idx').on(table.userId),
  actionIdx: index('audit_logs_action_idx').on(table.action),
  createdAtIdx: index('audit_logs_created_at_idx').on(table.createdAt),
}))

// Type exports for TypeScript
export type Organization = typeof organizations.$inferSelect
export type NewOrganization = typeof organizations.$inferInsert
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Role = typeof roles.$inferSelect
export type NewRole = typeof roles.$inferInsert
export type Permission = typeof permissions.$inferSelect
export type NewPermission = typeof permissions.$inferInsert
export type UserRole = typeof userRoles.$inferSelect
export type NewUserRole = typeof userRoles.$inferInsert
export type RolePermission = typeof rolePermissions.$inferSelect
export type NewRolePermission = typeof rolePermissions.$inferInsert
export type RecoveryCode = typeof recoveryCodes.$inferSelect
export type NewRecoveryCode = typeof recoveryCodes.$inferInsert
export type Session = typeof sessions.$inferSelect
export type NewSession = typeof sessions.$inferInsert
export type Credential = typeof credentials.$inferSelect
export type NewCredential = typeof credentials.$inferInsert
export type AuditLog = typeof auditLogs.$inferSelect
export type NewAuditLog = typeof auditLogs.$inferInsert
