import type { BrowserContext } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const mirrorHost = (url: URL) => ["registry.npmmirror.com", "cdn.npmmirror.com"].includes(url.hostname);
export async function mockChinaMirrors(context: BrowserContext) {
  await context.route(mirrorHost, async (route) => {
    const url = new URL(route.request().url());
    const pathname = url.pathname.replace(/^\/packages/, "");
    const match = pathname.match(/^\/(.+?)\/([^/]+)\/files\/(.+)$/);
    if (!match) throw new Error(`Unexpected mirror URL: ${url}`);
    const file = path.resolve("node_modules", match[1], match[3]);
    if (!file.startsWith(path.resolve("node_modules") + path.sep)) throw new Error("Unsafe test path");
    await route.fulfill({ status: 200, body: await readFile(file), headers: {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": file.endsWith(".wasm") ? "application/wasm"
        : /\.(?:js|mjs)$/.test(file) ? "application/javascript" : "application/octet-stream",
    } });
  });
}
