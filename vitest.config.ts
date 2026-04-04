import { configDefaults, defineConfig } from 'vitest/config'

const perfOnlyTests = process.env.RUN_PERF_TESTS === '1'
  ? []
  : ['src/core/layout/__tests__/engine-benchmark.test.ts']

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    exclude: [...configDefaults.exclude, 'e2e/**', ...perfOnlyTests],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        ...configDefaults.exclude,
        'e2e/**',
        'src/test/**',
        '**/*.test.{ts,tsx}',
        '**/__tests__/**',
      ],
    },
  },
})
