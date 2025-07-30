import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setupMocks, teardownMocks, createMockH3Event, createMockRuntimeConfig } from '../mocks/test-utils'
import {
  mockDatabase,
  mockDatabaseUtils,
  resetMockData,
  createMockUser,
} from '../mocks/database.mock'

// Mock the dependencies
vi.mock('../../src/runtime/server/utils/database', () => mockDatabaseUtils)
vi.mock('../../src/runtime/server/database/connection', () => ({
  schema: {
    users: { id: { name: 'id' }, twoFactorEnabled: { name: 'twoFactorEnabled' }, twoFactorSecret: { name: 'twoFactorSecret' } },
    recoveryCodes: { userId: { name: 'user_id' }, code: { name: 'code' }, used: { name: 'used' }, id: { name: 'id' } },
  },
  eq: vi.fn().mockImplementation((field, value) => ({ field, value, op: 'eq' })),
  and: vi.fn().mockImplementation((...conditions) => ({ conditions, op: 'and' })),
  sql: vi.fn().mockImplementation((strings, ...values) => ({
    queryChunks: strings,
    params: values,
    toString: () => 'count(*)',
  })),
}))
vi.mock('#imports', () => ({
  useRuntimeConfig: vi.fn().mockReturnValue(createMockRuntimeConfig()),
}))

// Mock otpauth library
const mockTOTP = {
  generate: vi.fn().mockReturnValue('123456'),
  validate: vi.fn().mockImplementation(({ token }) => {
    return token === '123456' ? 0 : null
  }),
  toString: vi.fn().mockReturnValue('otpauth://totp/Test:test@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Test'),
}

const mockSecret = {
  base32: 'JBSWY3DPEHPK3PXP',
  buffer: Buffer.from('JBSWY3DPEHPK3PXP', 'ascii'),
}

const mockSecretConstructor = vi.fn().mockImplementation(() => mockSecret)
mockSecretConstructor.fromBase32 = vi.fn().mockImplementation(base32 => mockSecret)

vi.mock('otpauth', () => ({
  Secret: mockSecretConstructor,
  TOTP: vi.fn().mockImplementation(() => mockTOTP),
}))

// Mock qrcode library
vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,mock-qr-code'),
  },
}))

// Mock crypto
vi.mock('node:crypto', () => ({
  randomBytes: vi.fn().mockImplementation((size) => {
    const bytes = new Uint8Array(size)
    for (let i = 0; i < size; i++) {
      bytes[i] = Math.floor(Math.random() * 256)
    }
    return bytes
  }),
}))

describe('TOTP Utils', () => {
  let mockUser: any
  let mockEvent: any

  beforeEach(() => {
    setupMocks()
    resetMockData()

    // Create test data
    mockUser = createMockUser({
      id: 'user-1',
      email: 'test@example.com',
      twoFactorEnabled: false,
      twoFactorSecret: null,
    })
    mockEvent = createMockH3Event({ user: mockUser })

    // Setup mock database responses
    mockDatabase.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([mockUser]),
        }),
      }),
    })

    mockDatabase.insert.mockReturnValue({
      values: vi.fn().mockResolvedValue([]),
    })

    mockDatabase.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ ...mockUser, twoFactorEnabled: true }]),
      }),
    })

    mockDatabase.delete.mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
    })

    // Reset mock implementations
    mockTOTP.validate.mockImplementation(({ token }) => {
      return token === '123456' ? 0 : null
    })
    vi.clearAllMocks()
  })

  afterEach(() => {
    teardownMocks()
  })

  describe('generateTOTPSecret', () => {
    it('should generate TOTP secret with QR code', async () => {
      const { generateTOTPSecret } = await import('../../src/runtime/server/utils/totp')

      const result = await generateTOTPSecret('user-1', 'test@example.com')

      expect(result).toEqual({
        secret: 'JBSWY3DPEHPK3PXP',
        qrCode: 'data:image/png;base64,mock-qr-code',
        uri: 'otpauth://totp/Test:test@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Test',
        backupCodes: expect.arrayContaining([
          expect.stringMatching(/^[A-Z0-9]{8}$/),
        ]),
      })
      expect(result.backupCodes).toHaveLength(10)
    })

    it('should use custom issuer from config', async () => {
      // Mock the TOTP toString to include custom issuer
      mockTOTP.toString.mockReturnValue('otpauth://totp/Custom%20App:test@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Custom%20App')

      vi.doMock('#imports', () => ({
        useRuntimeConfig: vi.fn().mockReturnValue({
          ...createMockRuntimeConfig(),
          totp: {
            enabled: true,
            config: {
              issuer: 'Custom App',
              keyLength: 32,
              window: 30,
              backupCodesCount: 10,
              backupCodeLength: 8,
            },
          },
        }),
      }))

      const { generateTOTPSecret } = await import('../../src/runtime/server/utils/totp')

      const result = await generateTOTPSecret('user-1', 'test@example.com')

      expect(result.uri).toContain('issuer=Custom%20App')
    })

    it('should generate unique backup codes', async () => {
      const { generateTOTPSecret } = await import('../../src/runtime/server/utils/totp')

      const result = await generateTOTPSecret('user-1', 'test@example.com')
      const uniqueCodes = new Set(result.backupCodes)

      expect(uniqueCodes.size).toBe(result.backupCodes.length)
    })

    it('should handle QR code generation errors', async () => {
      const qrcode = await import('qrcode')
      vi.mocked(qrcode.default.toDataURL).mockRejectedValue(new Error('QR generation failed'))

      const { generateTOTPSecret } = await import('../../src/runtime/server/utils/totp')

      await expect(generateTOTPSecret('user-1', 'test@example.com'))
        .rejects.toThrow('QR generation failed')
    })
  })

  describe('verifyTOTPCode', () => {
    it('should verify valid TOTP code', async () => {
      const { verifyTOTPCode } = await import('../../src/runtime/server/utils/totp')

      const result = await verifyTOTPCode('JBSWY3DPEHPK3PXP', '123456')

      expect(result).toBe(true)
      expect(mockTOTP.validate).toHaveBeenCalledWith({ token: '123456', window: 1 })
    })

    it('should reject invalid TOTP code', async () => {
      const { verifyTOTPCode } = await import('../../src/runtime/server/utils/totp')

      const result = await verifyTOTPCode('JBSWY3DPEHPK3PXP', '000000')

      expect(result).toBe(false)
    })

    it('should use custom time window', async () => {
      const { verifyTOTPCode } = await import('../../src/runtime/server/utils/totp')

      await verifyTOTPCode('JBSWY3DPEHPK3PXP', '123456', 2)

      expect(mockTOTP.validate).toHaveBeenCalledWith({ token: '123456', window: 2 })
    })

    it('should handle verification errors', async () => {
      mockTOTP.validate.mockImplementation(() => {
        throw new Error('TOTP validation error')
      })

      const { verifyTOTPCode } = await import('../../src/runtime/server/utils/totp')

      const result = await verifyTOTPCode('JBSWY3DPEHPK3PXP', '123456')

      expect(result).toBe(false)
    })
  })

  describe('enable2FA', () => {
    it('should enable 2FA with valid token', async () => {
      const { enable2FA } = await import('../../src/runtime/server/utils/totp')

      const result = await enable2FA('user-1', 'JBSWY3DPEHPK3PXP', '123456', ['CODE1', 'CODE2'])

      expect(result).toBe(true)
      expect(mockDatabase.update).toHaveBeenCalled()
      expect(mockDatabase.insert).toHaveBeenCalled() // For backup codes
    })

    it('should fail with invalid token', async () => {
      const { enable2FA } = await import('../../src/runtime/server/utils/totp')

      const result = await enable2FA('user-1', 'JBSWY3DPEHPK3PXP', '000000', ['CODE1', 'CODE2'])

      expect(result).toBe(false)
    })

    it('should handle database transaction errors', async () => {
      mockDatabase.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockRejectedValue(new Error('Database error')),
        }),
      })

      const { enable2FA } = await import('../../src/runtime/server/utils/totp')

      const result = await enable2FA('user-1', 'JBSWY3DPEHPK3PXP', '123456', ['CODE1'])

      expect(result).toBe(false)
    })

    it('should return false when database disabled', async () => {
      mockDatabaseUtils.isDatabaseFeatureEnabled.mockReturnValue(false)

      const { enable2FA } = await import('../../src/runtime/server/utils/totp')

      await expect(enable2FA('user-1', 'JBSWY3DPEHPK3PXP', '123456', ['CODE1']))
        .rejects.toThrow('2FA requires database configuration')
    })
  })

  describe('disable2FA', () => {
    it('should disable 2FA successfully', async () => {
      const { disable2FA } = await import('../../src/runtime/server/utils/totp')

      const result = await disable2FA('user-1')

      expect(result).toBe(true)
      expect(mockDatabase.update).toHaveBeenCalled()
      expect(mockDatabase.delete).toHaveBeenCalled() // Remove backup codes
    })

    it('should handle database errors', async () => {
      mockDatabase.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockRejectedValue(new Error('Database error')),
        }),
      })

      const { disable2FA } = await import('../../src/runtime/server/utils/totp')

      const result = await disable2FA('user-1')

      expect(result).toBe(false)
    })

    it('should return false when database disabled', async () => {
      mockDatabaseUtils.isDatabaseFeatureEnabled.mockReturnValue(false)

      const { disable2FA } = await import('../../src/runtime/server/utils/totp')

      const result = await disable2FA('user-1')

      expect(result).toBe(false)
    })
  })

  describe('verify2FA', () => {
    it('should verify valid TOTP code', async () => {
      const userWith2FA = createMockUser({
        id: 'user-1',
        twoFactorEnabled: true,
        twoFactorSecret: 'JBSWY3DPEHPK3PXP',
      })

      mockDatabase.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([userWith2FA]),
          }),
        }),
      })

      const { verify2FA } = await import('../../src/runtime/server/utils/totp')

      const result = await verify2FA('user-1', '123456')

      expect(result).toEqual({
        isValid: true,
      })
    })

    it('should verify valid backup code', async () => {
      const userWith2FA = createMockUser({
        id: 'user-1',
        twoFactorEnabled: true,
        twoFactorSecret: 'JBSWY3DPEHPK3PXP',
      })

      // Mock user query
      mockDatabase.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([userWith2FA]),
          }),
        }),
      })

      // Mock backup code query
      mockDatabase.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: 'code-1', code: 'BACKUP1', used: false }]),
          }),
        }),
      })

      // Mock update for marking backup code as used
      mockDatabase.update.mockReturnValueOnce({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      })

      // Mock remaining codes count
      mockDatabase.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { count: 5 },
          ]),
        }),
      })

      const { verify2FA } = await import('../../src/runtime/server/utils/totp')

      const result = await verify2FA('user-1', 'BACKUP1')

      expect(result).toEqual({
        isValid: true,
        isBackupCode: true,
        remainingBackupCodes: 5,
      })
    })

    it('should reject invalid code', async () => {
      const userWith2FA = createMockUser({
        id: 'user-1',
        twoFactorEnabled: true,
        twoFactorSecret: 'JBSWY3DPEHPK3PXP',
      })

      // Mock user query
      mockDatabase.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([userWith2FA]),
          }),
        }),
      })

      // Mock empty backup code query (no backup code found)
      mockDatabase.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      })

      const { verify2FA } = await import('../../src/runtime/server/utils/totp')

      const result = await verify2FA('user-1', '000000')

      expect(result).toEqual({
        isValid: false,
      })
    })

    it('should reject code for user without 2FA', async () => {
      const { verify2FA } = await import('../../src/runtime/server/utils/totp')

      const result = await verify2FA('user-1', '123456')

      expect(result).toEqual({
        isValid: false,
      })
    })

    it('should reject used backup code', async () => {
      const userWith2FA = createMockUser({
        id: 'user-1',
        twoFactorEnabled: true,
        twoFactorSecret: 'JBSWY3DPEHPK3PXP',
      })

      // Mock user query
      mockDatabase.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([userWith2FA]),
          }),
        }),
      })

      // Mock backup code query - should return empty since query filters for unused codes
      mockDatabase.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]), // No unused backup code found
          }),
        }),
      })

      const { verify2FA } = await import('../../src/runtime/server/utils/totp')

      const result = await verify2FA('user-1', 'BACKUP1')

      expect(result).toEqual({
        isValid: false,
      })
    })

    it('should handle database errors', async () => {
      mockDatabase.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockRejectedValue(new Error('Database error')),
          }),
        }),
      })

      const { verify2FA } = await import('../../src/runtime/server/utils/totp')

      const result = await verify2FA('user-1', '123456')

      expect(result).toEqual({
        isValid: false,
      })
    })

    it('should return false when database disabled', async () => {
      mockDatabaseUtils.isDatabaseFeatureEnabled.mockReturnValue(false)

      const { verify2FA } = await import('../../src/runtime/server/utils/totp')

      const result = await verify2FA('user-1', '123456')

      expect(result).toEqual({
        isValid: false,
      })
    })
  })

  describe('generateNewBackupCodes', () => {
    it('should generate new backup codes', async () => {
      const { generateNewBackupCodes } = await import('../../src/runtime/server/utils/totp')

      const result = await generateNewBackupCodes('user-1')

      expect(result).toHaveLength(10)
      expect(result[0]).toMatch(/^[A-Z0-9]{8}$/)
      expect(mockDatabase.delete).toHaveBeenCalled() // Remove old codes
      expect(mockDatabase.insert).toHaveBeenCalled() // Insert new codes
    })

    it('should generate custom number of codes', async () => {
      const { generateNewBackupCodes } = await import('../../src/runtime/server/utils/totp')

      const result = await generateNewBackupCodes('user-1', 5)

      expect(result).toHaveLength(5)
    })

    it('should generate codes with custom length', async () => {
      const { generateNewBackupCodes } = await import('../../src/runtime/server/utils/totp')

      const result = await generateNewBackupCodes('user-1', 10, 12)

      expect(result[0]).toMatch(/^[A-Z0-9]{12}$/)
    })

    it('should replace existing backup codes', async () => {
      const { generateNewBackupCodes } = await import('../../src/runtime/server/utils/totp')

      await generateNewBackupCodes('user-1')

      expect(mockDatabase.delete).toHaveBeenCalled()
    })

    it('should handle database errors', async () => {
      mockDatabase.delete.mockReturnValue({
        where: vi.fn().mockRejectedValue(new Error('Database error')),
      })

      const { generateNewBackupCodes } = await import('../../src/runtime/server/utils/totp')

      await expect(generateNewBackupCodes('user-1'))
        .rejects.toThrow('Failed to generate backup codes')
    })

    it('should return empty array when database disabled', async () => {
      mockDatabaseUtils.isDatabaseFeatureEnabled.mockReturnValue(false)

      const { generateNewBackupCodes } = await import('../../src/runtime/server/utils/totp')

      await expect(generateNewBackupCodes('user-1'))
        .rejects.toThrow('Backup codes require database configuration')
    })
  })

  describe('getBackupCodesCount', () => {
    it('should return count of unused backup codes', async () => {
      const mockSelectQuery = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 2 }]),
        }),
      }
      mockDatabase.select.mockReturnValue(mockSelectQuery)

      const { getBackupCodesCount } = await import('../../src/runtime/server/utils/totp')

      const result = await getBackupCodesCount('user-1')

      expect(result).toBe(2)
    })

    it('should return 0 when no backup codes', async () => {
      mockDatabase.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }]),
        }),
      })

      const { getBackupCodesCount } = await import('../../src/runtime/server/utils/totp')

      const result = await getBackupCodesCount('user-1')

      expect(result).toBe(0)
    })

    it('should handle database errors', async () => {
      mockDatabase.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockRejectedValue(new Error('Database error')),
        }),
      })

      const { getBackupCodesCount } = await import('../../src/runtime/server/utils/totp')

      const result = await getBackupCodesCount('user-1')

      expect(result).toBe(0)
    })

    it('should return 0 when database disabled', async () => {
      mockDatabaseUtils.isDatabaseFeatureEnabled.mockReturnValue(false)

      const { getBackupCodesCount } = await import('../../src/runtime/server/utils/totp')

      const result = await getBackupCodesCount('user-1')

      expect(result).toBe(0)
    })
  })

  describe('is2FAEnabled', () => {
    it('should return true for user with 2FA enabled', async () => {
      const userWith2FA = createMockUser({
        id: 'user-1',
        twoFactorEnabled: true,
      })

      mockDatabase.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([userWith2FA]),
          }),
        }),
      })

      const { is2FAEnabled } = await import('../../src/runtime/server/utils/totp')

      const result = await is2FAEnabled('user-1')

      expect(result).toBe(true)
    })

    it('should return false for user with 2FA disabled', async () => {
      const { is2FAEnabled } = await import('../../src/runtime/server/utils/totp')

      const result = await is2FAEnabled('user-1')

      expect(result).toBe(false)
    })

    it('should return false for non-existent user', async () => {
      mockDatabase.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      })

      const { is2FAEnabled } = await import('../../src/runtime/server/utils/totp')

      const result = await is2FAEnabled('nonexistent')

      expect(result).toBe(false)
    })

    it('should handle database errors', async () => {
      mockDatabase.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockRejectedValue(new Error('Database error')),
          }),
        }),
      })

      const { is2FAEnabled } = await import('../../src/runtime/server/utils/totp')

      const result = await is2FAEnabled('user-1')

      expect(result).toBe(false)
    })

    it('should return false when database disabled', async () => {
      mockDatabaseUtils.isDatabaseFeatureEnabled.mockReturnValue(false)

      const { is2FAEnabled } = await import('../../src/runtime/server/utils/totp')

      const result = await is2FAEnabled('user-1')

      expect(result).toBe(false)
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty secret', async () => {
      // Mock the Secret.fromBase32 to throw for empty string
      const { Secret } = await import('otpauth')
      vi.mocked(Secret.fromBase32).mockImplementation((base32) => {
        if (!base32) throw new Error('Invalid base32')
        return mockSecret
      })

      const { verifyTOTPCode } = await import('../../src/runtime/server/utils/totp')

      const result = await verifyTOTPCode('', '123456')

      expect(result).toBe(false)
    })

    it('should handle empty token', async () => {
      const { verifyTOTPCode } = await import('../../src/runtime/server/utils/totp')

      const result = await verifyTOTPCode('JBSWY3DPEHPK3PXP', '')

      expect(result).toBe(false)
    })
  })
})
