import { expect, test, type Download } from "@playwright/test";
import { readFile } from "node:fs/promises";

const inputs = [
  { name: "hello.txt", mimeType: "text/plain", buffer: Buffer.from("Hello Birchize!\n") },
  { name: "笔记.txt", mimeType: "text/plain", buffer: Buffer.from("桦木与花 · 中文内容\n") },
  { name: "data.json", mimeType: "application/json", buffer: Buffer.from('{"local":true}') },
];

async function contents(download: Download) {
  const path = await download.path();
  expect(path).toBeTruthy();
  return readFile(path!);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("birchize-onboarding-v1", "seen"));
  await page.goto("/#archives");
});

for (const format of ["zip", "7z", "tar", "tar.gz", "tar.bz2", "tar.xz"]) {
  test(`create ${format}: multiple files, append, remove, list and extract`, async ({ page }) => {
    await page.getByRole("tab", { name: "创建压缩包" }).click();
    const input = page.locator('input[type="file"]');
    await expect(input).toHaveAttribute("multiple", "");
    await input.setInputFiles(inputs.slice(0, 2));
    await input.setInputFiles(inputs.slice(2));
    await expect(page.locator(".file-row")).toHaveCount(3);
    await page.getByRole("button", { name: "清空 笔记.txt", exact: true }).click();
    await expect(page.locator(".file-row")).toHaveCount(2);
    await input.setInputFiles(inputs.slice(1, 2));
    await expect(page.locator(".file-row")).toHaveCount(3);
    await page.getByRole("combobox", { name: "输出格式", exact: true }).click();
    await page.getByRole("option", { name: format.toUpperCase(), exact: true }).click();
    const downloading = page.waitForEvent("download", { timeout: 25_000 });
    await page.getByRole("button", { name: /^创建压缩包 \(\d+\)$/ }).click();
    const archive = await downloading;
    expect(archive.suggestedFilename()).toBe(`birchize-archive.${format}`);
    const buffer = await contents(archive);
    expect(buffer.byteLength).toBeGreaterThan(0);
    await expect(page.getByRole("alert")).toHaveCount(0);

    await page.reload();
    await page.locator('input[type="file"]').setInputFiles({
      name: archive.suggestedFilename(), mimeType: "application/octet-stream", buffer,
    });
    await page.getByRole("button", { name: "浏览压缩包", exact: true }).click();
    await expect(page.locator(".archive-entry")).toHaveCount(3);
    for (const file of inputs) {
      const extracting = page.waitForEvent("download");
      await page.getByRole("button", { name: `提取 ${file.name}`, exact: true }).click();
      const extracted = await extracting;
      expect(extracted.suggestedFilename()).toBe(file.name);
      expect(await contents(extracted)).toEqual(file.buffer);
    }
    await expect(page.getByRole("alert")).toHaveCount(0);
  });
}

test("AES ZIP with multiple files rejects a wrong password and extracts with the right password", async ({ page }) => {
  await page.getByRole("tab", { name: "创建压缩包" }).click();
  await page.locator('input[type="file"]').setInputFiles(inputs);
  await page.locator('input[type="password"]').fill("Birchize-本地-2026");
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: /^创建压缩包 \(\d+\)$/ }).click();
  const archive = await downloading;
  const buffer = await contents(archive);
  await page.reload();
  await page.locator('input[type="file"]').setInputFiles({ name: "secret.zip", mimeType: "application/zip", buffer });
  await page.locator('input[type="password"]').fill("wrong-password");
  await page.getByRole("button", { name: "浏览压缩包", exact: true }).click();
  await expect(page.locator(".archive-entry")).toHaveCount(3);
  await page.getByRole("button", { name: "提取 hello.txt", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page.locator('input[type="password"]').fill("Birchize-本地-2026");
  await page.getByRole("button", { name: "浏览压缩包", exact: true }).click();
  await expect(page.locator(".archive-entry")).toHaveCount(3);
  const extracting = page.waitForEvent("download");
  await page.getByRole("button", { name: "提取 hello.txt", exact: true }).click();
  expect(await contents(await extracting)).toEqual(inputs[0].buffer);
});

test("every format preserves incompressible bytes, empty files and colliding names", async ({ page }) => {
  const results = await page.evaluate(async () => {
    const modulePath = "/src/engines/archive.ts";
    const libraryPath = "/node_modules/.vite/deps/libarchive__js.js";
    const { createArchive, archiveFormats } = await import(modulePath);
    const { Archive } = await import(libraryPath);
    const random = new Uint8Array(300_007);
    for (let offset = 0; offset < random.length; offset += 65_536)
      crypto.getRandomValues(random.subarray(offset, Math.min(offset + 65_536, random.length)));
    const inputs = [
      new File([random], "random.bin"), new File([], "empty.txt"),
      new File(["first"], "note.txt"), new File(["second"], "note.txt"),
    ];
    const digest = async (blob: Blob) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await blob.arrayBuffer())))
      .map((n) => n.toString(16).padStart(2, "0")).join("");
    const expected: Record<string, string> = {};
    for (const [i, name] of ["random.bin", "empty.txt", "note.txt", "note (2).txt"].entries())
      expected[name] = await digest(inputs[i]);
    const results = [];
    for (const format of archiveFormats) {
      const { blob, name } = await createArchive(inputs, format);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const header = Array.from(bytes.slice(0, 6)).map((n) => n.toString(16).padStart(2, "0")).join("");
      Archive.init({ workerUrl: new URL("/engines/archive/worker-bundle.js", location.href).href });
      const archive = await Archive.open(new File([blob], name));
      const hashes: Record<string, string> = {};
      for (const entry of await archive.getFilesArray())
        hashes[entry.path + entry.file.name] = await digest(await entry.file.extract());
      await archive.close();
      results.push({ format, header, expected, hashes });
    }
    return results;
  });
  for (const result of results) {
    expect(result.hashes, result.format).toEqual(result.expected);
    const magic: Record<string, string> = { zip: "504b0304", "7z": "377abcaf271c", "tar.gz": "1f8b", "tar.bz2": "425a68", "tar.xz": "fd377a585a00" };
    if (magic[result.format]) expect(result.header.startsWith(magic[result.format]), result.format).toBe(true);
  }
});

test("mobile multi-file creation and format menu fit the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("tab", { name: "创建压缩包" }).click();
  await page.locator('input[type="file"]').setInputFiles(inputs);
  await expect(page.locator(".archive-batch-summary")).toContainText("3");
  await page.getByRole("combobox", { name: "输出格式", exact: true }).click();
  await expect(page.getByRole("option")).toHaveCount(6);
  const menu = await page.getByRole("listbox").boundingBox();
  expect(menu).not.toBeNull();
  expect(menu!.x).toBeGreaterThanOrEqual(0);
  expect(menu!.x + menu!.width).toBeLessThanOrEqual(390);
  await page.getByRole("option", { name: "TAR.XZ", exact: true }).click();
  await expect(page.locator('input[type="password"]')).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: "test-results/archives-mobile.png", fullPage: true });
});
