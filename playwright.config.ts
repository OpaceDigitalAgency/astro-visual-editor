import { defineConfig } from '@playwright/test';

// Multiple agent worktrees run this suite concurrently. A pinned port with
// reuseExistingServer silently attaches a run to whichever worktree brought
// the server up first, corrupting evidence. Override PW_PORT per worktree;
// an overridden port never reuses an existing server.
const port = Number(process.env.PW_PORT ?? 4357);
const portOverridden = process.env.PW_PORT !== undefined;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `npm run build && ASTRO_DEV_BACKGROUND=1 npm run dev --workspace astro-visual-editor-demo -- --host localhost --port ${port} --force`,
    url: `http://localhost:${port}`,
    timeout: 60_000,
    reuseExistingServer: portOverridden ? false : !process.env.CI,
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
