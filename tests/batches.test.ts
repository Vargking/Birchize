import { describe, expect, it } from "vitest";
import { groupResults, retainBatches, retainRecentResults } from "../src/lib/batches";
import type { Result, ResultBatch } from "../src/lib/batches";
import { selectedFiles, toggleFile } from "../src/lib/selection";
import { mergeFiles } from "../src/lib/files";

describe("file selection and batch history", () => {
  it("selects newly appended files but preserves existing exclusions", () => {
    const first = new File(["1"], "one.txt"), second = new File(["2"], "two.txt"), third = new File(["3"], "three.txt");
    const excluded = toggleFile(new Set<File>(), second);
    expect(selectedFiles([first, second, third], excluded)).toEqual([first, third]);
    expect(selectedFiles([first, second], toggleFile(excluded, second))).toEqual([first, second]);
  });
  it("retains file identity on duplicate additions", () => {
    const first = new File(["1"], "one.txt", { lastModified: 1 });
    const duplicate = new File(["1"], "one.txt", { lastModified: 1 });
    expect(mergeFiles([first], [duplicate])[0]).toBe(first);
  });
  it("groups results by batch id even when names and times match", () => {
    const result = (id: string): Result => ({ name: "same.txt", blob: new Blob([id]), batch: { id, startedAt: 1 } });
    expect(groupResults([result("a"), result("b"), result("a")]).map((g) => [g.id, g.results.length])).toEqual([["a", 2], ["b", 1]]);
  });
  it("keeps eight complete batches without cutting individual results", () => {
    const batches: ResultBatch[] = Array.from({ length: 10 }, (_, i) => ({ id: `${i}`, startedAt: i, number: i, inputCount: 1, failedCount: 0, status: "complete", results: [{ name: "x", blob: new Blob(["x"]), batch: { id: `${i}`, startedAt: i } }] }));
    expect(retainBatches(batches)).toHaveLength(8);
    expect(groupResults(retainRecentResults(batches.flatMap((batch) => [...batch.results, ...batch.results])))).toHaveLength(8);
    expect(retainRecentResults(batches.flatMap((batch) => [...batch.results, ...batch.results]))).toHaveLength(16);
  });
});
