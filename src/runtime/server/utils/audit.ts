import type { H3Event } from 'h3'
import { getHeader, getClientIP } from 'h3'
import { randomUUID } from 'uncrypto'
import { schema } from '../database/connection'
import { useDatabase, isDatabaseFeatureEnabled } from './database'
import { getUserSession } from './session'
import { getCurrentTenantId } from './tenant'

export interface AuditLogData {
  action: string
  resource?: string
  resourceId?: string
  details?: Record<string, any>
  userId?: string
  organizationId?: string | null
  ipAddress?: string
  userAgent?: string
  severity?: 'low' | 'medium' | 'high' | 'critical'
  outcome?: 'success' | 'failure' | 'error'
}

/**
 * Log audit event with enhanced security tracking
 */
export async function logAudit(event: H3Event, data: Omit<AuditLogData, 'userId' | 'organizationId' | 'ipAddress' | 'userAgent'>): Promise<void> {
  const startTime = Date.now()

  try {
    // Always log to console for immediate visibility
    const logLevel = getSeverityLogLevel(data.severity || 'low')
    console[logLevel](`[AUDIT] ${data.action}:`, {
      resource: data.resource,
      resourceId: data.resourceId,
      outcome: data.outcome,
      severity: data.severity,
      timestamp: new Date().toISOString(),
    })

    if (!isDatabaseFeatureEnabled()) {
      return
    }

    const db = useDatabase()
    const session = await getUserSession(event).catch(() => null)
    const organizationId = getCurrentTenantId(event)
    const ipAddress = getClientIP(event)
    const userAgent = getHeader(event, 'user-agent')

    // Enhanced details with security context
    const enhancedDetails = {
      ...data.details,
      sessionId: session?.id,
      timestamp: new Date().toISOString(),
      processingTime: Date.now() - startTime,
      severity: data.severity || 'low',
      outcome: data.outcome || 'success',
      // Security risk indicators
      riskFactors: assessRiskFactors(data, ipAddress, userAgent, session),
    }

    await db.insert(schema.auditLogs).values({
      id: randomUUID(),
      organizationId,
      userId: session?.user?.id || null,
      action: data.action,
      resource: data.resource,
      resourceId: data.resourceId,
      details: enhancedDetails,
      ipAddress,
      userAgent,
      createdAt: new Date(),
    })

    // Trigger security alerts for high-severity events
    if (data.severity === 'critical' || data.severity === 'high') {
      await triggerSecurityAlert(data, enhancedDetails)
    }
  }
  catch (error) {
    console.error('Failed to log audit event:', {
      action: data.action,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    })
    // Don't throw error to avoid breaking the main operation
  }
}

/**
 * Get severity-based log level
 */
function getSeverityLogLevel(severity: string): 'log' | 'info' | 'warn' | 'error' {
  switch (severity) {
    case 'critical': return 'error'
    case 'high': return 'error'
    case 'medium': return 'warn'
    case 'low': return 'info'
    default: return 'log'
  }
}

/**
 * Assess risk factors for security monitoring
 */
function assessRiskFactors(data: any, ipAddress?: string, userAgent?: string, session?: any): string[] {
  const riskFactors: string[] = []

  // Check for suspicious IP patterns
  if (ipAddress) {
    if (isPrivateIP(ipAddress)) riskFactors.push('private_ip')
    if (isTorExitNode(ipAddress)) riskFactors.push('tor_exit_node')
  }

  // Check for suspicious user agent patterns
  if (userAgent) {
    if (isSuspiciousUserAgent(userAgent)) riskFactors.push('suspicious_user_agent')
    if (isAutomatedClient(userAgent)) riskFactors.push('automated_client')
  }

  // Check for security-related actions
  if (data.action?.includes('admin') || data.action?.includes('super')) {
    riskFactors.push('privileged_action')
  }

  if (data.outcome === 'failure') {
    riskFactors.push('failed_operation')
  }

  // Check session anomalies
  if (session && isAnomalousSession(session)) {
    riskFactors.push('anomalous_session')
  }

  return riskFactors
}

/**
 * Check if IP is private/internal
 */
function isPrivateIP(ip: string): boolean {
  const privateRanges = [
    /^10\./,
    /^192\.168\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^127\./,
    /^::1$/,
    /^fc00:/,
    /^fe80:/,
  ]
  return privateRanges.some(range => range.test(ip))
}

/**
 * Check if IP is known Tor exit node (simplified check)
 */
function isTorExitNode(ip: string): boolean {
  // In production, this should check against a real Tor exit node list
  return false
}

/**
 * Check for suspicious user agent patterns
 */
function isSuspiciousUserAgent(userAgent: string): boolean {
  const suspiciousPatterns = [
    /curl/i,
    /wget/i,
    /python/i,
    /bot/i,
    /crawler/i,
    /scanner/i,
    /hack/i,
    /exploit/i,
  ]
  return suspiciousPatterns.some(pattern => pattern.test(userAgent))
}

/**
 * Check if user agent indicates automated client
 */
function isAutomatedClient(userAgent: string): boolean {
  const automatedPatterns = [
    /postman/i,
    /insomnia/i,
    /rest-client/i,
    /http-client/i,
  ]
  return automatedPatterns.some(pattern => pattern.test(userAgent))
}

/**
 * Check for anomalous session characteristics
 */
function isAnomalousSession(session: any): boolean {
  // Check for very new or very old sessions
  if (session.loggedInAt) {
    const sessionAge = Date.now() - new Date(session.loggedInAt).getTime()
    const oneHour = 60 * 60 * 1000
    const oneWeek = 7 * 24 * oneHour

    if (sessionAge < oneHour * 0.1 || sessionAge > oneWeek) {
      return true
    }
  }

  return false
}

/**
 * Trigger security alert for high-severity events
 */
async function triggerSecurityAlert(data: any, details: any): Promise<void> {
  // In production, this should integrate with your alerting system
  console.error('[SECURITY ALERT]', {
    action: data.action,
    severity: data.severity,
    outcome: data.outcome,
    riskFactors: details.riskFactors,
    timestamp: details.timestamp,
  })

  // TODO: Integrate with alerting systems like:
  // - Slack/Discord webhooks
  // - Email notifications
  // - PagerDuty/OpsGenie
  // - SIEM systems
}

/**
 * Log authentication events with proper security classification
 */
export async function logAuthEvent(
  event: H3Event,
  action: 'login' | 'logout' | 'register' | 'password_change' | '2fa_enabled' | '2fa_disabled' | 'super_admin_login' | 'account_locked' | 'password_reset',
  outcome: 'success' | 'failure' | 'error' = 'success',
  details?: Record<string, any>,
): Promise<void> {
  const severity = getAuthEventSeverity(action, outcome)
  await logAudit(event, {
    action: `auth.${action}`,
    resource: 'auth',
    severity,
    outcome,
    details,
  })
}

/**
 * Determine severity for auth events
 */
function getAuthEventSeverity(action: string, outcome: string): 'low' | 'medium' | 'high' | 'critical' {
  if (outcome === 'failure' || outcome === 'error') {
    if (action.includes('super_admin') || action.includes('admin')) return 'critical'
    if (action === 'login' || action === '2fa_enabled') return 'high'
    return 'medium'
  }

  if (action.includes('super_admin')) return 'high'
  if (action === '2fa_disabled' || action === 'password_change') return 'medium'
  return 'low'
}

/**
 * Log user management events
 */
export async function logUserEvent(event: H3Event, action: 'create' | 'update' | 'delete' | 'role_assigned' | 'role_removed', userId: string, details?: Record<string, any>): Promise<void> {
  await logAudit(event, {
    action: `user.${action}`,
    resource: 'users',
    resourceId: userId,
    details,
  })
}

/**
 * Log organization events
 */
export async function logOrganizationEvent(event: H3Event, action: 'create' | 'update' | 'delete', organizationId: string, details?: Record<string, any>): Promise<void> {
  await logAudit(event, {
    action: `organization.${action}`,
    resource: 'organizations',
    resourceId: organizationId,
    details,
  })
}

/**
 * Log role management events
 */
export async function logRoleEvent(event: H3Event, action: 'create' | 'update' | 'delete' | 'assign' | 'remove', roleId: string, details?: Record<string, any>): Promise<void> {
  await logAudit(event, {
    action: `role.${action}`,
    resource: 'roles',
    resourceId: roleId,
    details,
  })
}
