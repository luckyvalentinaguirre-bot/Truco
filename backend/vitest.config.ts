import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // El paquete compartido se distribuye como fuente TS: hay que transformarlo
    // (no externalizarlo como si fuese JS de node_modules).
    server: { deps: { inline: [/@truco\/game-rules/] } },
    // Los tests de repositorios usan una base real: sin paralelismo entre
    // archivos para no pisarse las tablas.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
