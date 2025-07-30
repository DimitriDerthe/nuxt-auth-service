import { createError } from 'h3'

export interface ValidationRule {
  required?: boolean
  type?: 'string' | 'number' | 'boolean' | 'email' | 'uuid' | 'totp' | 'password'
  minLength?: number
  maxLength?: number
  pattern?: RegExp
  min?: number
  max?: number
  custom?: (value: any) => boolean | string
  sanitize?: boolean
}

export interface ValidationSchema {
  [key: string]: ValidationRule
}

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  sanitizedData: Record<string, any>
}

/**
 * Validate and sanitize input data according to schema
 */
export function validateInput(data: Record<string, any>, schema: ValidationSchema): ValidationResult {
  const errors: string[] = []
  const sanitizedData: Record<string, any> = {}

  for (const [field, rule] of Object.entries(schema)) {
    const value = data[field]

    // Check required fields
    if (rule.required && (value === undefined || value === null || value === '')) {
      errors.push(`${field} is required`)
      continue
    }

    // Skip validation for optional empty fields
    if (!rule.required && (value === undefined || value === null || value === '')) {
      sanitizedData[field] = value
      continue
    }

    // Type validation
    if (rule.type) {
      const typeError = validateType(field, value, rule.type)
      if (typeError) {
        errors.push(typeError)
        continue
      }
    }

    // Length validation for strings
    if (typeof value === 'string') {
      if (rule.minLength && value.length < rule.minLength) {
        errors.push(`${field} must be at least ${rule.minLength} characters long`)
        continue
      }
      if (rule.maxLength && value.length > rule.maxLength) {
        errors.push(`${field} must be no more than ${rule.maxLength} characters long`)
        continue
      }
    }

    // Number range validation
    if (typeof value === 'number') {
      if (rule.min !== undefined && value < rule.min) {
        errors.push(`${field} must be at least ${rule.min}`)
        continue
      }
      if (rule.max !== undefined && value > rule.max) {
        errors.push(`${field} must be no more than ${rule.max}`)
        continue
      }
    }

    // Pattern validation
    if (rule.pattern && typeof value === 'string' && !rule.pattern.test(value)) {
      errors.push(`${field} format is invalid`)
      continue
    }

    // Custom validation
    if (rule.custom) {
      const customResult = rule.custom(value)
      if (typeof customResult === 'string') {
        errors.push(customResult)
        continue
      }
      else if (!customResult) {
        errors.push(`${field} is invalid`)
        continue
      }
    }

    // Sanitize value
    sanitizedData[field] = rule.sanitize ? sanitizeValue(value, rule.type) : value
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedData,
  }
}

/**
 * Validate data type
 */
function validateType(field: string, value: any, type: ValidationRule['type']): string | null {
  switch (type) {
    case 'string':
      if (typeof value !== 'string') {
        return `${field} must be a string`
      }
      break

    case 'number':
      if (typeof value !== 'number' || isNaN(value)) {
        return `${field} must be a number`
      }
      break

    case 'boolean':
      if (typeof value !== 'boolean') {
        return `${field} must be a boolean`
      }
      break

    case 'email':
      if (typeof value !== 'string' || !isValidEmail(value)) {
        return `${field} must be a valid email address`
      }
      break

    case 'uuid':
      if (typeof value !== 'string' || !isValidUUID(value)) {
        return `${field} must be a valid UUID`
      }
      break

    case 'totp':
      if (typeof value !== 'string' || !isValidTOTP(value)) {
        return `${field} must be a valid 6-digit TOTP code`
      }
      break

    case 'password':
      if (typeof value !== 'string' || !isValidPassword(value)) {
        return `${field} must be a strong password (min 8 chars, with uppercase, lowercase, number, and special character)`
      }
      break
  }

  return null
}

/**
 * Sanitize value based on type
 */
function sanitizeValue(value: any, type?: ValidationRule['type']): any {
  if (typeof value === 'string') {
    // Basic XSS prevention
    value = value
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
      .replace(/[<>]/g, '') // Remove remaining HTML tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .replace(/alert\s*\(/gi, '') // Remove alert calls
      .trim()
  }

  return value
}

/**
 * Email validation
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/
  return emailRegex.test(email) && email.length <= 254
}

/**
 * UUID validation - supports all UUID versions
 */
function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(uuid)
}

/**
 * TOTP code validation
 */
function isValidTOTP(code: string): boolean {
  const totpRegex = /^\d{6}$/
  return totpRegex.test(code)
}

/**
 * Password strength validation
 */
function isValidPassword(password: string): boolean {
  if (password.length < 8) return false

  const hasUppercase = /[A-Z]/.test(password)
  const hasLowercase = /[a-z]/.test(password)
  const hasNumber = /\d/.test(password)
  const hasSpecialChar = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)

  return hasUppercase && hasLowercase && hasNumber && hasSpecialChar
}

/**
 * Pre-defined validation schemas for common use cases
 */
export const validationSchemas = {
  login: {
    email: { required: true, type: 'email' as const, sanitize: true },
    password: { required: true, type: 'string' as const, minLength: 1, maxLength: 255 },
  },

  superAdminLogin: {
    email: { required: true, type: 'email' as const, sanitize: true },
    password: { required: true, type: 'string' as const, minLength: 8, maxLength: 255 },
  },

  twoFactorVerify: {
    code: { required: true, type: 'totp' as const },
  },

  twoFactorEnable: {
    secret: { required: true, type: 'string' as const, minLength: 32, maxLength: 32 },
    token: { required: true, type: 'totp' as const },
    backupCodes: {
      required: true,
      type: 'string' as const,
      custom: (value: any) => Array.isArray(value) && value.length >= 8 && value.every((code: any) => typeof code === 'string' && /^[A-Z0-9]{8}$/.test(code)),
    },
  },

  roleAssign: {
    userId: { required: true, type: 'uuid' as const },
    roleSlug: { required: true, type: 'string' as const, minLength: 1, maxLength: 50, pattern: /^[a-z0-9-]+$/ },
  },

  userRegistration: {
    email: { required: true, type: 'email' as const, sanitize: true },
    password: { required: true, type: 'password' as const },
    firstName: { required: false, type: 'string' as const, maxLength: 50, sanitize: true },
    lastName: { required: false, type: 'string' as const, maxLength: 50, sanitize: true },
  },
}

/**
 * Middleware wrapper for input validation
 */
export function withValidation(schema: ValidationSchema) {
  return (data: Record<string, any>) => {
    const result = validateInput(data, schema)
    if (!result.isValid) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Validation Error',
        data: {
          errors: result.errors,
        },
      })
    }
    return result.sanitizedData
  }
}
