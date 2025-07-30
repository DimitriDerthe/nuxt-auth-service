// Development utilities
// This file exists to resolve build system import resolution issues
export const isDev = process.env.NODE_ENV === 'development'
export const isProduction = process.env.NODE_ENV === 'production'

// Re-export everything from atproto to maintain compatibility
export * from './atproto'