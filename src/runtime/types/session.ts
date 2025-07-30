import type { ComputedRef, Ref } from 'vue'
import type { Role } from './rbac'
import type { Organization } from './multi-tenant'

export interface User {
  id?: string
  organizationId?: string
  email?: string
  emailVerified?: boolean
  firstName?: string
  lastName?: string
  avatar?: string
  locale?: string
  timezone?: string
  twoFactorEnabled?: boolean
  lastLoginAt?: Date
  roles?: Role[]
  organization?: Organization
}

export interface SecureSessionData {
  twoFactorSecret?: string
  backupCodes?: string[]
  apiTokens?: Record<string, string>
}

export interface UserSession {
  /**
   * Session ID
   */
  id: string
  /**
   * User session data, available on client and server
   */
  user?: User
  /**
   * Private session data, only available on server/ code
   */
  secure?: SecureSessionData
  /**
   * Extra session data, available on client and server
   */
  [key: string]: unknown
}

export interface UserSessionRequired extends UserSession {
  user: User
}

export interface UserSessionComposable {
  /**
   * Computed indicating if the auth session is ready
   */
  ready: ComputedRef<boolean>
  /**
   * Computed indicating if the user is logged in.
   */
  loggedIn: ComputedRef<boolean>
  /**
   * The user object if logged in, null otherwise.
   */
  user: ComputedRef<User | null>
  /**
   * The session object.
   */
  session: Ref<UserSession | null>
  /**
   * Fetch the user session from the server.
   */
  fetch: () => Promise<void>
  /**
   * Clear the user session and remove the session cookie.
   */
  clear: () => Promise<void>
  /**
   * Open the OAuth route in a popup that auto-closes when successful.
   */
  openInPopup: (route: string, size?: { width?: number, height?: number }) => void
}
