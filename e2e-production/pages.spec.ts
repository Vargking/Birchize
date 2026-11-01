import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

function sampleWav() {
  const wav = Buffer.alloc(44 + 8000);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(8000, 24);
  wav.writeUInt32LE(16000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(8000, 40);
  for (let i = 0; i < 4000; i++)
    wav.writeInt16LE(Math.round(Math.sin(i * 2 * Math.PI * 440 / 8000) * 8000), 44 + i * 2);
  return wav;
}

test("Pages subdirectory reloads offline and cold-loads local conversion engines", async ({ page, context }, testInfo) => {
  const errors: string[] = [];
  const externalRequests: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== "http://localhost:4174")
      externalRequests.push(request.url());
  });
  await page.addInitScript(() => localStorage.setItem("birchize-onboarding-v1", "seen"));
  await page.goto("./#images");
  await expect(page.locator('.sidebar .brand')).toContainText("Birchize");
  await expect(page.locator('input[type="file"]')).toBeAttached();
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.waitForFunction(() => navigator.serviceWorker.controller?.state === "activated");
  expect(await page.evaluate(async () => (await navigator.serviceWorker.ready).scope))
    .toBe("http://localhost:4174/Birchize/");

  // From here on, every page, lazy module, worker and WASM must load offline.
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('input[type="file"]')).toBeAttached();
  await page.locator('input[type="file"]').setInputFiles(["one", "two"].map((name) => ({
    name: `${name}.svg`, mimeType: "image/svg+xml",
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="30"><rect width="40" height="30" fill="#667755"/></svg>'),
  })));
  await page.getByRole("checkbox", { name: "选择 two.svg", exact: true }).uncheck();
  await page.getByRole("button", { name: "转换所选文件 (1)", exact: true }).click();
  await expect(page.locator(".batch-status")).toHaveText("处理完成");
  await expect(page.locator(".result-card")).toHaveCount(1);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: testInfo.outputPath("pages-offline-mobile.png"), fullPage: true });
  await page.setViewportSize({ width: 1280, height: 800 });

  await page.goto("./#archives");
  await page.reload();
  await page.getByRole("tab", { name: "创建压缩包", exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles(["offline", "excluded"].map((name) => ({
    name: `${name}.txt`, mimeType: "text/plain", buffer: Buffer.from(name),
  })));
  await page.getByRole("checkbox", { name: "选择 excluded.txt", exact: true }).uncheck();
  await page.getByRole("combobox", { name: "输出格式", exact: true }).click();
  await page.getByRole("option", { name: "7Z", exact: true }).click();
  const archiveDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "创建压缩包 (1)", exact: true }).click();
  const archive = await archiveDownload;
  expect(archive.suggestedFilename()).toBe("birchize-archive.7z");
  const archiveBytes = await readFile((await archive.path())!);
  expect(archiveBytes.subarray(0, 6).toString("hex")).toBe("377abcaf271c");
  await page.reload();
  await page.locator('input[type="file"]').setInputFiles({ name: "offline.7z", mimeType: "application/octet-stream", buffer: archiveBytes });
  await page.getByRole("button", { name: "浏览压缩包", exact: true }).click();
  await expect(page.locator(".archive-entry")).toHaveCount(1);
  await expect(page.locator(".archive-entry")).toContainText("offline.txt");

  await page.goto("./#media");
  await page.reload();
  await page.locator('input[type="file"]').setInputFiles(["offline", "excluded"].map((name) => ({
    name: `${name}.wav`, mimeType: "audio/wav", buffer: sampleWav(),
  })));
  await page.getByRole("checkbox", { name: "选择 excluded.wav", exact: true }).uncheck();
  await page.getByRole("combobox", { name: "输出格式", exact: true }).click();
  await page.getByRole("option", { name: "MP3", exact: true }).click();
  await page.getByRole("button", { name: "转换所选文件 (1)", exact: true }).click();
  await expect(page.locator(".batch-status")).toHaveText("处理完成", { timeout: 60_000 });
  await expect(page.locator(".result-card")).toHaveCount(1);
  await expect(page.locator(".result-card")).toContainText("offline.mp3");
  const mp3Download = page.waitForEvent("download");
  await page.locator(".result-card").getByRole("button", { name: "下载", exact: true }).click();
  expect((await readFile((await (await mp3Download).path())!)).byteLength).toBeGreaterThan(100);

  await page.goto("./#documents");
  await page.reload();
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF();
  pdf.text("Birchize offline PDF", 10, 20);
  await page.locator('input[type="file"]').setInputFiles({
    name: "offline.pdf", mimeType: "application/pdf", buffer: Buffer.from(pdf.output("arraybuffer")),
  });
  await page.getByRole("button", { name: "转换所选文件 (1)", exact: true }).click();
  await expect(page.locator(".batch-status")).toHaveText("处理完成");
  const textDownload = page.waitForEvent("download");
  await page.locator(".result-card").getByRole("button", { name: "下载", exact: true }).click();
  expect(await readFile((await (await textDownload).path())!, "utf8")).toContain("Birchize offline PDF");

  expect(errors).toEqual([]);
  expect(externalRequests).toEqual([]);
});
