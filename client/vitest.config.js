import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/tests/setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**'],
      exclude: [
        'src/tests/**',
        'src/main.jsx',
        'src/App.jsx',                     // top-level router — not unit-testable
        'src/api.js',                      // client API helpers — not in ITER_16 scope
        'src/components/Shell.jsx',        // layout wrapper — not in ITER_16 scope
        'src/components/FileTree.jsx',     // not in ITER_16 scope
        'src/components/FileViewer.jsx',   // not in ITER_16 scope
        'src/components/TemplateGrid.jsx', // not in ITER_16 scope
      ],
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 80,
        statements: 85,
      },
    },
  },
});
