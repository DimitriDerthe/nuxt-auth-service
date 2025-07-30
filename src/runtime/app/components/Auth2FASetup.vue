<script lang="ts" setup>
import type { AuthComponentProps, AuthTexts, TOTPSecret } from '#auth-utils'

interface Props extends AuthComponentProps {
  /**
   * Show backup codes download option
   */
  showBackupCodes?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showBackupCodes: true,
  size: 'md',
  color: 'primary',
})

const emits = defineEmits<{
  success: [backupCodes: string[]]
  error: [error: any]
  cancel: []
}>()

const { getThemeClasses } = useAuthTheme()
const { setup, setupAndEnable } = use2FA()

// Component state
const currentStep = ref<'setup' | 'verify'>('setup')
const isLoading = ref(false)
const error = ref('')
const verificationCode = ref('')
const totpData = ref<TOTPSecret | null>(null)

// Default texts
const defaultTexts: AuthTexts = {
  email: 'Email',
  password: 'Password',
  confirmPassword: 'Confirm Password',
  submit: 'Submit',
  cancel: 'Cancel',
  loading: 'Loading...',
  loginTitle: 'Sign in to your account',
  loginDescription: 'Welcome back! Please sign in to continue.',
  loginButton: 'Sign In',
  forgotPassword: 'Forgot your password?',
  noAccount: 'Don\'t have an account?',
  signUp: 'Sign up',
  registerTitle: 'Create your account',
  registerDescription: 'Get started by creating your account.',
  registerButton: 'Create Account',
  hasAccount: 'Already have an account?',
  signIn: 'Sign in',
  firstName: 'First Name',
  lastName: 'Last Name',
  twoFactorTitle: 'Two-Factor Authentication',
  twoFactorDescription: 'Enter your authentication code to continue.',
  twoFactorCode: 'Authentication Code',
  backupCode: 'Backup Code',
  useBackupCode: 'Use backup code',
  useAuthenticator: 'Use authenticator app',
  setupTitle: 'Set up Two-Factor Authentication',
  setupDescription: 'Scan the QR code with your authenticator app.',
  qrCodeInstructions: 'Use your authenticator app to scan the QR code or enter the secret manually.',
  verifySetup: 'Verify Setup',
  backupCodes: 'Backup Codes',
  downloadBackupCodes: 'Download Backup Codes',
  profileTitle: 'Profile Settings',
  updateProfile: 'Update Profile',
  changePassword: 'Change Password',
  enable2FA: 'Enable Two-Factor Authentication',
  disable2FA: 'Disable Two-Factor Authentication',
  invalidCredentials: 'Invalid email or password',
  emailRequired: 'Email is required',
  passwordRequired: 'Password is required',
  passwordMismatch: 'Passwords do not match',
  invalidCode: 'Invalid authentication code',
  genericError: 'An error occurred. Please try again.',
}

const texts = computed(() => ({
  ...defaultTexts,
  ...props.texts,
}))

const initializeSetup = async () => {
  isLoading.value = true
  error.value = ''

  try {
    const data = await setup()
    totpData.value = data
    currentStep.value = 'verify'
  }
  catch (err: any) {
    error.value = err.data?.message || texts.value.genericError
    emits('error', err)
  }
  finally {
    isLoading.value = false
  }
}

const verifyAndEnable = async () => {
  if (!totpData.value || !verificationCode.value) {
    error.value = 'Verification code is required'
    return
  }

  isLoading.value = true
  error.value = ''

  try {
    const result = await setupAndEnable(
      verificationCode.value,
      totpData.value.secret,
      totpData.value.backupCodes || [],
    )

    if (result.success) {
      emits('success', result.backupCodes || [])
    }
    else {
      error.value = texts.value.invalidCode
    }
  }
  catch (err: any) {
    error.value = err.data?.message || texts.value.invalidCode
    emits('error', err)
  }
  finally {
    isLoading.value = false
  }
}

const downloadBackupCodes = () => {
  if (!totpData.value?.backupCodes) return

  const blob = new Blob([totpData.value.backupCodes.join('\n')], {
    type: 'text/plain',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'backup-codes.txt'
  link.click()
  URL.revokeObjectURL(url)
}

const copySecret = async () => {
  if (!totpData.value?.secret) return

  try {
    await navigator.clipboard.writeText(totpData.value.secret)
    // You could add a toast notification here
  }
  catch (err) {
    console.error('Failed to copy secret:', err)
  }
}

// Theme classes
const cardClasses = computed(() => getThemeClasses('card', 'default'))
const buttonClasses = computed(() => getThemeClasses('button', 'default'))
const inputClasses = computed(() => getThemeClasses('input', error.value ? 'error' : 'default'))
const labelClasses = computed(() => getThemeClasses('label', 'default'))

// Initialize setup when component mounts
onMounted(() => {
  initializeSetup()
})
</script>

<template>
  <div :class="[cardClasses, props.class]">
    <!-- Setup Step -->
    <div
      v-if="currentStep === 'setup'"
      class="space-y-6"
    >
      <div class="text-center">
        <h2 class="text-2xl font-bold text-gray-900">
          {{ texts.setupTitle }}
        </h2>
        <p class="mt-2 text-sm text-gray-600">
          {{ texts.setupDescription }}
        </p>
      </div>

      <div
        v-if="isLoading"
        class="flex justify-center"
      >
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>

      <div
        v-if="error"
        class="text-sm text-red-600 text-center"
      >
        {{ error }}
      </div>
    </div>

    <!-- Verification Step -->
    <div
      v-else-if="currentStep === 'verify' && totpData"
      class="space-y-6"
    >
      <div class="text-center">
        <h2 class="text-2xl font-bold text-gray-900">
          {{ texts.verifySetup }}
        </h2>
        <p class="mt-2 text-sm text-gray-600">
          {{ texts.qrCodeInstructions }}
        </p>
      </div>

      <!-- QR Code -->
      <div class="flex justify-center">
        <div class="bg-white p-4 rounded-lg border-2 border-gray-200">
          <img
            :src="totpData.qrCode"
            alt="QR Code for 2FA setup"
            class="w-48 h-48"
          >
        </div>
      </div>

      <!-- Manual Secret -->
      <div class="bg-gray-50 p-4 rounded-md">
        <div class="flex items-center justify-between">
          <div class="flex-1">
            <p class="text-sm font-medium text-gray-700 mb-2">
              Manual entry key:
            </p>
            <code class="text-sm bg-white px-2 py-1 rounded border font-mono break-all">
              {{ totpData.secret }}
            </code>
          </div>
          <button
            type="button"
            class="ml-2 text-sm text-blue-600 hover:text-blue-700"
            @click="copySecret"
          >
            Copy
          </button>
        </div>
      </div>

      <!-- Verification Form -->
      <form
        class="space-y-4"
        @submit.prevent="verifyAndEnable"
      >
        <div>
          <label
            :class="labelClasses"
            for="verification-code"
          >
            {{ texts.twoFactorCode }}
          </label>
          <input
            id="verification-code"
            v-model="verificationCode"
            type="text"
            :class="inputClasses"
            :placeholder="texts.twoFactorCode"
            :disabled="isLoading"
            autocomplete="one-time-code"
            maxlength="8"
            required
          >
        </div>

        <div
          v-if="error"
          class="text-sm text-red-600"
        >
          {{ error }}
        </div>

        <div class="flex space-x-3">
          <button
            type="button"
            :class="getThemeClasses('button', 'outline')"
            :disabled="isLoading"
            class="flex-1"
            @click="emits('cancel')"
          >
            {{ texts.cancel }}
          </button>
          <button
            type="submit"
            :class="buttonClasses"
            :disabled="isLoading"
            class="flex-1"
          >
            {{ isLoading ? texts.loading : texts.enable2FA }}
          </button>
        </div>
      </form>

      <!-- Backup Codes -->
      <div
        v-if="props.showBackupCodes && totpData.backupCodes"
        class="bg-yellow-50 border border-yellow-200 rounded-md p-4"
      >
        <div class="flex items-start">
          <div class="flex-shrink-0">
            <svg
              class="h-5 w-5 text-yellow-400"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fill-rule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clip-rule="evenodd"
              />
            </svg>
          </div>
          <div class="ml-3">
            <h3 class="text-sm font-medium text-yellow-800">
              {{ texts.backupCodes }}
            </h3>
            <p class="mt-1 text-sm text-yellow-700">
              Save these backup codes in a safe place. You can use them to access your account if you lose your authenticator device.
            </p>
            <div class="mt-2">
              <button
                type="button"
                class="text-sm font-medium text-yellow-800 hover:text-yellow-900 underline"
                @click="downloadBackupCodes"
              >
                {{ texts.downloadBackupCodes }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Slot for custom content -->
    <div
      v-if="$slots.default"
      class="mt-6"
    >
      <slot />
    </div>
  </div>
</template>
