import { vi } from 'vitest'

// Global setup for all tests
vi.mock('#imports', () => ({
  useRuntimeConfig: vi.fn().mockImplementation(() => ({
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
  })),
  createError: vi.fn().mockImplementation(({ statusCode, statusMessage }) => {
    const error = new Error(statusMessage) as any
    error.statusCode = statusCode
    error.statusMessage = statusMessage
    return error
  }),
  $fetch: vi.fn().mockResolvedValue({}),
  navigateTo: vi.fn().mockResolvedValue(undefined),
}))

// Mock main drizzle-orm module
vi.mock('drizzle-orm', () => ({
  sql: vi.fn().mockReturnValue('mock-sql'),
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
}))

// Mock SQLite core
vi.mock('drizzle-orm/sqlite-core', () => ({
  sqliteTable: vi.fn().mockImplementation((name, columns) => ({
    name,
    columns,
    _: { name },
  })),
  integer: vi.fn().mockImplementation((name) => {
    const col = { name, type: 'integer' }
    col.primaryKey = vi.fn().mockReturnValue(col)
    col.notNull = vi.fn().mockReturnValue(col)
    col.unique = vi.fn().mockReturnValue(col)
    col.default = vi.fn().mockReturnValue(col)
    col.$type = vi.fn().mockReturnValue(col)
    col.references = vi.fn().mockReturnValue(col)
    return col
  }),
  text: vi.fn().mockImplementation((name) => {
    const col = { name, type: 'text' }
    col.primaryKey = vi.fn().mockReturnValue(col)
    col.notNull = vi.fn().mockReturnValue(col)
    col.unique = vi.fn().mockReturnValue(col)
    col.default = vi.fn().mockReturnValue(col)
    col.$type = vi.fn().mockReturnValue(col)
    col.references = vi.fn().mockReturnValue(col)
    return col
  }),
  boolean: vi.fn().mockImplementation((name) => {
    const col = { name, type: 'boolean' }
    col.primaryKey = vi.fn().mockReturnValue(col)
    col.notNull = vi.fn().mockReturnValue(col)
    col.unique = vi.fn().mockReturnValue(col)
    col.default = vi.fn().mockReturnValue(col)
    col.$type = vi.fn().mockReturnValue(col)
    col.references = vi.fn().mockReturnValue(col)
    return col
  }),
  timestamp: vi.fn().mockImplementation((name) => {
    const col = { name, type: 'timestamp' }
    col.primaryKey = vi.fn().mockReturnValue(col)
    col.notNull = vi.fn().mockReturnValue(col)
    col.unique = vi.fn().mockReturnValue(col)
    col.default = vi.fn().mockReturnValue(col)
    col.$type = vi.fn().mockReturnValue(col)
    col.references = vi.fn().mockReturnValue(col)
    col.defaultNow = vi.fn().mockReturnValue(col)
    return col
  }),
  primaryKey: vi.fn().mockReturnValue({}),
  index: vi.fn().mockReturnValue({}),
  uniqueIndex: vi.fn().mockReturnValue({}),
}))

// Mock Drizzle ORM modules
vi.mock('drizzle-orm/better-sqlite3', () => ({
  drizzle: vi.fn().mockReturnValue({}),
}))

vi.mock('drizzle-orm/postgres-js', () => ({
  drizzle: vi.fn().mockReturnValue({}),
}))

vi.mock('drizzle-orm/mysql2', () => ({
  drizzle: vi.fn().mockReturnValue({}),
}))

// Mock migrators
vi.mock('drizzle-orm/better-sqlite3/migrator', () => ({
  migrate: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('drizzle-orm/postgres-js/migrator', () => ({
  migrate: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('drizzle-orm/mysql2/migrator', () => ({
  migrate: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('better-sqlite3', () => ({
  default: vi.fn().mockImplementation(() => ({})),
}))
vi.mock('postgres', () => ({
  default: vi.fn().mockReturnValue({}),
}))
vi.mock('mysql2/promise', () => ({
  createConnection: vi.fn().mockResolvedValue({}),
}))

// Mock TOTP libraries
vi.mock('otpauth', () => ({
  Secret: vi.fn().mockImplementation(() => ({
    base32: 'JBSWY3DPEHPK3PXP',
    buffer: Buffer.from('JBSWY3DPEHPK3PXP', 'ascii'),
  })),
  TOTP: vi.fn().mockImplementation(() => ({
    generate: vi.fn().mockReturnValue('123456'),
    validate: vi.fn().mockReturnValue(0),
    toString: vi.fn().mockReturnValue('otpauth://totp/Test:test@example.com?secret=JBSWY3DPEHPK3PXP'),
  })),
}))

vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,mock-qr-code'),
  },
  toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,mock-qr-code'),
}))

// Mock crypto functions
vi.mock('node:crypto', () => ({
  randomBytes: vi.fn().mockImplementation((size) => {
    const bytes = new Uint8Array(size)
    for (let i = 0; i < size; i++) {
      bytes[i] = Math.floor(Math.random() * 256)
    }
    return bytes
  }),
  createHash: vi.fn().mockReturnValue({
    update: vi.fn().mockReturnThis(),
    digest: vi.fn().mockReturnValue('mock-hash'),
  }),
}))

// Mock process.env defaults
process.env.NODE_ENV = 'test'
process.env.NUXT_SESSION_PASSWORD = 'test-session-password-32-characters-long'
process.env.NUXT_DATABASE_URL = 'sqlite:./test.db'
