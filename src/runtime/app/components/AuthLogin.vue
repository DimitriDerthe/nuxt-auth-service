<script lang="ts" setup>
import type { AuthComponentProps, AuthTexts } from '#auth-utils'

interface Props extends AuthComponentProps {
  /**
   * Show register link
   */
  showRegister?: boolean
  /**
   * Show forgot password link
   */
  showForgotPassword?: boolean
  /**
   * Redirect URL after successful login
   */
  redirectTo?: string
  /**
   * OAuth providers to show
   */
  oauthProviders?: string[]
  /**
   * Show 2FA verification if enabled
   */
  show2FA?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showRegister: true,
  showForgotPassword: true,
  redirectTo: '/',
  oauthProviders: () => [],
  show2FA: true,
  size: 'md',
  color: 'primary',
})

const emits = defineEmits<{
  success: [user: any]
  error: [error: any]
  register: []
  forgotPassword: []
}>()

const { getThemeClasses } = useAuthTheme()
const { fetch: fetchSession } = useUserSession()
const { verify: verify2FA } = use2FA()

// Form state
const formData = reactive({
  email: '',
  password: '',
  rememberMe: false,
  totpCode: '',
})

const isLoading = ref(false)
const showTwoFactor = ref(false)
const error = ref('')

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

const handleLogin = async () => {
  if (isLoading.value) return

  error.value = ''
  isLoading.value = true

  try {
    const response = await $fetch('/api/_auth/login', {
      method: 'POST',
      body: {
        email: formData.email,
        password: formData.password,
        rememberMe: formData.rememberMe,
      },
    })

    // Check if 2FA is required
    if (response.requires2FA && props.show2FA) {
      showTwoFactor.value = true
      isLoading.value = false
      return
    }

    // Login successful
    await fetchSession()
    emits('success', response.user)

    if (props.redirectTo) {
      await navigateTo(props.redirectTo)
    }
  }
  catch (err: any) {
    error.value = err.data?.message || texts.value.invalidCredentials
    emits('error', err)
  }
  finally {
    if (!showTwoFactor.value) {
      isLoading.value = false
    }
  }
}

const handle2FAVerification = async () => {
  if (!formData.totpCode) {
    error.value = 'Authentication code is required'
    return
  }

  try {
    const isValid = await verify2FA(formData.totpCode)

    if (!isValid) {
      error.value = texts.value.invalidCode
      return
    }

    // Complete login
    await fetchSession()
    emits('success', { email: formData.email })

    if (props.redirectTo) {
      await navigateTo(props.redirectTo)
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

const handleOAuthLogin = async (provider: string) => {
  try {
    await navigateTo(`/auth/${provider}`)
  }
  catch (err: any) {
    error.value = err.message || texts.value.genericError
    emits('error', err)
  }
}

// Theme classes
const cardClasses = computed(() => getThemeClasses('card', 'default'))
const buttonClasses = computed(() => getThemeClasses('button', 'default'))
const inputClasses = computed(() => getThemeClasses('input', error.value ? 'error' : 'default'))
const labelClasses = computed(() => getThemeClasses('label', 'default'))
</script>

<template>
  <div :class="[cardClasses, props.class]">
    <!-- Two-Factor Authentication Step -->
    <div
      v-if="showTwoFactor"
      class="space-y-6"
    >
      <div class="text-center">
        <h2 class="text-2xl font-bold text-gray-900">
          {{ texts.twoFactorTitle }}
        </h2>
        <p class="mt-2 text-sm text-gray-600">
          {{ texts.twoFactorDescription }}
        </p>
      </div>

      <form
        class="space-y-4"
        @submit.prevent="handle2FAVerification"
      >
        <div>
          <label
            :class="labelClasses"
            for="totp-code"
          >
            {{ texts.twoFactorCode }}
          </label>
          <input
            id="totp-code"
            v-model="formData.totpCode"
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

        <button
          type="submit"
          :class="buttonClasses"
          :disabled="isLoading"
          class="w-full"
        >
          {{ isLoading ? texts.loading : texts.loginButton }}
        </button>

        <button
          type="button"
          class="w-full text-sm text-gray-600 hover:text-gray-800"
          @click="showTwoFactor = false"
        >
          Back to login
        </button>
      </form>
    </div>

    <!-- Main Login Form -->
    <div
      v-else
      class="space-y-6"
    >
      <div class="text-center">
        <h2 class="text-2xl font-bold text-gray-900">
          {{ texts.loginTitle }}
        </h2>
        <p class="mt-2 text-sm text-gray-600">
          {{ texts.loginDescription }}
        </p>
      </div>

      <!-- OAuth Providers -->
      <div
        v-if="oauthProviders.length > 0"
        class="space-y-3"
      >
        <button
          v-for="provider in oauthProviders"
          :key="provider"
          type="button"
          :class="getThemeClasses('button', 'outline')"
          class="w-full"
          @click="handleOAuthLogin(provider)"
        >
          Continue with {{ provider.charAt(0).toUpperCase() + provider.slice(1) }}
        </button>

        <div class="relative">
          <div class="absolute inset-0 flex items-center">
            <div class="w-full border-t border-gray-300" />
          </div>
          <div class="relative flex justify-center text-sm">
            <span class="bg-white px-2 text-gray-500">Or continue with email</span>
          </div>
        </div>
      </div>

      <form
        class="space-y-4"
        @submit.prevent="handleLogin"
      >
        <div>
          <label
            :class="labelClasses"
            for="email"
          >
            {{ texts.email }}
          </label>
          <input
            id="email"
            v-model="formData.email"
            type="email"
            :class="inputClasses"
            :placeholder="texts.email"
            :disabled="isLoading"
            autocomplete="email"
            required
          >
        </div>

        <div>
          <label
            :class="labelClasses"
            for="password"
          >
            {{ texts.password }}
          </label>
          <input
            id="password"
            v-model="formData.password"
            type="password"
            :class="inputClasses"
            :placeholder="texts.password"
            :disabled="isLoading"
            autocomplete="current-password"
            required
          >
        </div>

        <div class="flex items-center justify-between">
          <div class="flex items-center">
            <input
              id="remember-me"
              v-model="formData.rememberMe"
              type="checkbox"
              class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              :disabled="isLoading"
            >
            <label
              for="remember-me"
              class="ml-2 text-sm text-gray-700"
            >
              Remember me
            </label>
          </div>

          <button
            v-if="showForgotPassword"
            type="button"
            class="text-sm text-blue-600 hover:text-blue-700"
            @click="emits('forgotPassword')"
          >
            {{ texts.forgotPassword }}
          </button>
        </div>

        <div
          v-if="error"
          class="text-sm text-red-600"
        >
          {{ error }}
        </div>

        <button
          type="submit"
          :class="buttonClasses"
          :disabled="isLoading"
          class="w-full"
        >
          {{ isLoading ? texts.loading : texts.loginButton }}
        </button>
      </form>

      <div
        v-if="showRegister"
        class="text-center text-sm"
      >
        <span class="text-gray-600">{{ texts.noAccount }}</span>
        <button
          class="ml-1 text-blue-600 hover:text-blue-700 font-medium"
          @click="emits('register')"
        >
          {{ texts.signUp }}
        </button>
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
