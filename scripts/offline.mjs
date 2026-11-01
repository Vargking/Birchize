import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(entries.map(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
  return nested.flat();
}
const files = (await walk('dist')).filter(f => !f.endsWith('sw.js'));
const hash = createHash('sha256');
hash.update(await readFile(new URL(import.meta.url)));
for (const file of files) hash.update(await readFile(file));
const version = 'birchize-' + hash.digest('hex').slice(0, 12);
const urls = files.map(f => './' + path.relative('dist', f).replaceAll('\\', '/'));
await writeFile('dist/sw.js', `
const CACHE = ${JSON.stringify(version)};
const FILES = ${JSON.stringify(['./', ...urls])};
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    try { for (const url of FILES) { await cache.add(new Request(url, {cache: 'reload'})); } }
    catch(error) { await caches.delete(CACHE); throw error; }
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if(key.startsWith('birchize-') && key !== CACHE) await caches.delete(key);
    await self.clients.claim();
    for (const client of await self.clients.matchAll()) client.postMessage({type:'OFFLINE_READY'});
  })());
});
self.addEventListener('fetch', event => {
  if(event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // These are public, same-origin static assets. A server's Vary: Origin
    // must not distinguish precache requests from module/CSS CORS requests.
    const cached = await cache.match(event.request, {ignoreSearch: true, ignoreVary: true});
    if(cached) return cached;
    if(event.request.mode === 'navigate') return (await cache.match('./index.html')) || fetch(event.request);
    return fetch(event.request);
  })());
});
`);
console.log(`Offline cache: ${urls.length} local assets, including media and archive engines.`);
