import { vi } from 'vitest'
import type { DatabaseInstance } from '../../src/runtime/server/database/connection'

// Forward declaration
export let setMockDatabaseEnabled: (enabled: boolean) => void

// Mock data storage
export const mockData = {
  users: new Map(),
  organizations: new Map(),
  roles: new Map(),
  permissions: new Map(),
  userRoles: new Map(),
  rolePermissions: new Map(),
  recoveryCodes: new Map(),
  sessions: new Map(),
  credentials: new Map(),
  auditLogs: new Map(),
}

// Reset mock data
export function resetMockData() {
  Object.values(mockData).forEach(store => store.clear())
  // Reset to enabled state by default
  setMockDatabaseEnabled(true)
}

// Helper to generate mock query results
function createMockQuery(table: string) {
  const mockQuery: any = {}

  // Set up the chainable methods
  mockQuery.where = vi.fn().mockReturnValue(mockQuery)
  mockQuery.limit = vi.fn().mockReturnValue(mockQuery)
  mockQuery.offset = vi.fn().mockReturnValue(mockQuery)
  mockQuery.select = vi.fn().mockReturnValue(mockQuery)
  mockQuery.innerJoin = vi.fn().mockReturnValue(mockQuery)
  mockQuery.leftJoin = vi.fn().mockReturnValue(mockQuery)
  mockQuery.orderBy = vi.fn().mockReturnValue(mockQuery)
  mockQuery.groupBy = vi.fn().mockReturnValue(mockQuery)

  // Make it thenable and handle RBAC joins
  mockQuery.then = vi.fn().mockImplementation((resolve, reject) => {
    try {
      let results: any[] = []

      // Handle RBAC queries with joins
      if (table === 'userRoles') {
        // Simulate join query for getUserRoles
        const userRoles = Array.from(mockData.userRoles.values())
        results = userRoles.map((userRole: any) => {
          const role = mockData.roles.get(userRole.roleId)
          const rolePermissions = Array.from(mockData.rolePermissions.values())
            .filter((rp: any) => rp.roleId === userRole.roleId)

          // Get permissions for this role
          const permissions = rolePermissions.map((rp: any) =>
            mockData.permissions.get(rp.permissionId),
          ).filter(Boolean)

          return {
            role: { ...role, permissions },
            permission: permissions[0] || null, // First permission for compatibility
          }
        })
      }
      else {
        results = Array.from(mockData[table as keyof typeof mockData].values())
      }

      return Promise.resolve(resolve(results))
    }
    catch (error) {
      return Promise.reject(reject ? reject(error) : error)
    }
  })

  // Direct promise methods for await
  mockQuery[Symbol.asyncIterator] = function* () {
    const results = Array.from(mockData[table as keyof typeof mockData].values())
    for (const result of results) {
      yield result
    }
  }

  return mockQuery
}

// Mock Drizzle ORM
export const mockDatabase: DatabaseInstance = {
  select: vi.fn().mockImplementation((fields) => {
    const query = {
      from: vi.fn().mockImplementation((table) => {
        const tableName = getTableName(table)
        const baseQuery = createMockQuery(tableName)

        // Add additional chain methods that return the same chainable query
        const chainableMethods = ['innerJoin', 'leftJoin', 'where', 'orderBy', 'limit', 'offset']
        chainableMethods.forEach((method) => {
          baseQuery[method] = vi.fn().mockReturnValue(baseQuery)
        })

        return baseQuery
      }),
    }
    return query
  }),

  insert: vi.fn().mockImplementation(table => ({
    values: vi.fn().mockImplementation(data => ({
      onConflictDoNothing: vi.fn().mockResolvedValue([data]),
      returning: vi.fn().mockResolvedValue([data]),
      then: vi.fn().mockImplementation((callback) => {
        const tableName = getTableName(table)
        const id = data.id || `mock-${Date.now()}`
        const record = { ...data, id }
        mockData[tableName as keyof typeof mockData].set(id, record)
        return callback([record])
      }),
    })),
  })),

  update: vi.fn().mockImplementation(table => ({
    set: vi.fn().mockImplementation(data => ({
      where: vi.fn().mockImplementation(condition => ({
        returning: vi.fn().mockResolvedValue([data]),
        then: vi.fn().mockImplementation((callback) => {
          return callback([data])
        }),
      })),
    })),
  })),

  delete: vi.fn().mockImplementation(table => ({
    where: vi.fn().mockImplementation(condition => ({
      returning: vi.fn().mockResolvedValue([]),
      then: vi.fn().mockImplementation((callback) => {
        return callback([])
      }),
    })),
  })),

  transaction: vi.fn().mockImplementation(async (callback) => {
    // Simple transaction mock - just execute the callback
    return await callback(mockDatabase)
  }),

  $with: vi.fn().mockReturnThis(),
  with: vi.fn().mockReturnThis(),
  $dynamic: vi.fn().mockReturnThis(),
  mode: 'default' as any,
  session: {} as any,
  dialect: {} as any,
  _: {} as any,
  execute: vi.fn().mockResolvedValue({ rows: [] }),
  all: vi.fn().mockResolvedValue([]),
  get: vi.fn().mockResolvedValue(null),
  values: vi.fn().mockResolvedValue([]),
  run: vi.fn().mockResolvedValue({ changes: 0, lastInsertRowid: 0 }),
  batch: vi.fn().mockResolvedValue([]),
  $count: vi.fn().mockResolvedValue(0),
} as any

// Helper to extract table name from table object
function getTableName(table: any): string {
  if (typeof table === 'string') return table
  if (table?.[Symbol.for('drizzle:Name')]) return table[Symbol.for('drizzle:Name')]
  if (table?._?.name) return table._.name
  if (table?.name) return table.name
  return 'unknown'
}

// Mock database utilities
export const mockDatabaseUtils = {
  useDatabase: vi.fn().mockReturnValue(mockDatabase),
  useDatabaseOptional: vi.fn().mockReturnValue(mockDatabase),
  requireDatabase: vi.fn().mockReturnValue(mockDatabase),
  isDatabaseFeatureEnabled: vi.fn().mockReturnValue(true),
  withDatabaseTransaction: vi.fn().mockImplementation(async (callback) => {
    return await callback(mockDatabase)
  }),
}

// Global state for database simulation
let mockDatabaseEnabled = true
let mockDatabaseInstance: any = mockDatabase

// Mock connection utilities
export const mockConnectionUtils = {
  getDatabase: vi.fn().mockImplementation(() => {
    if (!mockDatabaseInstance) {
      throw new Error('Database not initialized')
    }
    return mockDatabaseInstance
  }),
  isDatabaseEnabled: vi.fn().mockImplementation(() => mockDatabaseEnabled),
  initializeDatabase: vi.fn().mockResolvedValue(undefined),
  closeDatabaseConnection: vi.fn().mockImplementation(() => {
    mockDatabaseInstance = null
  }),
  createDatabaseConnection: vi.fn().mockImplementation((config) => {
    if (!config || !config.url) {
      throw new Error('Invalid connection URL')
    }
    if (config.provider && !['sqlite', 'postgres', 'mysql'].includes(config.provider)) {
      throw new Error('Unsupported database provider')
    }
    return mockDatabase
  }),
  runMigrations: vi.fn().mockResolvedValue(undefined),
}

// Functions to control mock state
setMockDatabaseEnabled = function (enabled: boolean) {
  mockDatabaseEnabled = enabled
  mockDatabaseInstance = enabled ? mockDatabase : null
  mockDatabaseUtils.isDatabaseFeatureEnabled.mockReturnValue(enabled)
  mockConnectionUtils.isDatabaseEnabled.mockReturnValue(enabled)

  if (enabled) {
    mockDatabaseUtils.useDatabase.mockReturnValue(mockDatabase)
    mockDatabaseUtils.useDatabaseOptional.mockReturnValue(mockDatabase)
    mockDatabaseUtils.requireDatabase.mockReturnValue(mockDatabase)
  }
  else {
    mockDatabaseUtils.useDatabase.mockImplementation(() => {
      throw new Error('Database is not configured')
    })
    mockDatabaseUtils.useDatabaseOptional.mockReturnValue(null)
    mockDatabaseUtils.requireDatabase.mockImplementation(() => {
      throw new Error('This feature requires database configuration')
    })
  }
}

// Mock schema with common Drizzle operations
export const mockSchema = {
  users: {
    id: 'users.id',
    organizationId: 'users.organizationId',
    email: 'users.email',
    password: 'users.password',
    twoFactorEnabled: 'users.twoFactorEnabled',
    twoFactorSecret: 'users.twoFactorSecret',
    _: { name: 'users' },
  },
  organizations: {
    id: 'organizations.id',
    slug: 'organizations.slug',
    name: 'organizations.name',
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
    _: { name: 'auditLogs' },
  },
}

// Mock Drizzle operators
export const mockOperators = {
  eq: vi.fn().mockImplementation((field, value) => ({ field, value, op: 'eq' })),
  and: vi.fn().mockImplementation((...conditions) => ({ conditions, op: 'and' })),
  or: vi.fn().mockImplementation((...conditions) => ({ conditions, op: 'or' })),
  isNull: vi.fn().mockImplementation(field => ({ field, op: 'isNull' })),
  isNotNull: vi.fn().mockImplementation(field => ({ field, op: 'isNotNull' })),
  inArray: vi.fn().mockImplementation((field, values) => ({ field, values, op: 'inArray' })),
  sql: vi.fn().mockImplementation((template, ...values) => ({ template, values, op: 'sql' })),
  desc: vi.fn().mockImplementation(field => ({ field, direction: 'desc' })),
  asc: vi.fn().mockImplementation(field => ({ field, direction: 'asc' })),
}

// Helper functions for test data
export function createMockUser(overrides = {}) {
  return {
    id: `user-${Date.now()}`,
    organizationId: 'org-1',
    email: 'test@example.com',
    emailVerified: true,
    password: 'hashed-password',
    firstName: 'Test',
    lastName: 'User',
    twoFactorEnabled: false,
    twoFactorSecret: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

export function createMockOrganization(overrides = {}) {
  return {
    id: `org-${Date.now()}`,
    name: 'Test Organization',
    slug: 'test-org',
    domain: 'test.example.com',
    settings: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

export function createMockRole(overrides = {}) {
  return {
    id: `role-${Date.now()}`,
    organizationId: 'org-1',
    name: 'Test Role',
    slug: 'test-role',
    description: 'Test role for testing',
    isDefault: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    permissions: [],
    ...overrides,
  }
}

export function createMockPermission(overrides = {}) {
  return {
    id: `perm-${Date.now()}`,
    name: 'Test Permission',
    slug: 'test.permission',
    description: 'Test permission',
    resource: 'test',
    action: 'permission',
    createdAt: new Date(),
    ...overrides,
  }
}
