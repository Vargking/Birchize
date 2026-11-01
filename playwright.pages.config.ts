import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e-production",
  outputDir: "./test-results-pages",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  workers: 1,
  use: {
    baseURL: "http://localhost:4174/Birchize/",
    ...devices["Desktop Edge"],
    channel: "msedge",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run preview -- --base=/Birchize/ --port 4174 --strictPort",
    url: "http://localhost:4174/Birchize/",
    reuseExistingServer: !process.env.CI,
  },
});
