import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000,
    hookTimeout: 30000,
    teardownTimeout: 30000,
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.test.ts', 'test/**/*.test.js'],
    exclude: ['node_modules/**', 'dist/**']
  },
  resolve: {
    alias: {
      '@': './src'
    }
  }
}); 