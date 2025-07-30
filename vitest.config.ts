import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'playground/**',
        '**/*.d.ts',
        'test/**',
        '**/*.config.*',
        '**/coverage/**',
      ],
    },
    setupFiles: ['./test/setup.ts'],
    typecheck: {
      tsconfig: './test/tsconfig.json',
    },
  },
  resolve: {
    alias: {
      '#imports': resolve(__dirname, './test/mocks/nuxt-imports.ts'),
      '~': resolve(__dirname, './'),
      '@': resolve(__dirname, './'),
      '~~': resolve(__dirname, './'),
      '@@': resolve(__dirname, './'),
    },
  },
  esbuild: {
    target: 'node16',
  },
})
