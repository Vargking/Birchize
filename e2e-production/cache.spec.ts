import { test, expect } from "@playwright/test";
import { mockChinaMirrors, mirrorHost } from "./support";
import { readFile } from "node:fs/promises";

test("cache loading shows progress, retains downloads on reload and retries only missing files", async ({ page, context }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem("birchize-onboarding-v1", "seen"));
  await mockChinaMirrors(context);
  let fail = true;
  let keptFileRequests = 0;
  let mirrorsUsed = 0;
  context.on("request", (request) => {
    if (request.url().includes("libarchive.wasm")) keptFileRequests++;
    if (mirrorHost(new URL(request.url()))) mirrorsUsed++;
  });
  await context.route((url) => url.pathname.endsWith("ffmpeg-core.wasm"), async (route) => {
    if (fail) {
      await route.fulfill({ status: 503, body: "Temporary failure", headers: { "Access-Control-Allow-Origin": "*" } });
    } else await route.fallback();
  });
  await page.goto("./#images");
  const loading = page.locator(".cache-loading-dialog");
  await expect(loading).toBeVisible();
  await expect(loading.getByRole("progressbar")).toBeVisible();
  await expect(loading).toContainText("还有一些资源需要准备", { timeout: 60_000 });
  await expect(loading).toContainText("engines/ffmpeg-core.wasm");
  await expect(loading).toContainText("HTTP 503");
  const percent = Number(await loading.getByRole("progressbar").getAttribute("aria-valuenow"));
  expect(percent).toBeGreaterThan(0);
  expect(percent).toBeLessThan(100);
  expect(mirrorsUsed).toBeGreaterThan(1);
  const requestsBeforeRetry = keptFileRequests;
  expect(requestsBeforeRetry).toBe(1);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await loading.evaluate((element) => element.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: testInfo.outputPath("cache-loading-mobile.png") });
  // Reload a partial cache: successfully saved files must not download again.
  const cdp = await context.newCDPSession(page);
  await cdp.send("ServiceWorker.enable");
  await cdp.send("ServiceWorker.stopAllWorkers");
  await cdp.detach();
  await page.reload();
  await expect(loading).toContainText("HTTP 503", { timeout: 60_000 });
  expect(keptFileRequests).toBe(requestsBeforeRetry);
  fail = false;
  await loading.getByRole("button", { name: "继续缓存", exact: true }).click();
  await expect(loading).not.toBeVisible({ timeout: 60_000 });
  await expect(page.locator(".offline-label")).toHaveText("已就绪，可离线使用");
  expect(keptFileRequests).toBe(requestsBeforeRetry);
  await context.unrouteAll();
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator(".offline-label")).toHaveText("已就绪，可离线使用");
  await expect(page.locator("input[type=file]")).toBeAttached();
});

test("a corrupt mirror response falls back to verified same-origin resources", async ({ page, context }) => {
  await page.addInitScript(() => localStorage.setItem("birchize-onboarding-v1", "seen"));
  await mockChinaMirrors(context);
  const original = await readFile("node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.js");
  const corrupt = Buffer.from(original);
  corrupt[0] ^= 1; // Same size, wrong hash: size checks alone must not accept it.
  let corruptResponses = 0;
  let localFallbacks = 0;
  context.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin === "http://localhost:4186" && url.pathname.endsWith("ffmpeg-core.js")) localFallbacks++;
  });
  await context.route((url) => mirrorHost(url) && url.pathname.endsWith("ffmpeg-core.js"), async (route) => {
    corruptResponses++;
    await route.fulfill({ body: corrupt, headers: {
      "Access-Control-Allow-Origin": "*", "Content-Type": "application/javascript",
    } });
  });
  await page.goto("./");
  await expect(page.locator(".offline-label")).toHaveText("已就绪，可离线使用", { timeout: 60_000 });
  expect(corruptResponses).toBe(2);
  expect(localFallbacks).toBe(1);
  const savedBytes = await page.evaluate(async () => {
    const cacheName = (await caches.keys()).find((name) => name.startsWith("birchize-%2FBirchize%2F-"))!;
    const response = await (await caches.open(cacheName)).match(new URL("engines/ffmpeg-core.js", document.baseURI));
    return Array.from(new Uint8Array(await response!.arrayBuffer()));
  });
  expect(Buffer.from(savedBytes).equals(original)).toBe(true);
});

test("tools can open while caching continues in the background", async ({ page, context }) => {
  await page.addInitScript(() => localStorage.setItem("birchize-onboarding-v1", "seen"));
  await mockChinaMirrors(context);
  await context.route((url) => url.pathname.endsWith("ffmpeg-core.wasm"), async (route) => {
    await route.fulfill({ status: 503, body: "Temporary failure", headers: { "Access-Control-Allow-Origin": "*" } });
  });
  await page.goto("./#images");
  await page.getByRole("button", { name: "先进入工具，后台继续", exact: true }).click();
  await expect(page.locator(".cache-loading-dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "选择文件", exact: true })).toBeVisible();
  await page.locator(".offline-label").click();
  await expect(page.locator(".cache-loading-dialog")).toBeVisible();
});
