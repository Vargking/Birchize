import { mkdir, copyFile, cp, access, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
const root = process.cwd();
const dest = path.join(root, 'public/engines');
await mkdir(dest, { recursive: true });
for (const name of ['ffmpeg-core.js', 'ffmpeg-core.wasm']) {
  await copyFile(path.join(root, 'node_modules/@ffmpeg/core/dist/esm', name), path.join(dest, name));
}
const archive = path.join(root, 'node_modules/libarchive.js/dist');
try {
  await access(archive);
  await cp(archive, path.join(dest, 'archive'), { recursive: true });
  // libarchive.js 2.0.2 only reserves input size + 128 bytes per entry.
  // TAR headers/padding and incompressible data can exceed that buffer; the
  // library then silently returns an empty/truncated file. Reserve space for
  // block padding, extended/Unicode names and compression overhead instead.
  // Patch only the vendored browser worker; keep node_modules untouched.
  const workerPath = path.join(dest, 'archive/worker-bundle.js');
  const worker = await readFile(workerPath, 'utf8');
  const original = 'let o=e.reduce(((e,{file:r})=>e+r.size+128),0)+128';
  const patched = 'let o=65536+e.reduce(((e,{file:r,pathname:t})=>e+r.size+Math.ceil(r.size/50)+4096+4*(t||r.name||"").length),0)';
  if (!worker.includes(original)) {
    throw new Error('Archive worker changed: review the output-buffer patch before building.');
  }
  // Always request UTF-8 names; archive_entry_pathname is locale-dependent
  // and corrupts non-ASCII filenames when reading 7Z under the WASM locale.
  const nameReader = 'getEntryName:this.cwrap("archive_entry_pathname","string",["number"])';
  if (!worker.includes(nameReader)) throw new Error('Archive filename reader changed: review the UTF-8 patch.');
  await writeFile(workerPath, worker.replace(original, patched).replace(nameReader,
    'getEntryName:this.cwrap("archive_entry_pathname_utf8","string",["number"])'));
}
catch (error) { console.error('Cannot vendor archive engine:', error); process.exitCode = 1; }
console.log('Local conversion engines prepared. No runtime CDN required.');
for (const name of ['cmaps', 'standard_fonts', 'wasm']) {
  await cp(path.join(root, 'node_modules/pdfjs-dist', name), path.join(dest, 'pdf', name), { recursive: true });
}
