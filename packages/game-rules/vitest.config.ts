import { defineConfig } from 'vitest/config';

// El motor se prueba SIN navegador ni DOM: entorno node puro.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
