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
      'src/game/**/*.test.ts',
      'src/features/**/*.test.ts',
      'server/**/*.test.ts',
    ],
  },
});
