import { describe, it, expect, vi } from 'vitest'
import { validateInput, validationSchemas, withValidation } from '../../src/runtime/server/utils/validation'

// Mock h3 createError
vi.mock('h3', async () => {
  const actual = await vi.importActual('h3')
  return {
    ...actual,
    createError: vi.fn((error: any) => {
      const err = new Error(error.statusMessage || 'Error')
      ;(err as any).statusCode = error.statusCode
      ;(err as any).data = error.data
      return err
    }),
  }
})

describe('Input Validation', () => {
  describe('validateInput', () => {
    it('should validate required fields', () => {
      const schema = {
        email: { required: true, type: 'email' as const },
        password: { required: true, type: 'string' as const },
      }

      const result = validateInput({}, schema)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('email is required')
      expect(result.errors).toContain('password is required')
    })

    it('should validate email format', () => {
      const schema = {
        email: { required: true, type: 'email' as const },
      }

      const result = validateInput({ email: 'invalid-email' }, schema)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('email must be a valid email address')
    })

    it('should validate TOTP code format', () => {
      const schema = {
        code: { required: true, type: 'totp' as const },
      }

      // Invalid TOTP codes
      expect(validateInput({ code: '12345' }, schema).isValid).toBe(false) // Too short
      expect(validateInput({ code: '1234567' }, schema).isValid).toBe(false) // Too long
      expect(validateInput({ code: '12345a' }, schema).isValid).toBe(false) // Contains letter

      // Valid TOTP code
      expect(validateInput({ code: '123456' }, schema).isValid).toBe(true)
    })

    it('should validate UUID format', () => {
      const schema = {
        id: { required: true, type: 'uuid' as const },
      }

      const validUUID = '123e4567-e89b-12d3-a456-426614174000'
      const invalidUUID = 'not-a-uuid'

      expect(validateInput({ id: validUUID }, schema).isValid).toBe(true)
      expect(validateInput({ id: invalidUUID }, schema).isValid).toBe(false)
    })

    it('should validate password strength', () => {
      const schema = {
        password: { required: true, type: 'password' as const },
      }

      const weakPasswords = [
        'password', // No uppercase, number, special char
        'PASSWORD', // No lowercase, number, special char
        'Password', // No number, special char
        'Pass123', // No special char, too short
        '12345678', // No letters, special char
      ]

      const strongPassword = 'MyStr0ng!Pass'

      weakPasswords.forEach((password) => {
        const result = validateInput({ password }, schema)
        expect(result.isValid).toBe(false)
      })

      expect(validateInput({ password: strongPassword }, schema).isValid).toBe(true)
    })

    it('should validate string length', () => {
      const schema = {
        name: { required: true, type: 'string' as const, minLength: 2, maxLength: 10 },
      }

      expect(validateInput({ name: 'a' }, schema).isValid).toBe(false) // Too short
      expect(validateInput({ name: 'verylongname' }, schema).isValid).toBe(false) // Too long
      expect(validateInput({ name: 'validname' }, schema).isValid).toBe(true)
    })

    it('should sanitize input data', () => {
      const schema = {
        name: { required: true, type: 'string' as const, sanitize: true },
      }

      const result = validateInput({
        name: '<script>alert("xss")</script>John<>',
      }, schema)

      expect(result.isValid).toBe(true)
      expect(result.sanitizedData.name).not.toContain('<script>')
      expect(result.sanitizedData.name).not.toContain('<>')
    })

    it('should support custom validation', () => {
      const schema = {
        age: {
          required: true,
          type: 'number' as const,
          custom: (value: number) => value >= 18 || 'Must be at least 18 years old',
        },
      }

      expect(validateInput({ age: 16 }, schema).isValid).toBe(false)
      expect(validateInput({ age: 20 }, schema).isValid).toBe(true)
    })
  })

  describe('Pre-defined schemas', () => {
    it('should validate super admin login', () => {
      const { superAdminLogin } = validationSchemas

      // Invalid data
      expect(validateInput({}, superAdminLogin).isValid).toBe(false)
      expect(validateInput({ email: 'invalid', password: '123' }, superAdminLogin).isValid).toBe(false)

      // Valid data
      expect(validateInput({
        email: 'admin@example.com',
        password: 'validpassword',
      }, superAdminLogin).isValid).toBe(true)
    })

    it('should validate role assignment', () => {
      const { roleAssign } = validationSchemas
      const validUUID = '123e4567-e89b-12d3-a456-426614174000'

      // Invalid data
      expect(validateInput({}, roleAssign).isValid).toBe(false)
      expect(validateInput({ userId: 'invalid', roleSlug: 'invalid role' }, roleAssign).isValid).toBe(false)

      // Valid data
      expect(validateInput({
        userId: validUUID,
        roleSlug: 'admin-role',
      }, roleAssign).isValid).toBe(true)
    })
  })

  describe('withValidation middleware', () => {
    it('should throw error for invalid data', () => {
      const validator = withValidation({
        email: { required: true, type: 'email' as const },
      })

      expect(() => validator({})).toThrow('Validation Error')
      expect(() => validator({ email: 'invalid' })).toThrow('Validation Error')
    })

    it('should return sanitized data for valid input', () => {
      const validator = withValidation({
        email: { required: true, type: 'email' as const, sanitize: true },
      })

      const result = validator({ email: 'test@example.com' })
      expect(result.email).toBe('test@example.com')
    })
  })

  describe('XSS Prevention', () => {
    it('should remove dangerous scripts', () => {
      const schema = {
        comment: { required: true, type: 'string' as const, sanitize: true },
      }

      const maliciousInput = '<script>alert("xss")</script>Hello world'
      const result = validateInput({ comment: maliciousInput }, schema)

      expect(result.sanitizedData.comment).not.toContain('<script>')
      expect(result.sanitizedData.comment).not.toContain('alert')
      expect(result.sanitizedData.comment).toContain('Hello world')
    })

    it('should remove javascript protocols', () => {
      const schema = {
        url: { required: true, type: 'string' as const, sanitize: true },
      }

      const maliciousInput = 'javascript:alert("xss")'
      const result = validateInput({ url: maliciousInput }, schema)

      expect(result.sanitizedData.url).not.toContain('javascript:')
    })

    it('should remove event handlers', () => {
      const schema = {
        content: { required: true, type: 'string' as const, sanitize: true },
      }

      const maliciousInput = 'Hello onclick="alert(\'xss\')" world'
      const result = validateInput({ content: maliciousInput }, schema)

      expect(result.sanitizedData.content).not.toContain('onclick=')
    })
  })
})
