import path from 'node:path';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

/** Integration tests run inside workerd with a real local D1 binding. */
export default defineConfig({
  plugins: [
    cloudflareTest(async () => {
      const migrations = await readD1Migrations(path.join(import.meta.dirname, 'migrations'));
      return {
        wrangler: { configPath: './wrangler.test.jsonc' },
        miniflare: {
          bindings: {
            TEST_MIGRATIONS: migrations,
            // Explicit values so a local .dev.vars can never change test behaviour.
            APP_ENV: 'test',
            SIGNUP_CODE: 'test-invite-code',
            DEFAULT_PROVIDER: 'mock',
            CHAT_RATE_LIMIT: '100',
            CHAT_RATE_WINDOW_MINUTES: '5',
            LOGIN_RATE_LIMIT: '100',
            LOGIN_RATE_WINDOW_MINUTES: '15',
          },
        },
      };
    }),
  ],
  test: {
    name: 'integration',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/integration/**/*.test.ts'],
  },
});
