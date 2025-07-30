import { ref, computed, type Ref } from 'vue'
import type { TOTPSecret, TOTPComposable } from '#auth-utils'

const isEnabled: Ref<boolean> = ref(false)
const isSetupInProgress: Ref<boolean> = ref(false)

export function use2FA(): TOTPComposable {
  const setup = async (): Promise<TOTPSecret> => {
    isSetupInProgress.value = true

    try {
      const response = await $fetch('/api/_auth/2fa/setup', {
        method: 'POST',
      })

      return {
        secret: response.secret,
        qrCode: response.qrCode,
        backupCodes: response.backupCodes,
        uri: response.uri,
      }
    }
    catch (error) {
      console.error('2FA setup failed:', error)
      throw error
    }
    finally {
      isSetupInProgress.value = false
    }
  }

  const enable = async (code: string): Promise<{ success: boolean, backupCodes?: string[] }> => {
    // This requires the secret from setup phase
    // In a real implementation, you'd store the secret temporarily during setup
    throw new Error('Use setupAndEnable method instead')
  }

  const setupAndEnable = async (code: string, secret: string, backupCodes: string[]): Promise<{ success: boolean, backupCodes?: string[] }> => {
    try {
      const response = await $fetch('/api/_auth/2fa/enable', {
        method: 'POST',
        body: {
          secret,
          token: code,
          backupCodes,
        },
      })

      if (response.success) {
        isEnabled.value = true
      }

      return {
        success: response.success,
        backupCodes,
      }
    }
    catch (error) {
      console.error('2FA enable failed:', error)
      throw error
    }
  }

  const disable = async (password: string): Promise<boolean> => {
    try {
      const response = await $fetch('/api/_auth/2fa/disable', {
        method: 'POST',
        body: { password },
      })

      if (response.success) {
        isEnabled.value = false
      }

      return response.success
    }
    catch (error) {
      console.error('2FA disable failed:', error)
      throw error
    }
  }

  const verify = async (code: string): Promise<boolean> => {
    try {
      const response = await $fetch('/api/_auth/2fa/verify', {
        method: 'POST',
        body: { code },
      })

      return response.isValid
    }
    catch (error) {
      console.error('2FA verification failed:', error)
      return false
    }
  }

  const verifyRecoveryCode = async (code: string): Promise<boolean> => {
    return verify(code) // Same endpoint handles both TOTP and recovery codes
  }

  const generateBackupCodes = async (password: string): Promise<string[]> => {
    try {
      const response = await $fetch('/api/_auth/2fa/backup-codes', {
        method: 'POST',
        body: { password },
      })

      return response.backupCodes
    }
    catch (error) {
      console.error('Backup codes generation failed:', error)
      throw error
    }
  }

  const getBackupCodesCount = async (): Promise<number> => {
    try {
      const response = await $fetch('/api/_auth/2fa/status')
      return response.backupCodesCount || 0
    }
    catch (error) {
      console.error('Failed to get backup codes count:', error)
      return 0
    }
  }

  const refresh = async (): Promise<void> => {
    try {
      const response = await $fetch('/api/_auth/2fa/status')
      isEnabled.value = response.enabled || false
    }
    catch (error) {
      console.error('Failed to refresh 2FA status:', error)
      isEnabled.value = false
    }
  }

  return {
    isEnabled: computed(() => isEnabled.value),
    isSetupInProgress: computed(() => isSetupInProgress.value),
    setup,
    enable,
    setupAndEnable, // Additional method for complete setup flow
    disable,
    verify,
    verifyRecoveryCode,
    generateBackupCodes,
    getBackupCodesCount,
  }
}

// Alias for consistency
export const useTOTP = use2FA

// Initialize 2FA status
if (import.meta.client) {
  const { refresh } = use2FA()
  refresh().catch(() => {
    // Silently fail on client
  })
}
