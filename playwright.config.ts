import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://localhost:5174",
    trace: "retain-on-failure",
    actionTimeout: 10_000,
    ...devices["Desktop Edge"],
    channel: "msedge",
  },
  webServer: {
    command: "npm run dev -- --port 5174 --strictPort",
    url: "http://localhost:5174",
    reuseExistingServer: !process.env.CI,
  },
});
