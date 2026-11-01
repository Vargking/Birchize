import { describe, expect, it } from "vitest";
import { archiveEntries, createArchive, MAX_ARCHIVE_SIZE } from "../src/engines/archive";
import { mergeFiles } from "../src/lib/files";

describe("archive input handling", () => {
  const file = (name: string, body = "content") => new File([body], name, { lastModified: 1 });

  it("appends batches, deduplicates the same input and preserves order", () => {
    const first = file("a.txt"), second = file("b.txt"), third = file("c.txt");
    expect(mergeFiles([first, second], [first, third])).toEqual([first, second, third]);
  });

  it("can check the full batch before applying the UI limit", () => {
    const files = Array.from({ length: 51 }, (_, i) => file(`${i}.txt`));
    expect(mergeFiles(files.slice(0, 30), files.slice(30), Infinity)).toHaveLength(51);
  });

  it("keeps same-name files without overwriting, including suffix collisions and case differences", () => {
    const files = [file("note.txt"), file("note.txt"), file("note (2).txt"), file("NOTE.TXT")];
    const entries = archiveEntries(files);
    expect(entries.map((e) => e.pathname)).toEqual(["note.txt", "note (2).txt", "note (2) (2).txt", "NOTE (3).TXT"]);
    expect(entries.map((e) => e.file)).toEqual(files);
  });

  it("retains Unicode and extensionless filenames", () => {
    expect(archiveEntries([file("笔记.txt"), file("LICENSE"), file("LICENSE")]).map((e) => e.pathname))
      .toEqual(["笔记.txt", "LICENSE", "LICENSE (2)"]);
  });

  it("rejects path traversal and control characters", () => {
    for (const name of ["../secret", "/secret", "a\\b", "a/b", "C:secret", "a\0b"])
      expect(() => archiveEntries([file(name)])).toThrow("Unsafe");
  });

  it("validates size, count and password before starting a worker", async () => {
    await expect(createArchive([], "zip")).rejects.toThrow("at least one");
    await expect(createArchive(Array.from({ length: 51 }, (_, i) => file(`${i}`)), "zip")).rejects.toThrow("50 files");
    await expect(createArchive([{ size: MAX_ARCHIVE_SIZE + 1 } as File], "zip")).rejects.toThrow("256 MB");
    await expect(createArchive([file("test.txt")], "7z", "password")).rejects.toThrow("ZIP output only");
  });
});
