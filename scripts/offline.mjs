import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(entries.map(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
  return nested.flat();
}
const files = (await walk('dist')).filter(f => !f.endsWith('sw.js')).sort();
const template = await readFile(new URL('./service-worker.js', import.meta.url), 'utf8');
const hash = createHash('sha256');
hash.update(await readFile(new URL(import.meta.url)));
hash.update(template);
const assets = [];
const versions = {};
for (const name of ['@ffmpeg/core', 'libarchive.js', 'pdfjs-dist']) {
  versions[name] = JSON.parse(await readFile(path.join('node_modules', name, 'package.json'), 'utf8')).version;
}
function mirrorPath(url) {
  if (url.startsWith('./engines/ffmpeg-core.'))
    return ['@ffmpeg/core', `dist/esm/${path.posix.basename(url)}`];
  if (url.startsWith('./engines/pdf/')) return ['pdfjs-dist', url.slice('./engines/pdf/'.length)];
  // The browser worker is patched locally; never replace it with upstream code.
  if (url === './engines/archive/libarchive.wasm') return ['libarchive.js', 'dist/libarchive.wasm'];
  if (/^\.\/assets\/pdf\.worker\.min-.*\.mjs$/.test(url)) return ['pdfjs-dist', 'build/pdf.worker.min.mjs'];
}
for (const file of files) {
  const bytes = await readFile(file);
  const url = './' + path.relative('dist', file).replaceAll('\\', '/');
  hash.update(url);
  hash.update(bytes);
  const mirrored = mirrorPath(url);
  const sources = [];
  if (mirrored) {
    const [name, entry] = mirrored;
    // Only publish mirror URLs when the installed package matches the artifact
    // byte-for-byte. Locally patched/transformed resources stay same-origin.
    const original = await readFile(path.join('node_modules', name, entry));
    if (bytes.equals(original)) sources.push(
      `https://registry.npmmirror.com/${name}/${versions[name]}/files/${entry}`,
      `https://cdn.npmmirror.com/packages/${name}/${versions[name]}/files/${entry}`,
    );
  }
  assets.push({ url, bytes: bytes.byteLength, hash: createHash('sha256').update(bytes).digest('hex'), sources });
}
const version = hash.digest('hex').slice(0, 12);
// Scope the cache to this project, not all projects on a shared github.io host.
const prefix = "'birchize-' + encodeURIComponent(new URL(self.registration.scope).pathname) + '-'";
await writeFile('dist/sw.js', template
  .replace('__CACHE_NAME__', `${prefix} + ${JSON.stringify(version)}`)
  .replace('__CACHE_PREFIX__', prefix)
  .replace('__OFFLINE_ASSETS__', JSON.stringify(assets)));
console.log(`Offline cache: ${assets.length} local assets, resumable with verified download progress.`);
