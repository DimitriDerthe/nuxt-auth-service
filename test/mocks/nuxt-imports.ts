import { vi } from 'vitest'

export const useRuntimeConfig = vi.fn().mockImplementation(() => ({
  session: {
    name: 'nuxt-session',
    password: 'test-session-password-32-characters',
    cookie: { sameSite: 'lax' },
  },
  database: {
    url: 'sqlite:./test.db',
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
      issuer: 'Test App',
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
}))

export const createError = vi.fn().mockImplementation(({ statusCode, statusMessage }) => {
  const error = new Error(statusMessage) as any
  error.statusCode = statusCode
  error.statusMessage = statusMessage
  return error
})

export const $fetch = vi.fn().mockResolvedValue({})
export const navigateTo = vi.fn().mockResolvedValue(undefined)
export const useFetch = vi.fn().mockImplementation(() => ({
  data: { value: null },
  pending: { value: false },
  error: { value: null },
  refresh: vi.fn(),
}))

export const ref = vi.fn().mockImplementation(value => ({ value }))
export const computed = vi.fn().mockImplementation(fn => ({ value: fn() }))
export const reactive = vi.fn().mockImplementation(obj => obj)
export const watch = vi.fn().mockImplementation(() => vi.fn())
export const onMounted = vi.fn().mockImplementation(fn => fn())
export const nextTick = vi.fn().mockResolvedValue(undefined)
