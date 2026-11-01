import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("birchize-onboarding-v1", "seen"));
  await page.goto("/#svg");
});

test("finished SVG stroke is present on every animation frame after pointer release", async ({ page }) => {
  await page.locator(".drawing-toolbar").getByRole("button", { name: "清空", exact: true }).click();
  const canvas = page.locator(".svg-canvas > svg");
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width * 0.4, box!.y + box!.height * 0.4);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width * 0.6, box!.y + box!.height * 0.6, { steps: 10 });
  const path = await canvas.locator("path").getAttribute("d");
  expect(path).toBeTruthy();
  await page.evaluate(() => {
    const state = window as unknown as { strokeFrames: boolean[]; watchStroke: () => void };
    state.strokeFrames = [];
    state.watchStroke = () => {
      state.strokeFrames.push(!!document.querySelector(".svg-canvas > svg path"));
      if (state.strokeFrames.length < 25) requestAnimationFrame(state.watchStroke);
    };
    requestAnimationFrame(state.watchStroke);
  });
  await page.mouse.up();
  await expect(canvas.locator("g").first().locator("path")).toHaveAttribute("d", path!);
  await page.waitForFunction(() => (window as unknown as { strokeFrames: boolean[] }).strokeFrames.length === 25);
  const frames = await page.evaluate(() => (window as unknown as { strokeFrames: boolean[] }).strokeFrames);
  expect(frames.every(Boolean)).toBe(true);
});

test("switching multiple SVGs preserves edits and color controls are local and styled", async ({ page }) => {
  await page.locator('input[type="file"]').setInputFiles([
    { name: "first.svg", mimeType: "image/svg+xml", buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="30" height="30" fill="#112233"/></svg>') },
    { name: "second.svg", mimeType: "image/svg+xml", buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="20"/></svg>') },
  ]);
  const canvas = page.locator(".svg-canvas > svg");
  await expect(canvas.locator("rect")).toHaveAttribute("fill", "#112233");
  const box = await canvas.boundingBox();
  await page.mouse.move(box!.x + box!.width * 0.4, box!.y + box!.height * 0.4);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width * 0.6, box!.y + box!.height * 0.6, { steps: 4 });
  await page.mouse.up();
  await expect(canvas.locator("path")).toHaveCount(1);
  await page.getByRole("button", { name: "second.svg", exact: true }).click();
  await expect(canvas.locator("circle")).toHaveCount(1);
  await page.getByRole("button", { name: "first.svg", exact: true }).click();
  await expect(canvas.locator("path")).toHaveCount(1);
  await page.locator(".color-control").click();
  const picker = page.locator(".color-popover");
  await expect(picker).toBeVisible();
  await picker.getByRole("textbox", { name: "HEX", exact: true }).fill("#223344");
  await expect(page.locator(".color-chip").first()).toHaveCSS("background-color", "rgb(34, 51, 68)");
  await expect(page.locator('input[type="color"], select')).toHaveCount(0);
});
