import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

// El motor se prueba SIN renderizar componentes: entorno node puro.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: [
      'src/features/**/*.test.{ts,tsx}',
      'src/components/**/*.test.{ts,tsx}',
      'server/**/*.test.ts',
    ],
  },
});
