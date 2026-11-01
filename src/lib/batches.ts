export type BatchInfo = { id: string; startedAt: number };
export type Result = {
  name: string;
  blob: Blob;
  detail?: string;
  warning?: string;
  image?: boolean;
  batch?: BatchInfo;
};
export type ResultBatch = BatchInfo & {
  number: number;
  inputCount: number;
  failedCount: number;
  status: "processing" | "complete" | "partial" | "failed" | "cancelled";
  results: Result[];
};

const HISTORY_BYTES = 200 * 1024 * 1024;

/** Evict complete older batches, never individual files within a batch. */
export function retainBatches(batches: ResultBatch[]) {
  let bytes = 0;
  return batches.filter((batch, index) => {
    const size = batch.results.reduce((sum, result) => sum + result.blob.size, 0);
    if (index >= 8 || (index > 0 && bytes + size > HISTORY_BYTES)) return false;
    bytes += size;
    return true;
  });
}

export function groupResults(results: Result[]) {
  const groups = new Map<string, { id: string; startedAt?: number; results: Result[] }>();
  results.forEach((result, index) => {
    const id = result.batch?.id ?? `single-${index}`;
    let group = groups.get(id);
    if (!group) {
      group = { id, startedAt: result.batch?.startedAt, results: [] };
      groups.set(id, group);
    }
    group.results.push(result);
  });
  return [...groups.values()];
}

export function retainRecentResults(results: Result[]) {
  let bytes = 0;
  return groupResults(results).filter((group, index) => {
    const size = group.results.reduce((sum, result) => sum + result.blob.size, 0);
    if (index >= 8 || (index > 0 && bytes + size > HISTORY_BYTES)) return false;
    bytes += size;
    return true;
  }).flatMap((group) => group.results);
}
