import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    exclude: ['**/node_modules/**', '**/dist/**'],
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      REDIS_URL: 'redis://localhost:6379',
      CORS_ORIGIN: 'http://localhost:5173',
    },
  },
});
