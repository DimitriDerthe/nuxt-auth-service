import { initializeTenantContext } from '../utils/tenant'

export default defineNitroPlugin((nitroApp) => {
  // Initialize tenant context on every request
  nitroApp.hooks.hook('request', async (event) => {
    try {
      await initializeTenantContext(event)
    }
    catch (error) {
      console.error('Failed to initialize tenant context:', error)
      // Don't throw error to avoid breaking the request
    }
  })
})
