import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'url'

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: [
      'src/**/*.test.ts',
      'tests/unit/**/*.test.ts',
      'tests/integration/**/*.test.ts',
    ],
    setupFiles: ['tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/server/**/*.ts', 'src/lib/**/*.ts'],
    },
  },
})
