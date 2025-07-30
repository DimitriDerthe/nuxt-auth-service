import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setupMocks, teardownMocks, createMockRuntimeConfig } from '../mocks/test-utils'
import {
  mockDatabaseUtils,
  resetMockData,
} from '../mocks/database.mock'

// Mock the dependencies
vi.mock('../../src/runtime/server/utils/database', () => mockDatabaseUtils)
vi.mock('#imports', () => ({
  useRuntimeConfig: vi.fn().mockReturnValue(createMockRuntimeConfig()),
}))

// Mock password utilities
const mockPasswordUtils = {
  hashPassword: vi.fn().mockImplementation(async password => `hashed-${password}`),
  verifyPassword: vi.fn().mockImplementation(async (hash, password) => {
    return hash === `hashed-${password}`
  }),
}

vi.mock('../../src/runtime/server/utils/password', () => mockPasswordUtils)

describe('Super Admin Utils', () => {
  let originalEnv: any

  beforeEach(() => {
    setupMocks()
    resetMockData()

    // Save original environment
    originalEnv = { ...process.env }

    // Setup environment variables
    process.env.NUXT_SUPER_ADMIN_LOGIN = 'admin@test.com'
    process.env.NUXT_SUPER_ADMIN_PASSWORD = 'SuperSecurePassword123!'

    // Reset all mocks and clear call history
    vi.clearAllMocks()
  })

  afterEach(() => {
    teardownMocks()
    // Restore original environment
    process.env = originalEnv
  })

  describe('getSuperAdminCredentials', () => {
    it('should return credentials from environment variables', async () => {
      const { getSuperAdminCredentials } = await import('../../src/runtime/server/utils/super-admin')

      const credentials = getSuperAdminCredentials()

      expect(credentials).toEqual({
        login: 'admin@test.com',
        password: 'SuperSecurePassword123!',
      })
    })

    it('should return null when environment variables not set', async () => {
      delete process.env.NUXT_SUPER_ADMIN_LOGIN
      delete process.env.NUXT_SUPER_ADMIN_PASSWORD

      const { getSuperAdminCredentials } = await import('../../src/runtime/server/utils/super-admin')

      const credentials = getSuperAdminCredentials()

      expect(credentials).toBeNull()
    })
  })

  describe('validateSuperAdminCredentials', () => {
    it('should pass validation with valid credentials', async () => {
      const { validateSuperAdminCredentials } = await import('../../src/runtime/server/utils/super-admin')

      expect(() => validateSuperAdminCredentials()).not.toThrow()
    })

    it('should throw error for missing login', async () => {
      delete process.env.NUXT_SUPER_ADMIN_LOGIN

      const { validateSuperAdminCredentials } = await import('../../src/runtime/server/utils/super-admin')

      expect(() => validateSuperAdminCredentials())
        .toThrow('🚨 NUXT_SUPER_ADMIN_LOGIN and NUXT_SUPER_ADMIN_PASSWORD environment variables are required')
    })

    it('should throw error for missing password', async () => {
      delete process.env.NUXT_SUPER_ADMIN_PASSWORD

      const { validateSuperAdminCredentials } = await import('../../src/runtime/server/utils/super-admin')

      expect(() => validateSuperAdminCredentials())
        .toThrow('🚨 NUXT_SUPER_ADMIN_LOGIN and NUXT_SUPER_ADMIN_PASSWORD environment variables are required')
    })

    it('should throw error for invalid email format', async () => {
      process.env.NUXT_SUPER_ADMIN_LOGIN = 'invalid-email'

      const { validateSuperAdminCredentials } = await import('../../src/runtime/server/utils/super-admin')

      expect(() => validateSuperAdminCredentials())
        .toThrow('🚨 NUXT_SUPER_ADMIN_LOGIN must be a valid email address')
    })

    it('should throw error for weak password', async () => {
      process.env.NUXT_SUPER_ADMIN_PASSWORD = 'weak'

      const { validateSuperAdminCredentials } = await import('../../src/runtime/server/utils/super-admin')

      expect(() => validateSuperAdminCredentials())
        .toThrow('🚨 NUXT_SUPER_ADMIN_PASSWORD must be at least 8 characters long')
    })
  })

  describe('Database-dependent functions', () => {
    it('should return null when database disabled for ensureSuperAdminExists', async () => {
      mockDatabaseUtils.isDatabaseFeatureEnabled.mockReturnValue(false)

      const { ensureSuperAdminExists } = await import('../../src/runtime/server/utils/super-admin')

      const result = await ensureSuperAdminExists()

      expect(result).toBeNull()
    })

    it('should return false when database disabled for isSuperAdmin', async () => {
      mockDatabaseUtils.isDatabaseFeatureEnabled.mockReturnValue(false)

      const { isSuperAdmin } = await import('../../src/runtime/server/utils/super-admin')

      const result = await isSuperAdmin('user-1')

      expect(result).toBe(false)
    })

    it('should return null when database disabled for verifySuperAdmin', async () => {
      mockDatabaseUtils.isDatabaseFeatureEnabled.mockReturnValue(false)

      const { verifySuperAdmin } = await import('../../src/runtime/server/utils/super-admin')

      const result = await verifySuperAdmin('admin@test.com', 'SuperSecurePassword123!')

      expect(result).toBeNull()
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty email in environment', async () => {
      process.env.NUXT_SUPER_ADMIN_LOGIN = ''

      const { validateSuperAdminCredentials } = await import('../../src/runtime/server/utils/super-admin')

      expect(() => validateSuperAdminCredentials())
        .toThrow('🚨 NUXT_SUPER_ADMIN_LOGIN and NUXT_SUPER_ADMIN_PASSWORD environment variables are required')
    })

    it('should handle empty password in environment', async () => {
      process.env.NUXT_SUPER_ADMIN_PASSWORD = ''

      const { validateSuperAdminCredentials } = await import('../../src/runtime/server/utils/super-admin')

      expect(() => validateSuperAdminCredentials())
        .toThrow('🚨 NUXT_SUPER_ADMIN_LOGIN and NUXT_SUPER_ADMIN_PASSWORD environment variables are required')
    })

    it('should handle whitespace-only credentials', async () => {
      process.env.NUXT_SUPER_ADMIN_LOGIN = '   '
      process.env.NUXT_SUPER_ADMIN_PASSWORD = '   '

      const { validateSuperAdminCredentials } = await import('../../src/runtime/server/utils/super-admin')

      expect(() => validateSuperAdminCredentials())
        .toThrow('🚨 NUXT_SUPER_ADMIN_PASSWORD must be at least 8 characters long')
    })

    it('should handle international email addresses', async () => {
      process.env.NUXT_SUPER_ADMIN_LOGIN = 'admin@münchen.de'

      const { validateSuperAdminCredentials } = await import('../../src/runtime/server/utils/super-admin')

      expect(() => validateSuperAdminCredentials()).not.toThrow()
    })

    it('should handle very long passwords', async () => {
      process.env.NUXT_SUPER_ADMIN_PASSWORD = 'A'.repeat(200) + '1!'

      const { validateSuperAdminCredentials } = await import('../../src/runtime/server/utils/super-admin')

      expect(() => validateSuperAdminCredentials()).not.toThrow()
    })
  })
})
