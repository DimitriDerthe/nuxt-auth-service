import { vi } from 'vitest'
import { mockDatabase, mockConnectionUtils } from './database.mock'

// Export all the connection utilities with proper mocking
export const mockConnection = {
  ...mockConnectionUtils,
  schema: {
    users: {
      id: 'users.id',
      organizationId: 'users.organizationId',
      email: 'users.email',
      password: 'users.password',
      twoFactorEnabled: 'users.twoFactorEnabled',
      twoFactorSecret: 'users.twoFactorSecret',
      isSuperAdmin: 'users.isSuperAdmin',
      _: { name: 'users' },
    },
    organizations: {
      id: 'organizations.id',
      slug: 'organizations.slug',
      name: 'organizations.name',
      domain: 'organizations.domain',
      _: { name: 'organizations' },
    },
    roles: {
      id: 'roles.id',
      organizationId: 'roles.organizationId',
      slug: 'roles.slug',
      name: 'roles.name',
      _: { name: 'roles' },
    },
    permissions: {
      id: 'permissions.id',
      slug: 'permissions.slug',
      name: 'permissions.name',
      resource: 'permissions.resource',
      action: 'permissions.action',
      _: { name: 'permissions' },
    },
    userRoles: {
      userId: 'userRoles.userId',
      roleId: 'userRoles.roleId',
      _: { name: 'userRoles' },
    },
    rolePermissions: {
      roleId: 'rolePermissions.roleId',
      permissionId: 'rolePermissions.permissionId',
      _: { name: 'rolePermissions' },
    },
    recoveryCodes: {
      id: 'recoveryCodes.id',
      userId: 'recoveryCodes.userId',
      code: 'recoveryCodes.code',
      used: 'recoveryCodes.used',
      _: { name: 'recoveryCodes' },
    },
    auditLogs: {
      id: 'auditLogs.id',
      organizationId: 'auditLogs.organizationId',
      userId: 'auditLogs.userId',
      action: 'auditLogs.action',
      resource: 'auditLogs.resource',
      resourceId: 'auditLogs.resourceId',
      createdAt: 'auditLogs.createdAt',
      _: { name: 'auditLogs' },
    },
  },
  // Drizzle operators
  eq: vi.fn().mockImplementation((field, value) => ({ field, value, op: 'eq' })),
  and: vi.fn().mockImplementation((...conditions) => ({ conditions, op: 'and' })),
  or: vi.fn().mockImplementation((...conditions) => ({ conditions, op: 'or' })),
  not: vi.fn().mockImplementation(condition => ({ condition, op: 'not' })),
  isNull: vi.fn().mockImplementation(field => ({ field, op: 'isNull' })),
  isNotNull: vi.fn().mockImplementation(field => ({ field, op: 'isNotNull' })),
  inArray: vi.fn().mockImplementation((field, values) => ({ field, values, op: 'inArray' })),
  notInArray: vi.fn().mockImplementation((field, values) => ({ field, values, op: 'notInArray' })),
  desc: vi.fn().mockImplementation(field => ({ field, direction: 'desc' })),
  asc: vi.fn().mockImplementation(field => ({ field, direction: 'asc' })),
}

// Mock the database type
export interface MockDatabaseInstance {
  select: any
  insert: any
  update: any
  delete: any
  transaction: any
  [key: string]: any
}

export { mockDatabase as DatabaseInstance }
