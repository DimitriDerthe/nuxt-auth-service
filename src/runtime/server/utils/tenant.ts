import type { H3Event } from 'h3'
import { getHeader, getRouterParam, createError } from 'h3'
import { schema, eq } from '../database/connection'
import { useDatabase, isDatabaseFeatureEnabled } from './database'
import { useRuntimeConfig } from '#imports'
import type { TenantStrategy, ServerTenantContext, Organization } from '#auth-utils'

const tenantContext: Map<string, ServerTenantContext> = new Map()

/**
 * Get tenant context from event
 */
export function getTenantContext(event: H3Event): ServerTenantContext | null {
  const eventId = (event as any).__tenantContextId__ || 'default'
  return tenantContext.get(eventId) || null
}

/**
 * Set tenant context for event
 */
export function setTenantContext(event: H3Event, context: ServerTenantContext): void {
  const eventId = (event as any).__tenantContextId__ || 'default'
  ;(event as any).__tenantContextId__ = eventId
  tenantContext.set(eventId, context)
}

/**
 * Detect tenant from request using configured strategy
 */
export async function detectTenant(event: H3Event): Promise<string | null> {
  const config = useRuntimeConfig()

  if (!config.multiTenant?.enabled) {
    return null
  }

  const strategy = config.multiTenant.strategy

  switch (strategy) {
    case 'subdomain':
      return detectTenantFromSubdomain(event)

    case 'path':
      return detectTenantFromPath(event, config.multiTenant.pathIndex || 0)

    case 'header':
      return detectTenantFromHeader(event, config.multiTenant.header || 'x-tenant-id')

    case 'custom':
      return detectTenantFromCustomResolver(event, config.multiTenant.resolver)

    default:
      return null
  }
}

/**
 * Detect tenant from subdomain
 */
function detectTenantFromSubdomain(event: H3Event): string | null {
  const host = getHeader(event, 'host')
  if (!host) return null

  const hostParts = host.split('.')
  if (hostParts.length < 3) return null // Need at least subdomain.domain.tld

  const subdomain = hostParts[0]

  // Skip common subdomains
  if (['www', 'api', 'admin', 'app'].includes(subdomain)) {
    return null
  }

  return subdomain
}

/**
 * Detect tenant from URL path
 */
function detectTenantFromPath(event: H3Event, pathIndex: number): string | null {
  const url = new URL(event.node.req.url!, `http://${getHeader(event, 'host')}`)
  const pathSegments = url.pathname.split('/').filter(Boolean)

  if (pathSegments.length <= pathIndex) return null

  return pathSegments[pathIndex]
}

/**
 * Detect tenant from header
 */
function detectTenantFromHeader(event: H3Event, headerName: string): string | null {
  return getHeader(event, headerName) || null
}

/**
 * Detect tenant using custom resolver
 */
function detectTenantFromCustomResolver(event: H3Event, resolverPath?: string): string | null {
  if (!resolverPath) return null

  try {
    // This would need to be implemented to dynamically import the resolver
    // For now, return null
    return null
  }
  catch (error) {
    console.error('Error in custom tenant resolver:', error)
    return null
  }
}

/**
 * Get organization by tenant identifier
 */
export async function getOrganizationByTenant(tenantId: string): Promise<Organization | null> {
  if (!isDatabaseFeatureEnabled()) {
    return null
  }

  try {
    const db = useDatabase()
    const result = await db.select()
      .from(schema.organizations)
      .where(eq(schema.organizations.slug, tenantId))
      .limit(1)

    return result[0] || null
  }
  catch (error) {
    console.error('Error fetching organization:', error)
    return null
  }
}

/**
 * Get current tenant ID from event
 */
export function getCurrentTenantId(event: H3Event): string | null {
  const context = getTenantContext(event)
  return context?.organizationId || null
}

/**
 * Get current organization from event
 */
export function getCurrentOrganization(event: H3Event): Organization | null {
  const context = getTenantContext(event)
  return context?.organization || null
}

/**
 * Require tenant for this request
 */
export function requireTenant(event: H3Event): ServerTenantContext {
  const context = getTenantContext(event)

  if (!context || !context.organizationId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Tenant not found or invalid',
    })
  }

  return context
}

/**
 * Initialize tenant context for request
 */
export async function initializeTenantContext(event: H3Event): Promise<void> {
  const config = useRuntimeConfig()

  if (!config.multiTenant?.enabled) {
    // Set default context for single-tenant mode
    setTenantContext(event, {
      organizationId: null,
      organization: null,
      strategy: 'subdomain',
    })
    return
  }

  const tenantId = await detectTenant(event)
  const strategy = config.multiTenant.strategy

  if (!tenantId) {
    setTenantContext(event, {
      organizationId: null,
      organization: null,
      strategy,
    })
    return
  }

  // Get organization from database
  const organization = await getOrganizationByTenant(tenantId)

  if (!organization) {
    // Tenant not found - could be invalid subdomain/path
    setTenantContext(event, {
      organizationId: null,
      organization: null,
      strategy,
    })
    return
  }

  setTenantContext(event, {
    organizationId: organization.id,
    organization,
    strategy,
  })
}

/**
 * Check if current context is multi-tenant
 */
export function isMultiTenant(event?: H3Event): boolean {
  const config = useRuntimeConfig()
  return config.multiTenant?.enabled || false
}

/**
 * Get organization by ID with caching
 */
const organizationCache = new Map<string, { org: Organization | null, timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export async function getOrganizationById(organizationId: string): Promise<Organization | null> {
  // Check cache first
  const cached = organizationCache.get(organizationId)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.org
  }

  if (!isDatabaseFeatureEnabled()) {
    return null
  }

  try {
    const db = useDatabase()
    const result = await db.select()
      .from(schema.organizations)
      .where(eq(schema.organizations.id, organizationId))
      .limit(1)

    const org = result[0] || null

    // Cache the result
    organizationCache.set(organizationId, { org, timestamp: Date.now() })

    return org
  }
  catch (error) {
    console.error('Error fetching organization by ID:', error)
    return null
  }
}
