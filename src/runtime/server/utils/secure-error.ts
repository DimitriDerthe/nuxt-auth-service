import { createError } from 'h3'
import { useRuntimeConfig } from '#imports'

export interface SecureErrorOptions {
  statusCode: number
  message: string
  internalMessage?: string
  logDetails?: Record<string, any>
  cause?: Error
}

/**
 * Create a secure error that sanitizes sensitive information in production
 */
export function createSecureError(options: SecureErrorOptions) {
  const config = useRuntimeConfig()
  const isDevelopment = process.env.NODE_ENV === 'development'

  // Log detailed error information for monitoring
  if (options.internalMessage || options.logDetails) {
    logSecurityEvent('error', {
      message: options.internalMessage || options.message,
      statusCode: options.statusCode,
      details: options.logDetails,
      stack: options.cause?.stack,
      timestamp: new Date().toISOString(),
    })
  }

  // Return sanitized error for client
  return createError({
    statusCode: options.statusCode,
    statusMessage: isDevelopment ? options.internalMessage || options.message : getSanitizedMessage(options.statusCode),
    cause: isDevelopment ? options.cause : undefined,
  })
}

/**
 * Get sanitized error message for production
 */
function getSanitizedMessage(statusCode: number): string {
  switch (statusCode) {
    case 400:
      return 'Bad Request'
    case 401:
      return 'Authentication Failed'
    case 403:
      return 'Access Denied'
    case 404:
      return 'Not Found'
    case 429:
      return 'Too Many Requests'
    case 500:
      return 'Internal Server Error'
    default:
      return 'An error occurred'
  }
}

/**
 * Security event logger (should integrate with your logging system)
 */
function logSecurityEvent(level: 'error' | 'warn' | 'info', data: Record<string, any>) {
  const logEntry = {
    level,
    service: 'auth-utils',
    ...data,
    // Remove sensitive data from logs
    ...sanitizeLogData(data),
  }

  // In production, this should send to your logging service
  if (process.env.NODE_ENV === 'development') {
    console.log(`[SECURITY ${level.toUpperCase()}]`, JSON.stringify(logEntry, null, 2))
  }
  else {
    // Send to production logging service
    // Example: sendToLoggingService(logEntry)
    console.log(`[SECURITY ${level.toUpperCase()}]`, JSON.stringify({
      ...logEntry,
      details: logEntry.details ? '[REDACTED]' : undefined,
      stack: '[REDACTED]',
    }))
  }
}

/**
 * Sanitize log data to remove sensitive information
 */
function sanitizeLogData(data: Record<string, any>): Record<string, any> {
  const sensitiveKeys = ['password', 'secret', 'token', 'key', 'credential', 'auth']
  const sanitized = { ...data }

  function sanitizeObject(obj: any, path: string = ''): any {
    if (typeof obj !== 'object' || obj === null) {
      return obj
    }

    if (Array.isArray(obj)) {
      return obj.map((item, index) => sanitizeObject(item, `${path}[${index}]`))
    }

    const result: any = {}
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key
      const lowerKey = key.toLowerCase()

      if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
        result[key] = '[REDACTED]'
      }
      else if (typeof value === 'object' && value !== null) {
        result[key] = sanitizeObject(value, currentPath)
      }
      else {
        result[key] = value
      }
    }

    return result
  }

  return sanitizeObject(sanitized)
}

/**
 * Common secure error creators
 */
export const secureErrors = {
  invalidCredentials: () => createSecureError({
    statusCode: 401,
    message: 'Invalid credentials',
    internalMessage: 'Authentication failed - invalid email or password',
  }),

  accountLocked: (lockDuration?: number) => createSecureError({
    statusCode: 423,
    message: 'Account temporarily locked',
    internalMessage: `Account locked due to too many failed attempts${lockDuration ? ` for ${lockDuration} minutes` : ''}`,
    logDetails: { event: 'account_locked', lockDuration },
  }),

  insufficientPermissions: (requiredPermission?: string) => createSecureError({
    statusCode: 403,
    message: 'Insufficient permissions',
    internalMessage: 'User does not have required permissions',
    logDetails: { event: 'permission_denied', requiredPermission },
  }),

  invalidTwoFactor: () => createSecureError({
    statusCode: 401,
    message: 'Invalid verification code',
    internalMessage: '2FA verification failed',
  }),

  sessionExpired: () => createSecureError({
    statusCode: 401,
    message: 'Session expired',
    internalMessage: 'User session has expired',
  }),

  databaseError: (cause?: Error) => createSecureError({
    statusCode: 500,
    message: 'Internal server error',
    internalMessage: 'Database operation failed',
    logDetails: { event: 'database_error' },
    cause,
  }),

  validationError: (errors: string[]) => createSecureError({
    statusCode: 400,
    message: 'Validation failed',
    internalMessage: `Validation errors: ${errors.join(', ')}`,
    logDetails: { event: 'validation_error', errors },
  }),

  rateLimitExceeded: (retryAfter?: number) => createSecureError({
    statusCode: 429,
    message: 'Too many requests',
    internalMessage: 'Rate limit exceeded',
    logDetails: { event: 'rate_limit_exceeded', retryAfter },
  }),
}

/**
 * Wrap async function with secure error handling
 */
export function withSecureErrorHandling<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  context?: string,
) {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args)
    }
    catch (error) {
      if (error instanceof Error && 'statusCode' in error) {
        // Already a secure error, re-throw
        throw error
      }

      // Wrap unknown errors
      throw createSecureError({
        statusCode: 500,
        message: 'Internal server error',
        internalMessage: `Unexpected error in ${context || 'unknown context'}`,
        logDetails: {
          event: 'unexpected_error',
          context,
          originalError: error instanceof Error ? error.message : String(error),
        },
        cause: error instanceof Error ? error : new Error(String(error)),
      })
    }
  }
}
