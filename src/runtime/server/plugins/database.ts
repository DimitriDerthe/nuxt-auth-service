import { initializeDatabase, isDatabaseEnabled, getDatabase } from '../database/connection'
import { initializeDatabaseData } from '../database/seeds'

export default defineNitroPlugin(async (nitroApp) => {
  // Initialize database connection and run migrations
  try {
    await initializeDatabase()

    // Initialize default data if database is available
    if (isDatabaseEnabled()) {
      const db = getDatabase()
      await initializeDatabaseData(db)
    }
  }
  catch (error) {
    console.error('Database initialization failed:', error)
    // Don't throw error to allow app to start without database
    // Features requiring database will check availability individually
  }

  // Cleanup on close
  nitroApp.hooks.hook('close', async () => {
    const { closeDatabaseConnection } = await import('../database/connection')
    closeDatabaseConnection()
  })
})
