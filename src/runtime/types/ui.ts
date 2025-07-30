// UI Theme and Customization Types

export interface ColorPalette {
  50: string
  100: string
  200: string
  300: string
  400: string
  500: string
  600: string
  700: string
  800: string
  900: string
  950: string
}

export interface ThemeColors {
  primary?: Partial<ColorPalette> | string
  secondary?: Partial<ColorPalette> | string
  success?: Partial<ColorPalette> | string
  warning?: Partial<ColorPalette> | string
  error?: Partial<ColorPalette> | string
  info?: Partial<ColorPalette> | string
  gray?: Partial<ColorPalette> | string
}

export interface ThemeConfig {
  /**
   * Theme name
   */
  name?: string
  /**
   * Color palette
   */
  colors?: ThemeColors
  /**
   * Border radius values
   */
  borderRadius?: {
    sm?: string
    md?: string
    lg?: string
    xl?: string
  }
  /**
   * Font configuration
   */
  fonts?: {
    sans?: string[]
    mono?: string[]
  }
  /**
   * Component size variants
   */
  sizes?: {
    xs?: string
    sm?: string
    md?: string
    lg?: string
    xl?: string
  }
  /**
   * Shadow configuration
   */
  shadows?: {
    sm?: string
    md?: string
    lg?: string
    xl?: string
  }
}

// Component customization types
export interface ComponentVariant {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info' | 'gray'
  variant?: 'solid' | 'outline' | 'ghost' | 'link'
  rounded?: boolean | 'sm' | 'md' | 'lg' | 'xl' | 'full'
}

export interface FormFieldConfig extends ComponentVariant {
  label?: string
  placeholder?: string
  required?: boolean
  disabled?: boolean
  loading?: boolean
  error?: string
  help?: string
}

// Internationalization types
export interface AuthTexts {
  // Common
  email: string
  password: string
  confirmPassword: string
  submit: string
  cancel: string
  loading: string

  // Login
  loginTitle: string
  loginDescription: string
  loginButton: string
  forgotPassword: string
  noAccount: string
  signUp: string

  // Register
  registerTitle: string
  registerDescription: string
  registerButton: string
  hasAccount: string
  signIn: string
  firstName: string
  lastName: string

  // 2FA
  twoFactorTitle: string
  twoFactorDescription: string
  twoFactorCode: string
  backupCode: string
  useBackupCode: string
  useAuthenticator: string
  setupTitle: string
  setupDescription: string
  qrCodeInstructions: string
  verifySetup: string
  backupCodes: string
  downloadBackupCodes: string

  // Profile
  profileTitle: string
  updateProfile: string
  changePassword: string
  enable2FA: string
  disable2FA: string

  // Errors
  invalidCredentials: string
  emailRequired: string
  passwordRequired: string
  passwordMismatch: string
  invalidCode: string
  genericError: string
}

// UI Component props
export interface AuthComponentProps {
  /**
   * Component theme customization
   */
  theme?: Partial<ThemeConfig>
  /**
   * Custom CSS classes
   */
  class?: string
  /**
   * Component size variant
   */
  size?: ComponentVariant['size']
  /**
   * Color variant
   */
  color?: ComponentVariant['color']
  /**
   * Loading state
   */
  loading?: boolean
  /**
   * Disabled state
   */
  disabled?: boolean
  /**
   * Custom texts/labels (overrides i18n)
   */
  texts?: Partial<AuthTexts>
}
