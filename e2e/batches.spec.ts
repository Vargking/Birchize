import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

const images = ["first", "second", "third"].map((name, index) => ({
  name: `${name}.svg`,
  mimeType: "image/svg+xml",
  buffer: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="24"><rect width="32" height="24" fill="${["#668844", "#88aacc", "#ccaa88"][index]}"/></svg>`),
}));
const documents = ["first", "second"].map((name) => ({ name: `${name}.txt`, mimeType: "text/plain", buffer: Buffer.from(`Birchize ${name}`) }));

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("birchize-onboarding-v1", "seen"));
});

test("images: upload feedback, independent checkboxes, retained batches and batch ZIP", async ({ page }) => {
  await page.goto("/#images");
  await page.locator('input[type="file"]').setInputFiles(images.slice(0, 2));
  await expect(page.locator(".file-success-toast")).toContainText("文件添加成功 · 2");
  await expect(page.locator(".file-info").first()).toContainText("32 × 24 px");
  await expect(page.getByRole("checkbox", { name: "选择 first.svg", exact: true })).toBeChecked();
  await page.getByRole("checkbox", { name: "选择 second.svg", exact: true }).uncheck();
  await expect(page.getByRole("checkbox", { name: "全选", exact: true })).toHaveJSProperty("indeterminate", true);
  await page.getByRole("button", { name: "转换所选文件 (1)", exact: true }).click();
  await expect(page.locator(".result-batch")).toHaveCount(1);
  await expect(page.locator(".result-batch").first().locator(".result-card")).toHaveCount(1);
  await expect(page.locator(".result-batch").first()).toContainText("first.jpg");

  // Appending selects only the new file, keeping the existing unchecked file unchecked.
  await page.locator('input[type="file"]').setInputFiles(images.slice(2));
  await expect(page.locator(".file-success-toast")).toContainText("文件添加成功 · 1");
  await expect(page.getByRole("checkbox", { name: "选择 second.svg", exact: true })).not.toBeChecked();
  await expect(page.getByRole("checkbox", { name: "选择 third.svg", exact: true })).toBeChecked();
  await page.getByRole("button", { name: "转换所选文件 (2)", exact: true }).click();
  await expect(page.locator(".result-batch")).toHaveCount(2);
  await expect(page.locator(".result-batch").first().locator(".result-card")).toHaveCount(2);
  await expect(page.locator(".result-batch").last().locator(".result-card")).toHaveCount(1);
  await expect(page.locator(".result-batch").first().locator(".batch-status")).toHaveText("处理完成");
  const downloading = page.waitForEvent("download");
  await page.locator(".result-batch").first().getByRole("button", { name: "下载本批次" }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe("birchize-batch-2.zip");
  const bytes = await readFile((await download.path())!);
  const names = await page.evaluate(async (encoded) => {
    const modulePath = "/node_modules/.vite/deps/@zip__js_zip__js.js";
    const { ZipReader, BlobReader } = await import(modulePath);
    const reader = new ZipReader(new BlobReader(new Blob([new Uint8Array(encoded)])), { useWebWorkers: false });
    const names = (await reader.getEntries()).map((entry: { filename: string }) => entry.filename);
    await reader.close();
    return names;
  }, Array.from(bytes));
  expect(names).toEqual(["1-first.jpg", "2-third.jpg"]);

  await page.getByRole("checkbox", { name: "全选", exact: true }).check();
  await page.getByRole("checkbox", { name: "全选", exact: true }).uncheck();
  await expect(page.getByRole("button", { name: "转换所选文件 (0)", exact: true })).toBeDisabled();
  await page.getByRole("checkbox", { name: "选择 second.svg", exact: true }).check();
  await page.getByRole("button", { name: "清空 second.svg", exact: true }).click();
  await expect(page.getByRole("button", { name: "转换所选文件 (0)", exact: true })).toBeDisabled();
  await page.locator(".sidebar .brand").click();
  await expect(page.locator(".recent-batch")).toHaveCount(2);
});

test("duplicate files are not reported as added and keep their checkbox state", async ({ page }) => {
  await page.goto("/#images");
  // Use a fixed lastModified so both additions represent exactly the same file.
  const addFile = () => page.locator('input[type="file"]').evaluate((input: HTMLInputElement) => {
    const transfer = new DataTransfer();
    const original = new File(['<svg xmlns="http://www.w3.org/2000/svg" width="32" height="24"><rect width="32" height="24" fill="#668844"/></svg>'], 'first.svg', { type: 'image/svg+xml', lastModified: 1 });
    transfer.items.add(original);
    Object.defineProperty(input, "files", { configurable: true, value: transfer.files });
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await addFile();
  await expect(page.locator(".file-row")).toHaveCount(1);
  await expect(page.locator(".file-success-toast")).toContainText("文件添加成功 · 1");
  const checkbox = page.getByRole("checkbox", { name: "选择 first.svg", exact: true });
  await expect(checkbox).toBeChecked();
  await checkbox.uncheck();
  await addFile();
  await expect(page.locator(".file-row")).toHaveCount(1);
  await expect(checkbox).not.toBeChecked();
  await expect(page.locator(".file-success-toast")).toContainText("文件已在列表中，无需重复添加");
});

test("document preview is independent of batch selection", async ({ page }) => {
  await page.goto("/#documents");
  await page.locator('input[type="file"]').setInputFiles(documents);
  await page.getByRole("checkbox", { name: "选择 second.txt", exact: true }).uncheck();
  await page.getByRole("button", { name: "second.txt", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "选择 second.txt", exact: true })).not.toBeChecked();
  await page.getByRole("combobox", { name: "输出格式", exact: true }).click();
  await page.getByRole("option", { name: "HTML", exact: true }).click();
  await page.getByRole("button", { name: "转换所选文件 (1)", exact: true }).click();
  await expect(page.locator(".result-card")).toHaveCount(1);
  await expect(page.locator(".result-card")).toContainText("first.html");
  await page.getByRole("checkbox", { name: "全选", exact: true }).check();
  await page.getByRole("button", { name: "转换所选文件 (2)", exact: true }).click();
  await expect(page.locator(".result-batch")).toHaveCount(2);
  await expect(page.locator(".result-card")).toHaveCount(3);
});

test("crypto processes checked files only", async ({ page }) => {
  await page.goto("/#crypto");
  await page.locator('input[type="file"]').setInputFiles(documents);
  await page.getByRole("checkbox", { name: "选择 second.txt", exact: true }).uncheck();
  await page.getByLabel("密码", { exact: true }).fill("Birchize-2026!");
  await page.getByLabel("确认密码", { exact: true }).fill("Birchize-2026!");
  await page.getByRole("button", { name: "加密文件 (1)", exact: true }).click();
  await expect(page.locator(".result-card")).toHaveCount(1);
  await expect(page.locator(".result-card")).toContainText("first.txt.birch");
  await expect(page.locator(".batch-status")).toHaveText("处理完成");
});

test("mobile feedback, selection and results fit the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#images");
  await page.locator('input[type="file"]').setInputFiles(images.slice(0, 2));
  await expect(page.locator(".file-success-toast")).toBeVisible();
  const toast = await page.locator(".file-success-toast").boundingBox();
  expect(toast!.x).toBeGreaterThanOrEqual(0);
  expect(toast!.x + toast!.width).toBeLessThanOrEqual(390);
  await page.getByRole("button", { name: "转换所选文件 (2)", exact: true }).click();
  await expect(page.locator(".result-card")).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: "test-results/batches-mobile.png", fullPage: true });
});
