import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

const browser = {
  ...devices["Desktop Chrome"],
  // The sandbox pre-installs a Chromium build; PLAYWRIGHT_BROWSERS_PATH
  // may not match this @playwright/test version, so point at it directly.
  launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
    : undefined,
};

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  // Suites share one DB and mutate tracked-profile state; parallel workers
  // race each other (untrack loops, plan state), so run files serially.
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    // Signs in the shared E2E user via the magic-link flow and saves the
    // session for every other spec.
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
      use: browser,
    },
    {
      name: "chromium",
      use: { ...browser, storageState: "e2e/.auth/user.json" },
      dependencies: ["setup"],
    },
  ],
  webServer: [
    {
      command: `npm run dev -- --port ${PORT}`,
      url: `http://localhost:${PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        // E2E drives many audits from one IP; don't trip the public limit.
        AUDIT_RATE_LIMIT_PER_HOUR: "1000",
        // Redirect URLs (checkout, magic links) must point at this server.
        NEXT_PUBLIC_APP_URL: `http://localhost:${PORT}`,
        E2E_TEST_MODE: "1",
        STRIPE_API_BASE: "http://localhost:12111",
        STRIPE_SECRET_KEY: "sk_test_123",
        STRIPE_WEBHOOK_SECRET: "whsec_test_secret_findable",
      },
    },
    {
      // Stripe API double for the checkout/webhook path. Build once with:
      // GOBIN=$PWD/.bin go install github.com/stripe/stripe-mock@latest
      command: ".bin/stripe-mock -port 12111",
      port: 12111,
      reuseExistingServer: true,
      timeout: 30_000,
    },
  ],
});
