import { vi } from 'vitest'

// Mock TOTP secret and codes
const mockTOTPData = {
  secret: 'JBSWY3DPEHPK3PXP',
  uri: 'otpauth://totp/Test%20App:test@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Test%20App',
  qrCodeDataURL: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  backupCodes: [
    'ABCD1234',
    'EFGH5678',
    'IJKL9012',
    'MNOP3456',
    'QRST7890',
    'UVWX1234',
    'YZAB5678',
    'CDEF9012',
    'GHIJ3456',
    'KLMN7890',
  ],
  validToken: '123456',
  invalidToken: '000000',
}

// Mock otpauth library
export const mockOTPAuth = {
  Secret: vi.fn().mockImplementation(options => ({
    base32: mockTOTPData.secret,
    buffer: Buffer.from(mockTOTPData.secret, 'ascii'), // Use ascii instead of base32
  })),

  TOTP: vi.fn().mockImplementation(options => ({
    secret: options.secret || mockTOTPData.secret,
    issuer: options.issuer || 'Test App',
    label: options.label || 'test@example.com',
    algorithm: options.algorithm || 'SHA1',
    digits: options.digits || 6,
    period: options.period || 30,

    toString: vi.fn().mockReturnValue(mockTOTPData.uri),

    generate: vi.fn().mockImplementation(() => mockTOTPData.validToken),

    validate: vi.fn().mockImplementation(({ token, window = 1 }) => {
      if (token === mockTOTPData.validToken) {
        return 0 // Valid token, no time drift
      }
      return null // Invalid token
    }),
  })),
}

// Add static methods to Secret mock
mockOTPAuth.Secret.fromBase32 = vi.fn().mockImplementation(base32 => ({
  base32,
  buffer: Buffer.from(base32, 'ascii'), // Use ascii instead of base32
}))

// Mock qrcode library
export const mockQRCode = {
  toDataURL: vi.fn().mockImplementation(async (data, options) => {
    // Simulate async QR code generation
    await new Promise(resolve => setTimeout(resolve, 10))
    return mockTOTPData.qrCodeDataURL
  }),

  toString: vi.fn().mockImplementation(async (data, options) => {
    await new Promise(resolve => setTimeout(resolve, 10))
    return 'ASCII QR Code representation'
  }),

  toFile: vi.fn().mockImplementation(async (path, data, options) => {
    await new Promise(resolve => setTimeout(resolve, 10))
    return true
  }),
}

// Mock TOTP utilities with realistic behavior
export const mockTOTPUtils = {
  generateTOTPSecret: vi.fn().mockImplementation(async (userId, email) => {
    return {
      secret: mockTOTPData.secret,
      qrCode: mockTOTPData.qrCodeDataURL,
      uri: mockTOTPData.uri,
      backupCodes: [...mockTOTPData.backupCodes],
    }
  }),

  verifyTOTPCode: vi.fn().mockImplementation(async (secret, token, window = 1) => {
    // Simulate verification logic
    if (secret === mockTOTPData.secret && token === mockTOTPData.validToken) {
      return true
    }
    return false
  }),

  enable2FA: vi.fn().mockImplementation(async (userId, secret, token, backupCodes) => {
    if (token === mockTOTPData.validToken) {
      return true
    }
    return false
  }),

  disable2FA: vi.fn().mockImplementation(async (userId) => {
    return true
  }),

  verify2FA: vi.fn().mockImplementation(async (userId, code) => {
    if (code === mockTOTPData.validToken) {
      return { isValid: true }
    }

    // Check if it's a backup code
    if (mockTOTPData.backupCodes.includes(code)) {
      return {
        isValid: true,
        isBackupCode: true,
        remainingBackupCodes: mockTOTPData.backupCodes.length - 1,
      }
    }

    return { isValid: false }
  }),

  generateNewBackupCodes: vi.fn().mockImplementation(async (userId, count = 10, length = 8) => {
    const codes = []
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'

    for (let i = 0; i < count; i++) {
      let code = ''
      for (let j = 0; j < length; j++) {
        code += chars[Math.floor(Math.random() * chars.length)]
      }
      codes.push(code)
    }

    return codes
  }),

  getBackupCodesCount: vi.fn().mockImplementation(async (userId) => {
    return mockTOTPData.backupCodes.length
  }),

  is2FAEnabled: vi.fn().mockImplementation(async (userId) => {
    return false // Default to disabled for tests
  }),
}

// Mock randomBytes for backup code generation
export const mockRandomBytes = vi.fn().mockImplementation((length) => {
  const bytes = new Uint8Array(length)
  for (let i = 0; i < length; i++) {
    bytes[i] = Math.floor(Math.random() * 256)
  }
  return bytes
})

// Reset function for tests
export function resetTOTPMocks() {
  vi.clearAllMocks()

  // Reset default behaviors
  mockTOTPUtils.is2FAEnabled.mockResolvedValue(false)
  mockTOTPUtils.verifyTOTPCode.mockImplementation(async (secret, token) => {
    return secret === mockTOTPData.secret && token === mockTOTPData.validToken
  })
}

// Helper functions for test scenarios
export function mockUser2FAEnabled(enabled = true) {
  mockTOTPUtils.is2FAEnabled.mockResolvedValue(enabled)
}

export function mockTOTPVerificationResult(isValid = true, isBackupCode = false) {
  mockTOTPUtils.verify2FA.mockResolvedValue({
    isValid,
    isBackupCode,
    remainingBackupCodes: isBackupCode ? mockTOTPData.backupCodes.length - 1 : undefined,
  })
}

export function mockTOTPError(error = new Error('TOTP operation failed')) {
  mockTOTPUtils.generateTOTPSecret.mockRejectedValue(error)
  mockTOTPUtils.enable2FA.mockRejectedValue(error)
}

// Export test data for assertions
export { mockTOTPData }
