import { randomBytes } from 'node:crypto'

// Polyfill for timingSafeEqual since it might not be available in all environments
function timingSafeEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) {
    return false
  }

  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i]
  }

  return result === 0
}

/**
 * Constant-time string comparison to prevent timing attacks
 * This function always takes the same amount of time regardless of input
 */
export function secureCompare(a: string, b: string): boolean {
  // For simple constant-time comparison, we can use a simpler approach
  if (a.length !== b.length) {
    return false
  }

  // Perform byte-by-byte comparison in constant time
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }

  return result === 0
}

/**
 * Secure password verification with constant-time comparison
 * Includes artificial delay to further prevent timing attacks
 */
export async function securePasswordVerify(hashedPassword: string, plainPassword: string): Promise<boolean> {
  const startTime = Date.now()

  try {
    const { verifyPassword } = await import('./password')
    const isValid = await verifyPassword(hashedPassword, plainPassword)

    // Ensure minimum execution time to prevent timing attacks
    const minExecutionTime = 100 // 100ms minimum
    const elapsedTime = Date.now() - startTime

    if (elapsedTime < minExecutionTime) {
      await new Promise(resolve => setTimeout(resolve, minExecutionTime - elapsedTime))
    }

    return isValid
  }
  catch (error) {
    // Ensure consistent timing even on error
    const minExecutionTime = 100
    const elapsedTime = Date.now() - startTime

    if (elapsedTime < minExecutionTime) {
      await new Promise(resolve => setTimeout(resolve, minExecutionTime - elapsedTime))
    }

    return false
  }
}

/**
 * Generate cryptographically secure random session token
 */
export function generateSecureToken(length: number = 32): string {
  const bytes = randomBytes(length)
  // Convert to base64url manually to ensure compatibility
  const base64 = Buffer.from(bytes).toString('base64')
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

/**
 * Validate session token entropy
 */
export function validateTokenEntropy(token: string): boolean {
  // Check minimum length
  if (token.length < 32) {
    return false
  }

  // Check for base64url format
  const base64urlRegex = /^[\w-]+$/
  if (!base64urlRegex.test(token)) {
    return false
  }

  // Calculate entropy (simplified check)
  const uniqueChars = new Set(token).size
  const expectedEntropy = Math.log2(64) * token.length // 64 possible chars in base64url
  const actualEntropy = Math.log2(uniqueChars) * token.length

  // Require at least 80% of expected entropy
  return actualEntropy >= expectedEntropy * 0.8
}

/**
 * Secure random delay to prevent timing attacks on failed authentication
 */
export async function secureDelay(baseDelayMs: number = 100, jitterMs: number = 50): Promise<void> {
  const jitter = Math.random() * jitterMs
  const delay = baseDelayMs + jitter
  await new Promise(resolve => setTimeout(resolve, delay))
}
