import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setupMocks, teardownMocks, createMockRuntimeConfig } from '../mocks/test-utils'

// Mock @adonisjs/hash
const mockHash = {
  make: vi.fn().mockImplementation(async password => `$scrypt$hashed-${password}`),
  verify: vi.fn().mockImplementation(async (hash, password) => {
    return hash === `$scrypt$hashed-${password}`
  }),
}

const mockScryptDriver = vi.fn().mockImplementation(() => ({}))

vi.mock('@adonisjs/hash', () => ({
  Hash: vi.fn().mockImplementation(() => mockHash),
}))

vi.mock('@adonisjs/hash/drivers/scrypt', () => ({
  Scrypt: mockScryptDriver,
}))

vi.mock('#imports', () => ({
  useRuntimeConfig: vi.fn().mockReturnValue(createMockRuntimeConfig()),
}))

describe('Password Utils', () => {
  beforeEach(() => {
    setupMocks()
    vi.clearAllMocks()

    // Reset mock implementations
    mockHash.make.mockImplementation(async password => `$scrypt$hashed-${password}`)
    mockHash.verify.mockImplementation(async (hash, password) => {
      return hash === `$scrypt$hashed-${password}`
    })
  })

  afterEach(() => {
    teardownMocks()
  })

  describe('hashPassword', () => {
    it('should hash password using scrypt', async () => {
      const { hashPassword } = await import('../../src/runtime/server/utils/password')

      const hash = await hashPassword('mypassword123')

      expect(hash).toBe('$scrypt$hashed-mypassword123')
      expect(mockHash.make).toHaveBeenCalledWith('mypassword123')
    })

    it('should handle different password types', async () => {
      const { hashPassword } = await import('../../src/runtime/server/utils/password')

      const passwords = [
        'simple',
        'Complex123!',
        'с кириллицей',
        '🔒 with emoji',
      ]

      for (const password of passwords) {
        const hash = await hashPassword(password)
        expect(hash).toBe(`$scrypt$hashed-${password}`)
      }
    })

    it('should handle hashing errors gracefully', async () => {
      mockHash.make.mockRejectedValue(new Error('Hashing failed'))

      const { hashPassword } = await import('../../src/runtime/server/utils/password')

      await expect(hashPassword('password'))
        .rejects.toThrow('Hashing failed')
    })

    it('should handle very long passwords', async () => {
      const { hashPassword } = await import('../../src/runtime/server/utils/password')

      const longPassword = 'a'.repeat(1000)
      const hash = await hashPassword(longPassword)

      expect(hash).toBe(`$scrypt$hashed-${longPassword}`)
    })
  })

  describe('verifyPassword', () => {
    it('should verify correct password', async () => {
      const { verifyPassword } = await import('../../src/runtime/server/utils/password')

      const isValid = await verifyPassword('$scrypt$hashed-mypassword123', 'mypassword123')

      expect(isValid).toBe(true)
      expect(mockHash.verify).toHaveBeenCalledWith('$scrypt$hashed-mypassword123', 'mypassword123')
    })

    it('should reject incorrect password', async () => {
      const { verifyPassword } = await import('../../src/runtime/server/utils/password')

      const isValid = await verifyPassword('$scrypt$hashed-mypassword123', 'wrongpassword')

      expect(isValid).toBe(false)
    })

    it('should handle verification errors gracefully', async () => {
      mockHash.verify.mockRejectedValue(new Error('Verification failed'))

      const { verifyPassword } = await import('../../src/runtime/server/utils/password')

      await expect(verifyPassword('hash', 'password'))
        .rejects.toThrow('Verification failed')
    })

    it('should verify different character sets', async () => {
      const { verifyPassword } = await import('../../src/runtime/server/utils/password')

      const testCases = [
        { hash: '$scrypt$hashed-simple', password: 'simple' },
        { hash: '$scrypt$hashed-Complex123!', password: 'Complex123!' },
        { hash: '$scrypt$hashed-с кириллицей', password: 'с кириллицей' },
        { hash: '$scrypt$hashed-🔒 with emoji', password: '🔒 with emoji' },
      ]

      for (const { hash, password } of testCases) {
        const isValid = await verifyPassword(hash, password)
        expect(isValid).toBe(true)
      }
    })
  })

  describe('Edge Cases', () => {
    it('should handle password with only whitespace', async () => {
      const { hashPassword } = await import('../../src/runtime/server/utils/password')

      const whitespacePassword = '   \t\n   '
      const hash = await hashPassword(whitespacePassword)

      expect(hash).toBe(`$scrypt$hashed-${whitespacePassword}`)
    })

    it('should handle passwords with control characters', async () => {
      const { hashPassword } = await import('../../src/runtime/server/utils/password')

      const controlCharPassword = 'password\x00\x01\x02'
      const hash = await hashPassword(controlCharPassword)

      expect(hash).toBe(`$scrypt$hashed-${controlCharPassword}`)
    })

    it('should handle concurrent hashing operations', async () => {
      const { hashPassword } = await import('../../src/runtime/server/utils/password')

      const passwords = Array.from({ length: 5 }, (_, i) => `password${i}`)
      const promises = passwords.map(p => hashPassword(p))

      const hashes = await Promise.all(promises)

      expect(hashes).toHaveLength(5)
      hashes.forEach((hash, i) => {
        expect(hash).toBe(`$scrypt$hashed-password${i}`)
      })
    })

    it('should handle concurrent verification operations', async () => {
      const { verifyPassword } = await import('../../src/runtime/server/utils/password')

      const testCases = Array.from({ length: 5 }, (_, i) => ({
        hash: `$scrypt$hashed-password${i}`,
        password: `password${i}`,
      }))

      const promises = testCases.map(({ hash, password }) =>
        verifyPassword(hash, password),
      )

      const results = await Promise.all(promises)

      expect(results).toHaveLength(5)
      results.forEach((result) => {
        expect(result).toBe(true)
      })
    })
  })
})
