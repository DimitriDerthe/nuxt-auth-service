import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setupMocks, teardownMocks, createMockH3Event, createMockTenantContext, createMockRuntimeConfig } from '../mocks/test-utils'
import {
  mockDatabase,
  mockDatabaseUtils,
  resetMockData,
  createMockOrganization,
} from '../mocks/database.mock'

// Mock the dependencies
vi.mock('../../src/runtime/server/utils/database', () => mockDatabaseUtils)
vi.mock('#imports', () => ({
  useRuntimeConfig: vi.fn().mockReturnValue(createMockRuntimeConfig()),
}))

describe('Tenant Utils', () => {
  let mockOrganization: any
  let mockEvent: any

  beforeEach(() => {
    setupMocks()
    resetMockData()
    vi.resetModules() // Reset tenant context between tests

    // Create test data
    mockOrganization = createMockOrganization({
      id: 'org-1',
      slug: 'test-org',
      domain: 'test.example.com',
    })

    mockEvent = createMockH3Event({
      headers: { host: 'test.example.com' },
    })

    // Setup mock database responses
    mockDatabase.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([mockOrganization]),
        }),
      }),
    })
  })

  afterEach(() => {
    teardownMocks()
  })

  describe('getTenantContext', () => {
    it('should return null when no tenant context is set', async () => {
      const { getTenantContext } = await import('../../src/runtime/server/utils/tenant')

      const context = getTenantContext(mockEvent)
      expect(context).toBeNull()
    })

    it('should return tenant context when set', async () => {
      const { getTenantContext, setTenantContext } = await import('../../src/runtime/server/utils/tenant')

      const tenantContext = createMockTenantContext({ organizationId: 'org-1' })
      setTenantContext(mockEvent, tenantContext)

      const context = getTenantContext(mockEvent)
      expect(context).toEqual(tenantContext)
    })
  })

  describe('setTenantContext', () => {
    it('should set tenant context on event', async () => {
      const { getTenantContext, setTenantContext } = await import('../../src/runtime/server/utils/tenant')

      const tenantContext = createMockTenantContext({ organizationId: 'org-1' })

      setTenantContext(mockEvent, tenantContext)
      const retrievedContext = getTenantContext(mockEvent)

      expect(retrievedContext).toEqual(tenantContext)
    })

    it('should overwrite existing tenant context', async () => {
      const { getTenantContext, setTenantContext } = await import('../../src/runtime/server/utils/tenant')

      const context1 = createMockTenantContext({ organizationId: 'org-1' })
      const context2 = createMockTenantContext({ organizationId: 'org-2' })

      setTenantContext(mockEvent, context1)
      setTenantContext(mockEvent, context2)

      const retrievedContext = getTenantContext(mockEvent)
      expect(retrievedContext).toEqual(context2)
    })
  })

  describe('detectTenant', () => {
    it('should return null when multi-tenant is disabled', async () => {
      vi.doMock('#imports', () => ({
        useRuntimeConfig: vi.fn().mockReturnValue({
          multiTenant: { enabled: false },
        }),
      }))

      const { detectTenant } = await import('../../src/runtime/server/utils/tenant')

      const result = await detectTenant(mockEvent)
      expect(result).toBeNull()
    })

    it('should detect tenant from subdomain', async () => {
      vi.doMock('#imports', () => ({
        useRuntimeConfig: vi.fn().mockReturnValue({
          multiTenant: {
            enabled: true,
            strategy: 'subdomain',
          },
        }),
      }))

      const { detectTenant } = await import('../../src/runtime/server/utils/tenant')

      const event = createMockH3Event({
        headers: { host: 'acme.example.com' },
      })

      const result = await detectTenant(event)
      expect(result).toBe('acme')
    })

    it('should detect tenant from path', async () => {
      vi.doMock('#imports', () => ({
        useRuntimeConfig: vi.fn().mockReturnValue({
          multiTenant: {
            enabled: true,
            strategy: 'path',
            pathIndex: 0,
          },
        }),
      }))

      const { detectTenant } = await import('../../src/runtime/server/utils/tenant')

      const event = createMockH3Event({
        url: '/acme/dashboard',
        headers: { host: 'example.com' },
      })

      const result = await detectTenant(event)
      expect(result).toBe('acme')
    })

    it('should detect tenant from header', async () => {
      vi.doMock('#imports', () => ({
        useRuntimeConfig: vi.fn().mockReturnValue({
          multiTenant: {
            enabled: true,
            strategy: 'header',
            headerName: 'x-tenant-id',
          },
        }),
      }))

      const { detectTenant } = await import('../../src/runtime/server/utils/tenant')

      const event = createMockH3Event({
        headers: {
          'host': 'example.com',
          'x-tenant-id': 'acme',
        },
      })

      const result = await detectTenant(event)
      expect(result).toBe('acme')
    })
  })

  describe('getCurrentTenantId', () => {
    it('should return tenant ID from context', async () => {
      const { getCurrentTenantId, setTenantContext } = await import('../../src/runtime/server/utils/tenant')

      const tenantContext = createMockTenantContext({ organizationId: 'org-123' })
      setTenantContext(mockEvent, tenantContext)

      const tenantId = getCurrentTenantId(mockEvent)
      expect(tenantId).toBe('org-123')
    })

    it('should return null when no tenant context', async () => {
      const { getCurrentTenantId } = await import('../../src/runtime/server/utils/tenant')

      const tenantId = getCurrentTenantId(mockEvent)
      expect(tenantId).toBeNull()
    })
  })

  describe('getCurrentOrganization', () => {
    it('should return organization from context', async () => {
      const { getCurrentOrganization, setTenantContext } = await import('../../src/runtime/server/utils/tenant')

      const organization = { id: 'org-1', name: 'Test Org', slug: 'test' }
      const tenantContext = createMockTenantContext({
        organizationId: 'org-1',
        organization,
      })
      setTenantContext(mockEvent, tenantContext)

      const result = getCurrentOrganization(mockEvent)
      expect(result).toEqual(organization)
    })

    it('should return null when no tenant context', async () => {
      const { getCurrentOrganization } = await import('../../src/runtime/server/utils/tenant')

      const result = getCurrentOrganization(mockEvent)
      expect(result).toBeNull()
    })
  })

  describe('requireTenant', () => {
    it('should return tenant context when available', async () => {
      const { requireTenant, setTenantContext } = await import('../../src/runtime/server/utils/tenant')

      const tenantContext = createMockTenantContext({ organizationId: 'org-1' })
      setTenantContext(mockEvent, tenantContext)

      const result = requireTenant(mockEvent)
      expect(result).toEqual(tenantContext)
    })

    it('should throw error when tenant context not available', async () => {
      const { requireTenant } = await import('../../src/runtime/server/utils/tenant')

      expect(() => requireTenant(mockEvent))
        .toThrow('Tenant not found or invalid')
    })
  })

  describe('isMultiTenant', () => {
    it('should return true when multi-tenant is enabled', async () => {
      vi.doMock('#imports', () => ({
        useRuntimeConfig: vi.fn().mockReturnValue({
          multiTenant: { enabled: true },
        }),
      }))

      const { isMultiTenant } = await import('../../src/runtime/server/utils/tenant')

      const result = isMultiTenant()
      expect(result).toBe(true)
    })

    it('should return false when multi-tenant is disabled', async () => {
      vi.doMock('#imports', () => ({
        useRuntimeConfig: vi.fn().mockReturnValue({
          multiTenant: { enabled: false },
        }),
      }))

      const { isMultiTenant } = await import('../../src/runtime/server/utils/tenant')

      const result = isMultiTenant()
      expect(result).toBe(false)
    })
  })

  describe('getOrganizationByTenant', () => {
    it('should return organization when found', async () => {
      const { getOrganizationByTenant } = await import('../../src/runtime/server/utils/tenant')

      const result = await getOrganizationByTenant('test-org')
      expect(result).toEqual(mockOrganization)
    })

    it('should return null when organization not found', async () => {
      mockDatabase.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      })

      const { getOrganizationByTenant } = await import('../../src/runtime/server/utils/tenant')

      const result = await getOrganizationByTenant('nonexistent')
      expect(result).toBeNull()
    })

    it('should return null when database disabled', async () => {
      mockDatabaseUtils.isDatabaseFeatureEnabled.mockReturnValue(false)

      const { getOrganizationByTenant } = await import('../../src/runtime/server/utils/tenant')

      const result = await getOrganizationByTenant('test-org')
      expect(result).toBeNull()
    })
  })

  describe('getOrganizationById', () => {
    it('should return organization when found', async () => {
      const { getOrganizationById } = await import('../../src/runtime/server/utils/tenant')

      const result = await getOrganizationById('org-1')
      expect(result).toEqual(mockOrganization)
    })

    it('should return null when organization not found', async () => {
      mockDatabase.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      })

      const { getOrganizationById } = await import('../../src/runtime/server/utils/tenant')

      const result = await getOrganizationById('nonexistent')
      expect(result).toBeNull()
    })

    it('should return null when database disabled', async () => {
      mockDatabaseUtils.isDatabaseFeatureEnabled.mockReturnValue(false)

      const { getOrganizationById } = await import('../../src/runtime/server/utils/tenant')

      const result = await getOrganizationById('org-1')
      expect(result).toBeNull()
    })
  })

  describe('initializeTenantContext', () => {
    it('should initialize tenant context when tenant detected', async () => {
      vi.doMock('#imports', () => ({
        useRuntimeConfig: vi.fn().mockReturnValue({
          multiTenant: {
            enabled: true,
            strategy: 'subdomain',
          },
        }),
      }))

      const { initializeTenantContext, getTenantContext } = await import('../../src/runtime/server/utils/tenant')

      const event = createMockH3Event({
        headers: { host: 'test-org.example.com' },
      })

      await initializeTenantContext(event)

      const context = getTenantContext(event)
      expect(context).toBeDefined()
      expect(context?.organizationId).toBe('org-1')
    })

    it('should set default context when multi-tenant disabled', async () => {
      vi.doMock('#imports', () => ({
        useRuntimeConfig: vi.fn().mockReturnValue({
          multiTenant: { enabled: false },
        }),
      }))

      const { initializeTenantContext, getTenantContext } = await import('../../src/runtime/server/utils/tenant')

      await initializeTenantContext(mockEvent)

      const context = getTenantContext(mockEvent)
      expect(context).toEqual({
        organizationId: null,
        organization: null,
        strategy: 'subdomain',
      })
    })
  })

  describe('Edge Cases', () => {
    it('should handle malformed host headers', async () => {
      const { detectTenant } = await import('../../src/runtime/server/utils/tenant')

      vi.doMock('#imports', () => ({
        useRuntimeConfig: vi.fn().mockReturnValue({
          multiTenant: {
            enabled: true,
            strategy: 'subdomain',
          },
        }),
      }))

      const event = createMockH3Event({
        headers: { host: '...invalid...example.com' },
      })

      const result = await detectTenant(event)
      expect(result).toBeNull()
    })

    it('should handle missing host header', async () => {
      const { detectTenant } = await import('../../src/runtime/server/utils/tenant')

      vi.doMock('#imports', () => ({
        useRuntimeConfig: vi.fn().mockReturnValue({
          multiTenant: {
            enabled: true,
            strategy: 'subdomain',
          },
        }),
      }))

      const event = createMockH3Event({
        headers: {}, // No host header
      })

      const result = await detectTenant(event)
      expect(result).toBeNull()
    })

    it('should handle localhost development', async () => {
      const { detectTenant } = await import('../../src/runtime/server/utils/tenant')

      vi.doMock('#imports', () => ({
        useRuntimeConfig: vi.fn().mockReturnValue({
          multiTenant: {
            enabled: true,
            strategy: 'subdomain',
          },
        }),
      }))

      const event = createMockH3Event({
        headers: { host: 'localhost:3000' },
      })

      const result = await detectTenant(event)
      expect(result).toBeNull()
    })
  })
})
