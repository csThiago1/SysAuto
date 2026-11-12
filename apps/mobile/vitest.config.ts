import path from 'path';
import { defineConfig } from 'vitest/config';

// ponytail: só testes de lógica pura (stores); sem jsdom nem React Native.
export default defineConfig({
  test: { include: ['src/**/*.test.ts'] },
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
});
