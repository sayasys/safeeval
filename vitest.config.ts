import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: [
      'tests/auth/**/*.test.ts',
      'tests/data/**/*.test.ts',
      'tests/report-generators/**/*.test.ts',
      'tests/media-detection/**/*.test.ts',
      'tests/osint/**/*.test.ts',
      'tests/feedback/**/*.test.ts',
    ],
    exclude: ['node_modules', '.next', 'tests/runner*.js', 'tests/unit-*.mjs'],
    reporters: ['default'],
    testTimeout: 10000,
  },
});
