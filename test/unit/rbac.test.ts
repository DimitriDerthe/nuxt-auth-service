import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setupMocks, teardownMocks, createMockH3Event, createMockUserSession } from '../mocks/test-utils'
import {
  mockDatabaseUtils,
  resetMockData,
  createMockUser,
  createMockRole,
  createMockPermission,
} from '../mocks/database.mock'

// Mock the dependencies
vi.mock('../../src/runtime/server/utils/database', () => mockDatabaseUtils)
vi.mock('../../src/runtime/server/database/connection', () => ({
  schema: {
    users: { id: 'users.id' },
    roles: { id: 'roles.id', organizationId: 'roles.organizationId', slug: 'roles.slug' },
    permissions: { id: 'permissions.id', slug: 'permissions.slug', resource: 'permissions.resource', action: 'permissions.action' },
    userRoles: { userId: 'userRoles.userId', roleId: 'userRoles.roleId' },
    rolePermissions: { roleId: 'rolePermissions.roleId', permissionId: 'rolePermissions.permissionId' },
  },
  eq: vi.fn().mockImplementation((field, value) => ({ field, value, op: 'eq' })),
  and: vi.fn().mockImplementation((...conditions) => ({ conditions, op: 'and' })),
  or: vi.fn().mockImplementation((...conditions) => ({ conditions, op: 'or' })),
  inArray: vi.fn().mockImplementation((field, values) => ({ field, values, op: 'inArray' })),
}))

vi.mock('../../src/runtime/server/utils/session', () => ({
  getUserSession: vi.fn().mockResolvedValue({ user: { id: 'user-1' } }),
}))

vi.mock('../../src/runtime/server/utils/super-admin', () => ({
  isSuperAdmin: vi.fn().mockResolvedValue(false),
}))

describe('RBAC Utils', () => {
  let mockUser: any
  let mockRole: any
  let mockPermission: any
  let mockEvent: any

  beforeEach(() => {
    setupMocks()
    resetMockData()

    // Create test data
    mockUser = createMockUser({ id: 'user-1', organizationId: 'org-1' })
    mockRole = createMockRole({ id: 'role-1', slug: 'admin', organizationId: 'org-1' })
    mockPermission = createMockPermission({ id: 'perm-1', slug: 'users.read', resource: 'users', action: 'read' })
    mockEvent = createMockH3Event({ user: mockUser })

    vi.clearAllMocks()
  })

  afterEach(() => {
    teardownMocks()
  })

  describe('Database disabled scenarios', () => {
    it('should return empty array when database disabled for getUserRoles', async () => {
      mockDatabaseUtils.isDatabaseFeatureEnabled.mockReturnValue(false)

      const { getUserRoles } = await import('../../src/runtime/server/utils/rbac')

      const result = await getUserRoles('user-1')
      expect(result).toEqual([])
    })

    it('should return empty array when database disabled for getUserPermissions', async () => {
      mockDatabaseUtils.isDatabaseFeatureEnabled.mockReturnValue(false)

      const { getUserPermissions } = await import('../../src/runtime/server/utils/rbac')

      const result = await getUserPermissions('user-1')
      expect(result).toEqual([])
    })

    it('should return false when database disabled for hasPermission', async () => {
      mockDatabaseUtils.isDatabaseFeatureEnabled.mockReturnValue(false)

      const { hasPermission } = await import('../../src/runtime/server/utils/rbac')

      const result = await hasPermission('user-1', 'users.read')
      expect(result).toBe(false)
    })

    it('should return false when database disabled for hasRole', async () => {
      mockDatabaseUtils.isDatabaseFeatureEnabled.mockReturnValue(false)

      const { hasRole } = await import('../../src/runtime/server/utils/rbac')

      const result = await hasRole('user-1', 'admin')
      expect(result).toBe(false)
    })

    it('should return false when database disabled for assignRole', async () => {
      mockDatabaseUtils.isDatabaseFeatureEnabled.mockReturnValue(false)

      const { assignRole } = await import('../../src/runtime/server/utils/rbac')

      const result = await assignRole('user-1', 'admin', 'org-1')
      expect(result).toBe(false)
    })

    it('should return false when database disabled for removeRole', async () => {
      mockDatabaseUtils.isDatabaseFeatureEnabled.mockReturnValue(false)

      const { removeRole } = await import('../../src/runtime/server/utils/rbac')

      const result = await removeRole('user-1', 'admin', 'org-1')
      expect(result).toBe(false)
    })
  })

  describe('Error handling', () => {
    it('should handle database errors gracefully for getUserRoles', async () => {
      mockDatabaseUtils.isDatabaseFeatureEnabled.mockReturnValue(true)

      const { getUserRoles } = await import('../../src/runtime/server/utils/rbac')

      const result = await getUserRoles('user-1')
      expect(result).toEqual([])
    })

    it('should return false for invalid permission format', async () => {
      const { hasPermission } = await import('../../src/runtime/server/utils/rbac')

      const result = await hasPermission('user-1', '')
      expect(result).toBe(false)
    })

    it('should return false if user has none of the permissions for hasAnyPermission', async () => {
      const { hasAnyPermission } = await import('../../src/runtime/server/utils/rbac')

      const result = await hasAnyPermission('user-1', ['admin.users', 'admin.roles'])
      expect(result).toBe(false)
    })

    it('should return false if user missing any permission for hasAllPermissions', async () => {
      const { hasAllPermissions } = await import('../../src/runtime/server/utils/rbac')

      const result = await hasAllPermissions('user-1', ['users.read', 'users.write'])
      expect(result).toBe(false)
    })

    it('should return false for user without role', async () => {
      const { hasRole } = await import('../../src/runtime/server/utils/rbac')

      const result = await hasRole('user-1', 'nonexistent')
      expect(result).toBe(false)
    })

    it('should throw 403 for user without permission', async () => {
      const { requirePermission } = await import('../../src/runtime/server/utils/rbac')

      await expect(requirePermission(mockEvent, 'admin.users'))
        .rejects.toThrow('Insufficient permissions')
    })

    it('should throw 403 for user without role', async () => {
      const { requireRole } = await import('../../src/runtime/server/utils/rbac')

      await expect(requireRole(mockEvent, 'admin'))
        .rejects.toThrow('Insufficient role privileges')
    })

    it('should use custom error options', async () => {
      const { requirePermission } = await import('../../src/runtime/server/utils/rbac')

      await expect(requirePermission(mockEvent, 'admin.users', {
        statusCode: 404,
        statusMessage: 'Custom error',
      })).rejects.toThrow('Insufficient permissions')
    })

    it('should return false if role not found for assignRole', async () => {
      const { assignRole } = await import('../../src/runtime/server/utils/rbac')

      const result = await assignRole('user-1', 'nonexistent', 'org-1')
      expect(result).toBe(false)
    })

    it('should return false if role not found for removeRole', async () => {
      const { removeRole } = await import('../../src/runtime/server/utils/rbac')

      const result = await removeRole('user-1', 'nonexistent', 'org-1')
      expect(result).toBe(false)
    })

    it('should handle database errors for assignRole', async () => {
      const { assignRole } = await import('../../src/runtime/server/utils/rbac')

      const result = await assignRole('user-1', 'admin', 'org-1')
      expect(result).toBe(false)
    })

    it('should handle database errors for removeRole', async () => {
      const { removeRole } = await import('../../src/runtime/server/utils/rbac')

      const result = await removeRole('user-1', 'admin', 'org-1')
      expect(result).toBe(false)
    })
  })

  describe('Session management', () => {
    it('should return session with roles and permissions for getUserSessionWithRBAC', async () => {
      const { getUserSessionWithRBAC } = await import('../../src/runtime/server/utils/rbac')

      const result = await getUserSessionWithRBAC(mockEvent)
      expect(result).toHaveProperty('user')
      expect(result).toHaveProperty('roles')
      expect(result).toHaveProperty('permissions')
      expect(result.user).toHaveProperty('isSuperAdmin')
    })

    it('should return empty arrays for unauthenticated user', async () => {
      const { getUserSession } = await import('../../src/runtime/server/utils/session')
      vi.mocked(getUserSession).mockResolvedValue({ user: null })

      const { getUserSessionWithRBAC } = await import('../../src/runtime/server/utils/rbac')

      const result = await getUserSessionWithRBAC(mockEvent)
      expect(result).toEqual({
        user: null,
        roles: [],
        permissions: [],
      })
    })
  })
})
