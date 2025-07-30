import type { ComputedRef } from 'vue'

// Multi-tenant types
export interface Organization {
  id: string
  name: string
  slug: string
  domain?: string
  settings?: Record<string, any>
  createdAt?: Date
  updatedAt?: Date
}

export interface TenantContext {
  organization: Organization | null
  isMultiTenant: boolean
}

export interface MultiTenantComposable {
  /**
   * Current organization/tenant
   */
  organization: ComputedRef<Organization | null>
  /**
   * Whether multi-tenant mode is enabled
   */
  isMultiTenant: ComputedRef<boolean>
  /**
   * Current tenant ID
   */
  tenantId: ComputedRef<string | null>
  /**
   * Switch to different organization (if user has access)
   */
  switchOrganization: (organizationId: string) => Promise<void>
  /**
   * Refresh organization data
   */
  refresh: () => Promise<void>
}

// Tenant detection strategies
export type TenantStrategy = 'subdomain' | 'path' | 'header' | 'custom'

export interface TenantConfig {
  strategy: TenantStrategy
  /**
   * Custom function for tenant detection
   */
  resolver?: (event: any) => string | null
  /**
   * Header name for header strategy
   */
  header?: string
  /**
   * Path segment index for path strategy (default: 0)
   */
  pathIndex?: number
  /**
   * Domain mapping for subdomain strategy
   */
  domainMapping?: Record<string, string>
}

// Server-side tenant context
export interface ServerTenantContext {
  organizationId: string | null
  organization: Organization | null
  strategy: TenantStrategy
}
