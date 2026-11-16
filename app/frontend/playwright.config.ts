import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PLAYWRIGHT_PORT ?? 4173);
const apiPort = Number(process.env.PLAYWRIGHT_API_PORT ?? 8011);
const baseURL = `http://127.0.0.1:${port}`;
const apiURL = `http://127.0.0.1:${apiPort}`;
const liveApi = process.env.PLAYWRIGHT_LIVE_API === "1";
const python = process.env.PLAYWRIGHT_PYTHON ?? "python3";

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  retries: 0,
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  outputDir: "test-results",
  use: {
    baseURL,
    serviceWorkers: "block",
    trace: process.env.PLAYWRIGHT_REAL_CLIP ? "off" : "retain-on-failure",
    screenshot: process.env.PLAYWRIGHT_REAL_CLIP ? "off" : "only-on-failure",
    video: process.env.PLAYWRIGHT_REAL_CLIP ? "off" : "retain-on-failure",
  },
  projects: [
    { name: "chromium-desktop", use: { ...devices["Desktop Chrome"], browserName: "chromium" } },
    { name: "chromium-mobile", use: { ...devices["iPhone 13"], browserName: "chromium" } },
    { name: "webkit-mobile", use: { ...devices["iPhone 13"], browserName: "webkit" } },
  ],
  webServer: [
    ...(liveApi
      ? [{
          command: `cd ../.. && env -u DATABASE_URL -u JWT_SECRET -u AUTH_FRONTEND_URL -u RESEND_API_KEY -u EMAIL_FROM FRONTEND_ORIGINS=${baseURL} ${python} -m uvicorn app.backend.main:app --host 127.0.0.1 --port ${apiPort}`,
          url: `${apiURL}/api/health`,
          reuseExistingServer: false,
          timeout: 60_000,
        }]
      : []),
    {
      command: `API_PROXY_TARGET=${apiURL} pnpm exec vite --host 127.0.0.1 --port ${port} --strictPort`,
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
