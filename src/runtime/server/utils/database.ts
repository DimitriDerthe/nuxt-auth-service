import type { H3Event } from 'h3'
import { createError } from 'h3'
import { getDatabase, isDatabaseEnabled } from '../database/connection'

/**
 * Get the database instance
 * Throws an error if database is not configured
 */
export function useDatabase() {
  if (!isDatabaseEnabled()) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Database is not configured. Please set NUXT_DATABASE_URL environment variable or configure database in nuxt.config.ts',
    })
  }
  return getDatabase()
}

/**
 * Check if database is available
 */
export function useDatabaseOptional() {
  if (!isDatabaseEnabled()) {
    return null
  }
  return getDatabase()
}

/**
 * Require database for this operation
 * Returns the database instance or throws an error
 */
export function requireDatabase(event?: H3Event) {
  const db = useDatabaseOptional()
  if (!db) {
    throw createError({
      statusCode: 500,
      statusMessage: 'This feature requires database configuration. Please set NUXT_DATABASE_URL environment variable.',
    })
  }
  return db
}

/**
 * Check if a feature requiring database is enabled
 */
export function isDatabaseFeatureEnabled(): boolean {
  return isDatabaseEnabled()
}

/**
 * Execute a database transaction
 */
export async function withDatabaseTransaction<T>(
  callback: (db: ReturnType<typeof useDatabase>) => Promise<T>,
): Promise<T> {
  const db = useDatabase()

  // Note: Transaction implementation depends on the database provider
  // This is a simplified version - in real implementation, we'd need
  // to handle transactions properly for each database type
  return await callback(db)
}

// Re-export common database utilities
export { schema } from '../database/connection'
export type { DatabaseInstance } from '../database/connection'
