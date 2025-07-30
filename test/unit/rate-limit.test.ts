import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createRateLimit, authRateLimiters } from '../../src/runtime/server/utils/rate-limit'

// Generate unique IP for each test to avoid store collisions
let testCounter = 0
function getUniqueTestIP() {
  return `192.168.1.${++testCounter}`
}

// Mock getClientIP from h3
vi.mock('h3', async () => {
  const actual = await vi.importActual('h3')
  return {
    ...actual,
    getClientIP: vi.fn((event: any) => event.node?.req?.headers?.['x-forwarded-for'] || event.node?.req?.socket?.remoteAddress || '127.0.0.1'),
    createError: vi.fn((error: any) => {
      const err = new Error(error.statusMessage || 'Error')
      ;(err as any).statusCode = error.statusCode
      return err // Return the error, let the rate limit function throw it
    }),
  }
})

// Mock H3Event
const mockEvent = (ip = '127.0.0.1', userAgent = 'test-agent') => ({
  node: {
    req: {
      headers: {
        'user-agent': userAgent,
        'x-forwarded-for': ip,
      },
      socket: { remoteAddress: ip },
    },
  },
}) as any

describe('Rate Limiting', () => {
  beforeEach(() => {
    // Setup fake timers for consistent timing
    vi.useFakeTimers()
    // Clear rate limit store between tests
    vi.clearAllMocks()
  })

  afterEach(() => {
    // Restore real timers and mocks
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('createRateLimit', () => {
    it('should allow requests within limit', async () => {
      const rateLimit = createRateLimit({
        windowMs: 60000, // 1 minute
        maxAttempts: 3,
      })

      const event = mockEvent()

      // First request should succeed
      const result = await rateLimit(event)
      expect(result.remaining).toBe(2)
      expect(result.limit).toBe(3)
    })

    it('should block requests when limit exceeded', async () => {
      const rateLimit = createRateLimit({
        windowMs: 60000,
        maxAttempts: 2,
      })

      const event = mockEvent(getUniqueTestIP())

      // Use up the limit
      await rateLimit(event) // First request - should succeed
      await rateLimit(event) // Second request - should succeed

      // Third request should be blocked - use expect.rejects
      await expect(rateLimit(event)).rejects.toThrow('Too Many Requests')
    })

    it('should reset limit after window expires', async () => {
      const rateLimit = createRateLimit({
        windowMs: 100, // 100ms window
        maxAttempts: 1,
      })

      const event = mockEvent(getUniqueTestIP())

      // Use up the limit
      await rateLimit(event) // First request - should succeed

      // Should be blocked immediately
      await expect(rateLimit(event)).rejects.toThrow('Too Many Requests')

      // Advance time past window expiration using fake timers
      vi.advanceTimersByTime(150)

      // Should work again
      const result = await rateLimit(event)
      expect(result.remaining).toBe(0)
    })

    it('should use custom key generator', async () => {
      const rateLimit = createRateLimit({
        windowMs: 60000,
        maxAttempts: 1,
        keyGenerator: () => 'custom-key',
      })

      const event1 = mockEvent('1.1.1.1')
      const event2 = mockEvent('2.2.2.2')

      // Both events should use the same key, so second should be blocked
      await rateLimit(event1)
      await expect(rateLimit(event2)).rejects.toThrow('Too Many Requests')
    })
  })

  describe('Auth Rate Limiters', () => {
    it('should have stricter limits for super admin login', async () => {
      const event = mockEvent()

      // Super admin should have fewer attempts
      for (let i = 0; i < 3; i++) {
        await authRateLimiters.superAdminLogin(event)
      }

      // Fourth attempt should be blocked
      await expect(authRateLimiters.superAdminLogin(event)).rejects.toThrow('Too Many Requests')
    })

    it('should allow more attempts for regular login', async () => {
      const event = mockEvent()

      // Regular login should allow more attempts
      for (let i = 0; i < 5; i++) {
        await authRateLimiters.login(event)
      }

      // Sixth attempt should be blocked
      await expect(authRateLimiters.login(event)).rejects.toThrow('Too Many Requests')
    })
  })

  describe('Different IPs', () => {
    it('should track different IPs separately', async () => {
      const rateLimit = createRateLimit({
        windowMs: 60000,
        maxAttempts: 1,
      })

      const event1 = mockEvent('1.1.1.1')
      const event2 = mockEvent('2.2.2.2')

      // Both IPs should be able to make one request
      await rateLimit(event1)
      await rateLimit(event2)

      // But second request from same IP should be blocked
      await expect(rateLimit(event1)).rejects.toThrow('Too Many Requests')
    })
  })
})
