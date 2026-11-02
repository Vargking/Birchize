// Build-time placeholders are replaced by scripts/offline.mjs.
const CACHE = __CACHE_NAME__;
const PREFIX = __CACHE_PREFIX__;
const ASSETS = __OFFLINE_ASSETS__;
const SCOPE = self.registration.scope;
const assetUrl = (asset) => new URL(asset.url, SCOPE).href;
const entries = new Map(ASSETS.map((asset) => [assetUrl(asset), asset]));
const TOTAL_BYTES = ASSETS.reduce((sum, asset) => sum + asset.bytes, 0);
const cached = new Set();
const inflight = new Map();
let initialized;
let running;
let lastBroadcast = 0;
let state = { phase: 'checking', completed: 0, total: ASSETS.length,
  bytes: 0, totalBytes: TOTAL_BYTES, currentFile: '', currentSource: '', failures: [] };

function snapshot() {
  const saved = ASSETS.reduce((sum, asset) => sum + (cached.has(assetUrl(asset)) ? asset.bytes : 0), 0);
  return { ...state, completed: cached.size,
    bytes: saved + [...inflight.values()].reduce((sum, value) => sum + value, 0) };
}
async function broadcast(force = false) {
  if (!force && Date.now() - lastBroadcast < 150) return;
  lastBroadcast = Date.now();
  const message = { type: 'OFFLINE_STATUS', state: snapshot() };
  for (const client of await self.clients.matchAll({ includeUncontrolled: true })) {
    // Other projects on the same github.io origin must not receive our status.
    if (client.url.startsWith(SCOPE)) client.postMessage(message);
  }
}
function failure(code, detail) {
  const error = new Error(detail);
  error.code = code;
  return error;
}
async function initialize() {
  if (!initialized) initialized = (async () => {
    const cache = await caches.open(CACHE);
    for (const asset of ASSETS) {
      const response = await cache.match(assetUrl(asset), { ignoreVary: true });
      if (response?.headers.get('X-Birchize-Hash') === asset.hash) cached.add(assetUrl(asset));
    }
    state.phase = cached.size === ASSETS.length ? 'ready' : 'caching';
  })().catch((error) => { initialized = undefined; throw error; });
  return initialized;
}
async function previousCaches() {
  return (await caches.keys()).filter((name) => name !== CACHE &&
    (name.startsWith(PREFIX) || /^birchize-[a-f0-9]{12}$/.test(name)));
}
async function downloadAsset(asset, cache, source) {
  const url = assetUrl(asset);
  const controller = new AbortController();
  // This is an idle timeout, not a deadline for downloading a large WASM file.
  let timer;
  const keepAlive = () => {
    clearTimeout(timer);
    timer = setTimeout(() => controller.abort(), 45_000);
  };
  keepAlive();
  try {
    const versioned = new URL(source || url);
    versioned.searchParams.set('__birchize', asset.hash.slice(0, 12));
    state.currentSource = versioned.hostname;
    const response = await fetch(versioned, { cache: 'reload', credentials: 'omit',
      referrerPolicy: 'no-referrer', signal: controller.signal });
    if (!response.ok) throw failure('http', `HTTP ${response.status}`);
    if (!asset.url.endsWith('.html') && response.headers.get('Content-Type')?.includes('text/html'))
      throw failure('content', 'The server returned HTML instead of this resource.');
    const buffer = new Uint8Array(asset.bytes);
    let received = 0;
    const reader = response.body?.getReader();
    if (!reader) throw failure('content', 'The resource has no response body.');
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      keepAlive();
      if (received + value.byteLength > buffer.byteLength) {
        await reader.cancel();
        throw failure('content', 'The resource size differs from this release.');
      }
      buffer.set(value, received);
      received += value.byteLength;
      inflight.set(url, received);
      state.currentFile = asset.url.slice(2);
      void broadcast();
    }
    if (received !== asset.bytes) throw failure('content', 'The resource download is incomplete.');
    const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', buffer))]
      .map((byte) => byte.toString(16).padStart(2, '0')).join('');
    if (digest !== asset.hash) throw failure('content', 'The resource checksum differs from this release.');
    const headers = new Headers(response.headers);
    headers.delete('Content-Encoding');
    headers.delete('Vary');
    headers.set('Content-Length', String(asset.bytes));
    headers.set('X-Birchize-Hash', asset.hash);
    try { await cache.put(url, new Response(buffer, { headers })); }
    catch (error) { throw failure(error.name === 'QuotaExceededError' ? 'quota' : 'storage', error.message); }
    cached.add(url);
  } catch (error) {
    if (controller.signal.aborted) throw failure('timeout', 'No download data received for 45 seconds.');
    throw error;
  } finally {
    clearTimeout(timer);
    inflight.delete(url);
  }
}
async function warmCache() {
  try {
    await initialize();
    // A saved release is already usable. Do not briefly report "caching" on
    // every visit or poll, which would reopen the startup screen unnecessarily.
    if (cached.size === ASSETS.length) {
      state.phase = 'ready';
      await broadcast(true);
      return;
    }
    state = { ...state, phase: 'caching', failures: [] };
    await broadcast(true);
    const cache = await caches.open(CACHE);
    const previous = await previousCaches();
    const pending = ASSETS.filter((asset) => !cached.has(assetUrl(asset)));
    let next = 0;
    async function worker() {
      while (next < pending.length) {
        const asset = pending[next++];
        const url = assetUrl(asset);
        state.currentFile = asset.url.slice(2);
        try {
          // Reuse unchanged engines after app updates, but never an old version
          // of a resource that happens to share the same filename.
          let reused = false;
          for (const name of previous) {
            const response = await (await caches.open(name)).match(url, { ignoreVary: true });
            if (response?.headers.get('X-Birchize-Hash') === asset.hash) {
              await cache.put(url, response);
              cached.add(url);
              reused = true;
              break;
            }
          }
          if (!reused) {
            const sources = [...asset.sources, url];
            for (let attempt = 0; ; attempt++) {
              try { await downloadAsset(asset, cache, sources[attempt % sources.length]); break; }
              catch (error) {
                if (attempt >= 2 || ['quota', 'storage'].includes(error.code)) throw error;
                await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
              }
            }
          }
        } catch (error) {
          state.failures.push({ url: asset.url.slice(2), code: error.code || 'network', detail: error.message });
        }
        await broadcast(true);
      }
    }
    await Promise.all(Array.from({ length: 4 }, worker));
    state.phase = cached.size === ASSETS.length ? 'ready' : 'error';
    state.currentFile = '';
    state.currentSource = '';
    // Never discard a previous working release while the new cache is partial.
    if (state.phase === 'ready') {
      for (const name of previous) {
        const old = await caches.open(name);
        if (name.startsWith(PREFIX) || await old.match(new URL('index.html', SCOPE).href))
          await caches.delete(name);
      }
    }
  } catch (error) {
    state.phase = 'error';
    state.failures = [{ url: '', code: error.name === 'QuotaExceededError' ? 'quota' : 'storage', detail: error.message }];
  }
  await broadcast(true);
}
function startCaching() {
  if (!running) running = warmCache().finally(() => { running = undefined; });
  return running;
}
self.addEventListener('install', (event) => {
  // Keep installation short. A single failed library must not make the worker
  // redundant or destroy every successfully downloaded resource.
  event.waitUntil(self.skipWaiting());
});
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
self.addEventListener('message', (event) => {
  if (!['CACHE_STATUS', 'CACHE_START', 'CACHE_RETRY'].includes(event.data?.type)) return;
  event.waitUntil((async () => {
    try { await initialize(); }
    catch (error) {
      state.phase = 'error';
      state.failures = [{ url: '', code: error.name === 'QuotaExceededError' ? 'quota' : 'storage', detail: error.message }];
    }
    event.source?.postMessage({ type: 'OFFLINE_STATUS', state: snapshot() });
    // Browsers can stop a worker between visits. A status poll restarts an
    // interrupted download, but does not endlessly retry a known failure.
    if (event.data.type !== 'CACHE_STATUS' || (state.phase === 'caching' && !running)) await startCaching();
  })());
});
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  const url = new URL(event.request.url);
  url.search = '';
  const isNavigation = event.request.mode === 'navigate';
  if (!isNavigation && !entries.has(url.href)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const key = isNavigation ? new URL('index.html', SCOPE).href : url.href;
    const response = await cache.match(key, { ignoreVary: true });
    return response || fetch(event.request);
  })());
});
