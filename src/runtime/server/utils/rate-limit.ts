import type { H3Event } from 'h3'
import { createError, getClientIP } from 'h3'

interface RateLimitRule {
  windowMs: number // Time window in milliseconds
  maxAttempts: number // Maximum attempts per window
  skipSuccessfulRequests?: boolean // Don't count successful requests
  keyGenerator?: (event: H3Event) => string // Custom key generator
}

interface RateLimitEntry {
  count: number
  resetTime: number
}

// In-memory store for rate limiting (in production, use Redis or similar)
const rateLimitStore = new Map<string, RateLimitEntry>()

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key)
    }
  }
}, 5 * 60 * 1000)

/**
 * Create a rate limiter for authentication endpoints
 */
export function createRateLimit(rule: RateLimitRule) {
  return async (event: H3Event) => {
    const now = Date.now()
    const key = rule.keyGenerator ? rule.keyGenerator(event) : getDefaultKey(event)

    // Get or create rate limit entry
    let entry = rateLimitStore.get(key)

    if (!entry || entry.resetTime < now) {
      // Create new entry or reset expired one
      entry = {
        count: 0,
        resetTime: now + rule.windowMs,
      }
      rateLimitStore.set(key, entry)
    }

    // Check if limit exceeded
    if (entry.count >= rule.maxAttempts) {
      const remainingTime = Math.ceil((entry.resetTime - now) / 1000)
      throw createError({
        statusCode: 429,
        statusMessage: 'Too Many Requests',
        data: {
          retryAfter: remainingTime,
          limit: rule.maxAttempts,
          windowMs: rule.windowMs,
        },
      })
    }

    // Increment counter
    entry.count++

    return {
      remaining: rule.maxAttempts - entry.count,
      resetTime: entry.resetTime,
      limit: rule.maxAttempts,
    }
  }
}

/**
 * Pre-configured rate limiters for different authentication scenarios
 */
export const authRateLimiters = {
  // Strict rate limiting for login attempts
  login: createRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxAttempts: 5, // 5 attempts per 15 minutes
    keyGenerator: event => `login:${getClientIP(event) || 'unknown'}`,
  }),

  // More restrictive for super admin login
  superAdminLogin: createRateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    maxAttempts: 3, // 3 attempts per hour
    keyGenerator: event => `super-admin:${getClientIP(event) || 'unknown'}`,
  }),

  // 2FA verification attempts
  twoFactorVerification: createRateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxAttempts: 10, // 10 attempts per 5 minutes
    keyGenerator: event => `2fa:${getClientIP(event) || 'unknown'}`,
  }),

  // Password reset requests
  passwordReset: createRateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    maxAttempts: 3, // 3 attempts per hour
    keyGenerator: event => `password-reset:${getClientIP(event) || 'unknown'}`,
  }),

  // General API rate limiting
  api: createRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxAttempts: 100, // 100 requests per 15 minutes
    keyGenerator: event => `api:${getClientIP(event) || 'unknown'}`,
  }),
}

/**
 * Default key generator based on IP address
 */
function getDefaultKey(event: H3Event): string {
  const ip = getClientIP(event) || 'unknown'
  const userAgent = event.node.req.headers['user-agent'] || 'unknown'
  // Use IP as primary key, user-agent as secondary identifier
  return `${ip}:${Buffer.from(userAgent).toString('base64').slice(0, 10)}`
}

/**
 * Middleware wrapper for rate limiting
 */
export function withRateLimit(rateLimiter: ReturnType<typeof createRateLimit>) {
  return async (event: H3Event) => {
    await rateLimiter(event)
  }
}

/**
 * Clear rate limit for a specific key (useful for successful authentications)
 */
export function clearRateLimit(event: H3Event, prefix: string) {
  const key = `${prefix}:${getClientIP(event) || 'unknown'}`
  rateLimitStore.delete(key)
}

/**
 * Get current rate limit status
 */
export function getRateLimitStatus(event: H3Event, prefix: string): RateLimitEntry | null {
  const key = `${prefix}:${getClientIP(event) || 'unknown'}`
  return rateLimitStore.get(key) || null
}
