// Dynamic imports to avoid bundler warnings for optional dependencies
async function loadSqliteDriver() {
  const [{ drizzle }, Database, { migrate }] = await Promise.all([
    import('drizzle-orm/better-sqlite3'),
    import('better-sqlite3').then(m => m.default || m),
    import('drizzle-orm/better-sqlite3/migrator')
  ])
  return { drizzle, Database, migrate }
}

async function loadPostgresDriver() {
  const [{ drizzle }, postgres, { migrate }] = await Promise.all([
    import('drizzle-orm/postgres-js'),
    import('postgres').then(m => m.default || m),
    import('drizzle-orm/postgres-js/migrator')
  ])
  return { drizzle, postgres, migrate }
}

async function loadMysqlDriver() {
  const [{ drizzle }, mysql, { migrate }] = await Promise.all([
    import('drizzle-orm/mysql2'),
    import('mysql2/promise').then(m => m.default || m),
    import('drizzle-orm/mysql2/migrator')
  ])
  return { drizzle, mysql, migrate }
}
import { createError } from 'h3'
import * as schema from './schema'
import { useRuntimeConfig } from '#imports'

export type DatabaseConfig = {
  provider: 'sqlite' | 'postgres' | 'mysql'
  url: string
  migrationsPath?: string
  enableLogging?: boolean
}

export type DatabaseInstance = ReturnType<typeof drizzle> | ReturnType<typeof drizzlePostgres> | ReturnType<typeof drizzleMysql>

let dbInstance: DatabaseInstance | null = null
let dbConfig: DatabaseConfig | null = null

export async function createDatabaseConnection(config: DatabaseConfig): Promise<DatabaseInstance> {
  try {
    switch (config.provider) {
      case 'sqlite': {
        const { drizzle, Database } = await loadSqliteDriver()
        const sqlite = new Database(config.url)
        const db = drizzle(sqlite, {
          schema,
          logger: config.enableLogging,
        })
        return db
      }

      case 'postgres': {
        const { drizzle, postgres } = await loadPostgresDriver()
        const connection = postgres(config.url)
        const db = drizzle(connection, {
          schema,
          logger: config.enableLogging,
        })
        return db
      }

      case 'mysql': {
        const { drizzle, mysql } = await loadMysqlDriver()
        const connection = mysql.createConnection(config.url)
        const db = drizzle(connection, {
          schema,
          logger: config.enableLogging,
        })
        return db
      }

      default:
        throw createError({
          statusCode: 500,
          statusMessage: `Unsupported database provider: ${config.provider}`,
        })
    }
  }
  catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to create database connection: ${error.message}`,
    })
  }
}

export async function runMigrations(db: DatabaseInstance, config: DatabaseConfig): Promise<void> {
  if (!config.migrationsPath) return

  try {
    switch (config.provider) {
      case 'sqlite': {
        const { migrate } = await loadSqliteDriver()
        await migrate(db as any, { migrationsFolder: config.migrationsPath })
        break
      }
      case 'postgres': {
        const { migrate } = await loadPostgresDriver()
        await migrate(db as any, { migrationsFolder: config.migrationsPath })
        break
      }
      case 'mysql': {
        const { migrate } = await loadMysqlDriver()
        await migrate(db as any, { migrationsFolder: config.migrationsPath })
        break
      }
    }
  }
  catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to run migrations: ${error.message}`,
    })
  }
}

export function getDatabase(): DatabaseInstance {
  if (!dbInstance) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Database not initialized. Make sure to enable the database feature in your Nuxt config.',
    })
  }
  return dbInstance
}

export function isDatabaseEnabled(): boolean {
  return dbInstance !== null
}

export async function initializeDatabase(): Promise<void> {
  if (dbInstance) return

  const runtimeConfig = useRuntimeConfig()

  // Check if database is configured
  const databaseUrl = process.env.NUXT_DATABASE_URL || runtimeConfig.database?.url
  if (!databaseUrl) {
    return // Database is optional
  }

  // Determine provider from URL
  let provider: DatabaseConfig['provider'] = 'sqlite'
  if (databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://')) {
    provider = 'postgres'
  }
  else if (databaseUrl.startsWith('mysql://')) {
    provider = 'mysql'
  }

  dbConfig = {
    provider,
    url: databaseUrl,
    migrationsPath: runtimeConfig.database?.migrationsPath,
    enableLogging: runtimeConfig.database?.enableLogging || false,
  }

  try {
    dbInstance = await createDatabaseConnection(dbConfig)

    // Run migrations if enabled
    if (runtimeConfig.database?.autoMigrate !== false) {
      await runMigrations(dbInstance, dbConfig)
    }

    console.log(`✅ Database connected successfully (${provider})`)
  }
  catch (error) {
    console.error('❌ Failed to initialize database:', error.message)
    throw error
  }
}

export function closeDatabaseConnection(): void {
  if (dbInstance && dbConfig?.provider === 'sqlite') {
    // Close SQLite connection
    const sqlite = (dbInstance as any).session
    if (sqlite?.close) {
      sqlite.close()
    }
  }
  dbInstance = null
  dbConfig = null
}

// Export schema for external usage
export { schema }
export type { DatabaseInstance }

// Re-export common Drizzle utilities
export { eq, and, or, not, isNull, isNotNull, inArray, notInArray, sql } from 'drizzle-orm'
export { desc, asc } from 'drizzle-orm'
