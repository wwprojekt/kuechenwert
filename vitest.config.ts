/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // Playwright-Specs (tests/e2e) laufen über `npm run test:e2e`.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules/**', 'dist/**'],
    css: true,
    // Nur mit `--coverage` aktiv (braucht @vitest/coverage-v8); bewusst ohne
    // Schwellenwerte, bis die Testabdeckung des Küchen-Codes aufgebaut ist.
    coverage: {
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/test/**',
        'src/integrations/supabase/types.ts',
        '**/*.d.ts',
        '**/*.{test,spec}.{ts,tsx}',
      ],
    },
    // Mock environment variables
    env: {
      VITE_SUPABASE_URL: 'http://localhost:54321',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
      NODE_ENV: 'test',
    },
  },
});
