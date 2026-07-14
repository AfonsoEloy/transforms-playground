import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
  },
  resolve: {
    // Use rigid-kit's TS source (its package "development" export condition) so
    // app tests run against the library without a prior build step.
    conditions: ['development'],
  },
});
