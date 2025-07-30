import { vi } from 'vitest'
import type { H3Event } from 'h3'

// Mock environment variables
export const mockEnv = {
  NUXT_DATABASE_URL: 'sqlite:./test.db',
  NUXT_SESSION_PASSWORD: 'test-session-password-32-characters',
  NUXT_SUPER_ADMIN_LOGIN: 'admin@test.com',
  NUXT_SUPER_ADMIN_PASSWORD: 'SuperSecurePassword123!',
  NUXT_MULTI_TENANT_MODE: 'true',
  NUXT_TENANT_STRATEGY: 'subdomain',
  NUXT_TOTP_ISSUER: 'Test App',
  NUXT_AUTH_DEFAULT_LOCALE: 'en',
}

// Reset environment to defaults
export function resetMockEnv() {
  Object.entries(mockEnv).forEach(([key, value]) => {
    process.env[key] = value
  })
}

// Clear environment
export function clearMockEnv() {
  Object.keys(mockEnv).forEach((key) => {
    delete process.env[key]
  })
}

// Mock H3 Event
export function createMockH3Event(options: {
  url?: string
  method?: string
  headers?: Record<string, string>
  body?: any
  user?: any
} = {}): H3Event {
  const {
    url = '/',
    method = 'GET',
    headers = {},
    body = null,
    user = null,
  } = options

  const event = {
    node: {
      req: {
        url,
        method,
        headers: {
          'host': 'localhost:3000',
          'user-agent': 'test-agent',
          ...headers,
        },
        socket: {
          remoteAddress: '127.0.0.1',
        },
      },
      res: {
        statusCode: 200,
        setHeader: vi.fn(),
        writeHead: vi.fn(),
        end: vi.fn(),
      },
    },
    context: {
      user,
      tenant: null,
      session: null,
    },
    _handled: false,
  } as any

  return event
}

// Mock session data
export function createMockSession(overrides = {}) {
  return {
    id: `session-${Date.now()}`,
    user: null,
    secure: {},
    loggedInAt: new Date(),
    ...overrides,
  }
}

// Mock user session with RBAC data
export function createMockUserSession(overrides = {}) {
  return {
    id: `session-${Date.now()}`,
    user: {
      id: `user-${Date.now()}`,
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      organizationId: 'org-1',
      twoFactorEnabled: false,
      roles: [],
      ...overrides.user,
    },
    roles: [],
    permissions: [],
    loggedInAt: new Date(),
    secure: {},
    ...overrides,
  }
}

// Mock tenant context
export function createMockTenantContext(overrides = {}) {
  return {
    organizationId: 'org-1',
    organization: {
      id: 'org-1',
      name: 'Test Organization',
      slug: 'test-org',
      domain: 'test.example.com',
    },
    strategy: 'subdomain' as const,
    ...overrides,
  }
}

// Mock runtime config
export function createMockRuntimeConfig(overrides = {}) {
  return {
    session: {
      name: 'nuxt-session',
      password: mockEnv.NUXT_SESSION_PASSWORD,
      cookie: { sameSite: 'lax' },
    },
    database: {
      url: mockEnv.NUXT_DATABASE_URL,
      autoMigrate: true,
      enableLogging: false,
    },
    rbac: {
      enabled: true,
      defaultRole: 'user',
    },
    multiTenant: {
      enabled: true,
      strategy: 'subdomain',
      pathIndex: 0,
    },
    totp: {
      enabled: true,
      config: {
        issuer: mockEnv.NUXT_TOTP_ISSUER,
        keyLength: 32,
        window: 30,
        backupCodesCount: 10,
        backupCodeLength: 8,
      },
    },
    ui: {
      enabled: true,
      theme: {},
      i18n: true,
      defaultLocale: 'en',
    },
    hash: {
      scrypt: {},
    },
    oauth: {},
    ...overrides,
  }
}

// Mock Nuxt imports
export const mockNuxtImports = {
  useRuntimeConfig: vi.fn().mockImplementation(event => createMockRuntimeConfig()),
  useRequestFetch: vi.fn().mockImplementation(() => vi.fn()),
  navigateTo: vi.fn().mockResolvedValue(undefined),
  createError: vi.fn().mockImplementation(({ statusCode, statusMessage }) => {
    const error = new Error(statusMessage) as any
    error.statusCode = statusCode
    error.statusMessage = statusMessage
    return error
  }),
  useFetch: vi.fn().mockImplementation(() => ({
    data: { value: null },
    pending: { value: false },
    error: { value: null },
    refresh: vi.fn(),
  })),
  $fetch: vi.fn().mockResolvedValue({}),
  ref: vi.fn().mockImplementation(value => ({ value })),
  computed: vi.fn().mockImplementation(fn => ({ value: fn() })),
  reactive: vi.fn().mockImplementation(obj => obj),
  watch: vi.fn().mockImplementation(() => vi.fn()),
  onMounted: vi.fn().mockImplementation(fn => fn()),
  nextTick: vi.fn().mockResolvedValue(undefined),
}

// Mock H3 utilities
export const mockH3Utils = {
  getHeader: vi.fn().mockImplementation((event, name) => {
    return event.node.req.headers[name.toLowerCase()]
  }),
  setHeader: vi.fn(),
  readBody: vi.fn().mockResolvedValue({}),
  getQuery: vi.fn().mockReturnValue({}),
  getRouterParam: vi.fn().mockReturnValue(null),
  setCookie: vi.fn(),
  getCookie: vi.fn().mockReturnValue(null),
  deleteCookie: vi.fn(),
  sendRedirect: vi.fn(),
  setResponseStatus: vi.fn(),
  defineEventHandler: vi.fn().mockImplementation(handler => handler),
  defineNitroPlugin: vi.fn().mockImplementation(plugin => plugin),
  createError: vi.fn().mockImplementation(({ statusCode, statusMessage }) => {
    const error = new Error(statusMessage) as any
    error.statusCode = statusCode
    error.statusMessage = statusMessage
    return error
  }),
}

// Mock crypto functions
export const mockCrypto = {
  randomUUID: vi.fn().mockImplementation(() => `mock-uuid-${Date.now()}`),
  randomBytes: vi.fn().mockImplementation((size) => {
    const bytes = new Uint8Array(size)
    for (let i = 0; i < size; i++) {
      bytes[i] = Math.floor(Math.random() * 256)
    }
    return bytes
  }),
}

// Mock password utilities
export const mockPasswordUtils = {
  hashPassword: vi.fn().mockImplementation(async password => `hashed-${password}`),
  verifyPassword: vi.fn().mockImplementation(async (hash, password) => {
    return hash === `hashed-${password}`
  }),
}

// Test assertion helpers
export function expectMockToHaveBeenCalledWithUser(mockFn: any, userId: string) {
  expect(mockFn).toHaveBeenCalledWith(
    expect.objectContaining({
      user: expect.objectContaining({ id: userId }),
    }),
  )
}

export function expectMockToHaveBeenCalledWithTenant(mockFn: any, organizationId: string) {
  expect(mockFn).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({
      organizationId,
    }),
  )
}

export function expectPermissionCheck(mockFn: any, permission: string) {
  expect(mockFn).toHaveBeenCalledWith(
    expect.anything(),
    expect.stringMatching(permission),
  )
}

// Error creation helpers
export function createMockError(statusCode: number, message: string) {
  const error = new Error(message) as any
  error.statusCode = statusCode
  error.statusMessage = message
  return error
}

export function createDatabaseError(message = 'Database connection failed') {
  return new Error(message)
}

export function createValidationError(message = 'Validation failed') {
  const error = new Error(message) as any
  error.statusCode = 400
  error.statusMessage = message
  return error
}

// Mock setup and teardown
export function setupMocks() {
  resetMockEnv()

  // Mock all the modules
  vi.mock('uncrypto', () => mockCrypto)
  vi.mock('h3', () => mockH3Utils)
  vi.mock('#imports', () => mockNuxtImports)
}

// Setup global H3 mock
vi.mock('h3', () => mockH3Utils)

export function teardownMocks() {
  vi.clearAllMocks()
  clearMockEnv()
}
