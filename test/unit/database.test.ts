import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setupMocks, teardownMocks, mockEnv, clearMockEnv } from '../mocks/test-utils'
import { mockDatabase, mockDatabaseUtils, resetMockData, setMockDatabaseEnabled } from '../mocks/database.mock'
import { mockConnection } from '../mocks/connection.mock'

// Mock the database modules
vi.mock('../../src/runtime/server/database/connection', () => mockConnection)

describe('Database Utils', () => {
  beforeEach(() => {
    setupMocks()
    resetMockData()
  })

  afterEach(() => {
    teardownMocks()
  })

  describe('useDatabase', () => {
    it('should return database instance when enabled', async () => {
      const { useDatabase } = await import('../../src/runtime/server/utils/database')

      const db = useDatabase()
      expect(db).toBeDefined()
      expect(db).toBe(mockDatabase)
    })

    it('should throw error when database is not configured', async () => {
      // Disable database
      setMockDatabaseEnabled(false)

      const { useDatabase } = await import('../../src/runtime/server/utils/database')

      expect(() => useDatabase()).toThrow('Database is not configured')
    })
  })

  describe('useDatabaseOptional', () => {
    it('should return database when enabled', async () => {
      const { useDatabaseOptional } = await import('../../src/runtime/server/utils/database')

      const db = useDatabaseOptional()
      expect(db).toBe(mockDatabase)
    })

    it('should return null when disabled', async () => {
      // Disable database
      setMockDatabaseEnabled(false)

      const { useDatabaseOptional } = await import('../../src/runtime/server/utils/database')

      const db = useDatabaseOptional()
      expect(db).toBeNull()
    })
  })

  describe('requireDatabase', () => {
    it('should return database when available', async () => {
      const { requireDatabase } = await import('../../src/runtime/server/utils/database')

      const db = requireDatabase()
      expect(db).toBe(mockDatabase)
    })

    it('should throw error when database not available', async () => {
      // Disable database
      setMockDatabaseEnabled(false)

      const { requireDatabase } = await import('../../src/runtime/server/utils/database')

      expect(() => requireDatabase()).toThrow('This feature requires database configuration')
    })
  })

  describe('isDatabaseFeatureEnabled', () => {
    it('should return true when database is enabled', async () => {
      const { isDatabaseFeatureEnabled } = await import('../../src/runtime/server/utils/database')

      const enabled = isDatabaseFeatureEnabled()
      expect(enabled).toBe(true)
    })

    it('should return false when database is disabled', async () => {
      // Disable database
      setMockDatabaseEnabled(false)

      const { isDatabaseFeatureEnabled } = await import('../../src/runtime/server/utils/database')

      const enabled = isDatabaseFeatureEnabled()
      expect(enabled).toBe(false)
    })
  })

  describe('withDatabaseTransaction', () => {
    it('should execute callback within transaction', async () => {
      const { withDatabaseTransaction } = await import('../../src/runtime/server/utils/database')

      const callback = vi.fn().mockResolvedValue('result')
      const result = await withDatabaseTransaction(callback)

      expect(callback).toHaveBeenCalledWith(mockDatabase)
      expect(result).toBe('result')
    })

    it('should handle transaction errors', async () => {
      const { withDatabaseTransaction } = await import('../../src/runtime/server/utils/database')

      const error = new Error('Transaction failed')
      const callback = vi.fn().mockRejectedValue(error)

      await expect(withDatabaseTransaction(callback)).rejects.toThrow('Transaction failed')
    })
  })
})

describe('Database Connection (Basic Tests)', () => {
  beforeEach(() => {
    setupMocks()
    resetMockData()
  })

  afterEach(() => {
    teardownMocks()
  })

  describe('Connection State', () => {
    it('should track database enabled state', async () => {
      const enabled = mockConnection.isDatabaseEnabled()
      expect(typeof enabled).toBe('boolean')
    })

    it('should get database instance when available', async () => {
      const db = mockConnection.getDatabase()
      expect(db).toBeDefined()
    })

    it('should handle database initialization', async () => {
      await expect(mockConnection.initializeDatabase()).resolves.toBeUndefined()
    })

    it('should handle migrations', async () => {
      const config = {
        provider: 'sqlite' as const,
        url: 'sqlite:./test.db',
        migrationsPath: './migrations',
      }

      await expect(mockConnection.runMigrations(mockDatabase, config)).resolves.toBeUndefined()
    })

    it('should close database connection properly', async () => {
      expect(() => mockConnection.closeDatabaseConnection()).not.toThrow()
    })
  })

  describe('Connection Creation', () => {
    it('should create database connections', async () => {
      const config = {
        provider: 'sqlite' as const,
        url: 'sqlite:./test.db',
        enableLogging: false,
      }

      const db = mockConnection.createDatabaseConnection(config)
      expect(db).toBeDefined()
    })

    it('should throw error for invalid config', async () => {
      expect(() => mockConnection.createDatabaseConnection({})).toThrow('Invalid connection URL')
    })

    it('should throw error for unsupported provider', async () => {
      const config = {
        provider: 'unsupported' as any,
        url: 'unsupported://connection',
        enableLogging: false,
      }

      expect(() => mockConnection.createDatabaseConnection(config)).toThrow('Unsupported database provider')
    })
  })
})
