export default defineNuxtConfig({
  // ssr: false,
  extends: ['@nuxt/ui-pro'],
  modules: ['nuxt-auth-utils', '@nuxt/ui', '@vueuse/nuxt'],
  imports: {
    autoImport: true,
  },
  devtools: { enabled: true },
  routeRules: {
    '/': {
      // prerender: true,
      // swr: 5,
      // ssr: false,
    },
  },
  devServer: {
    host: '127.0.0.1',
  },
  compatibilityDate: '2024-06-17',
  nitro: {
    experimental: {
      database: true,
      websocket: true,
    },
  },
  auth: {
    // Existing features
    webAuthn: true,
    atproto: true,

    // New features - Database integration
    database: {
      enabled: true,
      // URL will be read from NUXT_DATABASE_URL environment variable
      autoMigrate: true,
      enableLogging: true, // Enable SQL logging in development
    },

    // Role-Based Access Control
    rbac: {
      enabled: true,
      defaultRole: 'user',
    },

    // Multi-tenant support
    multiTenant: {
      enabled: true,
      strategy: 'subdomain', // Can also use 'path' or 'header'
    },

    // Two-Factor Authentication
    totp: {
      enabled: true,
      config: {
        issuer: 'Auth Utils Demo',
        backupCodesCount: 12,
      },
    },

    // UI Customization
    ui: {
      enabled: true,
      theme: {
        colors: {
          primary: '#3B82F6',
        },
        borderRadius: {
          md: 'rounded-lg',
        },
      },
      i18n: true,
      defaultLocale: 'en',
    },
  },
})
