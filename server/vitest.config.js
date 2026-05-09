import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['services/**', 'middleware/**', 'prompts/**', 'routes/**'],
      exclude: [
        '**/*.test.js',
        'services/github.js',   // external API wrapper — always mocked, not in ITER_14 scope
        'services/gitlab.js',   // external API wrapper — always mocked, not in ITER_14 scope
        'prompts/customise.js', // backward-compat re-export shim — no callers
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 85,
        statements: 90,
      },
    },
  },
});
