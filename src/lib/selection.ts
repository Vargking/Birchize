/** Newly added files are selected by default; preview focus is independent. */
export function selectedFiles(files: File[], excluded: ReadonlySet<File>) {
  return files.filter((file) => !excluded.has(file));
}

export function toggleFile(excluded: ReadonlySet<File>, file: File) {
  const next = new Set(excluded);
  if (next.has(file)) next.delete(file);
  else next.add(file);
  return next;
}
