import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: [
      'tests/app/**/*.test.ts',
      'tests/auth/**/*.test.ts',
      'tests/data/**/*.test.ts',
      'tests/media-detection/**/*.test.ts',
      'tests/media-evaluator/**/*.test.ts',
    ],
    exclude: ['node_modules', '.next', 'tests/runner*.js', 'tests/unit-*.mjs'],
    reporters: ['default'],
    testTimeout: 10000,
  },
});
