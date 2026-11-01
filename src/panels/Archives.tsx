import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n";
import {
  Dropzone,
  Field,
  FileList,
  Notice,
  Segmented,
  useObjectUrl,
  useFileSelection,
  useBatchResults,
  Results,
} from "../components/Shared";
import type { PanelProps } from "../components/Shared";
import { Icon } from "../components/Icons";
import { Select } from "../components/Controls";
import {
  download,
  extension,
  formatSize,
  mergeFiles,
  readableError,
  safePath,
} from "../lib/files";
import { cleanSvg } from "../lib/svg";
import { archiveFormats, createArchive } from "../engines/archive";
import type { ArchiveFormat } from "../engines/archive";
type Entry = { name: string; size: number; extract: () => Promise<Blob> };
const timeout = <T,>(promise: Promise<T>, ms = 45000) =>
  new Promise<T>((resolve, reject) => {
    const id = setTimeout(
      () =>
        reject(
          new Error(
            "Archive operation timed out. This format or password may not be supported.",
          ),
        ),
      ms,
    );
    promise.then(
      (v) => {
        clearTimeout(id);
        resolve(v);
      },
      (e) => {
        clearTimeout(id);
        reject(e);
      },
    );
  });
export default function Archives({ files, setFiles, onResult }: PanelProps) {
  const { t } = useI18n();
  const selection = useFileSelection(files);
  const { batches, beginBatch, clearBatches } = useBatchResults(onResult);
  const [mode, setMode] = useState("open"),
    [format, setFormat] = useState<ArchiveFormat>("zip"),
    [selectedIndex, setSelectedIndex] = useState(0),
    [password, setPassword] = useState(""),
    [entries, setEntries] = useState<Entry[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [filter, setFilter] = useState(""),
    [preview, setPreview] = useState<{
      name: string;
      text?: string;
      blob?: Blob;
    }>();
  const cleanup = useRef<() => void>(() => {}),
    generation = useRef(0);
  const previewUrl = useObjectUrl(preview?.blob);
  const selectedFile =
    files[Math.min(selectedIndex, Math.max(0, files.length - 1))];
  useEffect(() => {
    generation.current++;
    cleanup.current();
    setEntries([]);
    setPreview(undefined);
    setError("");
  }, [selectedFile, mode]);
  useEffect(
    () => () => {
      generation.current++;
      cleanup.current();
    },
    [],
  );
  async function open() {
    const file = selectedFile;
    if (!file) return;
    setBusy(true);
    setError("");
    setEntries([]);
    cleanup.current();
    const current = ++generation.current;
    try {
      let list: Entry[] = [];
      if (extension(file.name) === "zip") {
        const { ZipReader, BlobReader, BlobWriter } =
          await import("@zip.js/zip.js");
        const reader = new ZipReader(new BlobReader(file), {
          useWebWorkers: false,
          password: password || undefined,
        });
        cleanup.current = () => {
          void reader.close();
        };
        const zipped = await timeout(reader.getEntries());
        list = zipped
          .filter((e) => !e.directory)
          .map((e) => ({
            name: e.filename,
            size: e.uncompressedSize,
            extract: async () => {
              if (!("getData" in e) || !e.getData)
                throw new Error("Entry unavailable");
              return e.getData(new BlobWriter(), {
                password: password || undefined,
                checkSignature: true,
              });
            },
          }));
      } else {
        const { Archive } = await import("libarchive.js");
        Archive.init({
          workerUrl: new URL(
            "engines/archive/worker-bundle.js",
            new URL(import.meta.env.BASE_URL, document.baseURI),
          ).href,
        });
        const opening = Archive.open(file);
        const archive = await timeout(opening);
        cleanup.current = () => {
          void archive.close();
        };
        if (password)
          await timeout(Promise.resolve(archive.usePassword(password)));
        const data = await timeout(archive.getFilesArray());
        list = data
          .filter((e) => e.file && typeof e.file === "object")
          .map((e) => ({
            name: e.path + e.file.name,
            size: e.file.size,
            extract: async () => timeout(e.file.extract()),
          }));
      }
      if (list.length > 10000)
        throw new Error("Archive has too many entries (10,000 maximum).");
      if (list.some((e) => !safePath(e.name)))
        throw new Error("Unsafe archive path rejected.");
      if (current === generation.current) setEntries(list);
    } catch (e) {
      setError(readableError(e));
      cleanup.current();
    } finally {
      setBusy(false);
    }
  }
  async function extract(entry: Entry, show = false) {
    setBusy(true);
    setError("");
    try {
      if (entry.size > 128 * 1024 * 1024 || entry.size < 0)
        throw new Error("128 MB maximum per entry.");
      const blob = await timeout(entry.extract());
      if (blob.size > 128 * 1024 * 1024)
        throw new Error("Extracted entry exceeds 128 MB.");
      if (show) {
        if (blob.size > 2 * 1024 * 1024)
          throw new Error("Preview is limited to 2 MB.");
        const ext = extension(entry.name);
        if (
          ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "avif"].includes(
            ext,
          )
        ) {
          const type =
            ext === "svg"
              ? "image/svg+xml"
              : ext === "jpg"
                ? "image/jpeg"
                : `image/${ext}`;
          setPreview({
            name: entry.name,
            blob: new Blob(
              [ext === "svg" ? cleanSvg(await blob.text()) : blob],
              { type },
            ),
          });
        } else if (
          [
            "txt",
            "md",
            "json",
            "csv",
            "xml",
            "html",
            "js",
            "ts",
            "css",
            "log",
            "yml",
            "yaml",
            "svg",
          ].includes(ext)
        )
          setPreview({ name: entry.name, text: await blob.text() });
        else
          throw new Error(
            "Preview supports text and images. Extract this file to open it in another application.",
          );
      } else {
        download(blob, entry.name.split("/").pop() || entry.name);
        onResult({ name: entry.name, blob });
      }
    } catch (e) {
      setError(readableError(e));
    } finally {
      setBusy(false);
    }
  }
  async function create() {
    if (!selection.selected.length || busy) return;
    setBusy(true);
    setError("");
    const batch = beginBatch(selection.selected.length);
    try {
      const result = await createArchive(selection.selected, format, password);
      download(result.blob, result.name);
      batch.add(result);
      batch.finish();
    } catch (e) {
      setError(readableError(e));
      batch.finish(1);
    } finally {
      setBusy(false);
    }
  }
  async function extractAll() {
    setBusy(true);
    setError("");
    try {
      if (
        entries.reduce((n, e) => n + e.size, 0) > 256 * 1024 * 1024 ||
        entries.some((e) => e.size > 128 * 1024 * 1024)
      )
        throw new Error("256 MB total extraction limit, 128 MB per entry.");
      const { ZipWriter, BlobWriter, BlobReader } =
        await import("@zip.js/zip.js");
      const writer = new ZipWriter(new BlobWriter("application/zip"), {
        useWebWorkers: false,
      });
      let total = 0;
      try {
        for (const e of entries) {
          const blob = await timeout(e.extract());
          total += blob.size;
          if (total > 256 * 1024 * 1024)
            throw new Error("Extraction limit reached.");
          await writer.add(e.name, new BlobReader(blob));
        }
        download(await writer.close(), "birchize-extracted.zip");
      } catch (e) {
        await writer.close().catch(() => {});
        throw e;
      }
    } catch (e) {
      setError(readableError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Segmented
        value={mode}
        onChange={(value) => { if (!busy) setMode(value); }}
        items={[
          { id: "open", label: t("archiveOpen") },
          { id: "create", label: t("archiveCreate") },
        ]}
      />
      <Dropzone
        compact
        onFiles={(incoming) => {
          const combined = mergeFiles(files, incoming, Infinity);
          if (combined.length > 50) {
            setError(t("archiveLimit"));
            return;
          }
          setError("");
          setFiles(combined);
        }}
        disabled={busy}
        formats={
          mode === "open"
            ? [
                "ZIP",
                "7Z",
                "RAR",
                "TAR",
                "GZ",
                "TGZ",
                "BZ2",
                "XZ",
                "ZST",
                "ISO",
                "CAB",
              ]
            : [t("allFiles")]
        }
        formatNote={mode === "open" ? t("archiveNote") : t("archiveCreateHint")}
        accept={
          mode === "open"
            ? ".zip,.7z,.rar,.tar,.gz,.tgz,.bz2,.xz,.zst,.iso,.cab"
            : undefined
        }
      />
      <section className="surface">
        <div className="archive-controls">
          {mode === "create" && (
            <Field label={t("format")}>
              <Select
                label={t("format")}
                value={format}
                onChange={(value) => {
                  setFormat(value as ArchiveFormat);
                  if (value !== "zip") setPassword("");
                }}
                disabled={busy}
                items={archiveFormats.map(
                  (value) => ({ value, label: value.toUpperCase() }),
                )}
              />
            </Field>
          )}
          <Field label={t("optionalPassword")}>
            <input
              type="password"
              autoComplete="off"
              value={password}
              disabled={busy || (mode === "create" && format !== "zip")}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </Field>
          <button
            className="button primary"
            disabled={busy || (mode === "create" ? !selection.selected.length : !files.length)}
            onClick={mode === "open" ? open : create}
          >
            <Icon name="archives" size={18} />
            {busy
              ? t("processing")
              : mode === "open" ? t("archiveOpen") : `${t("archiveCreate")} (${selection.selected.length})`}
          </button>
        </div>
        {mode === "create" && (
          <p className="batch-hint">{t("zipPasswordOnly")}</p>
        )}
        {files.length > 0 && (
          <>
          <div className="archive-batch-summary" role="status" aria-live="polite">
            <span><Icon name="file" size={16} /> {t("selectedFiles")} <b>{files.length}</b></span>
            <span>{formatSize(files.reduce((total, file) => total + file.size, 0))}</span>
          </div>
          <FileList
            files={files}
            selection={mode === "create" ? selection : undefined}
            disabled={busy}
            selectedIndex={files.indexOf(selectedFile)}
            onSelect={mode === "open" && !busy ? setSelectedIndex : undefined}
            onRemove={
              busy
                ? undefined
                : (i) => {
                    setFiles(files.filter((_, index) => index !== i));
                    setSelectedIndex(0);
                  }
            }
          />
          </>
        )}
      </section>
      {entries.length > 0 && (
        <section className="surface">
          <div className="panel-heading">
            <h3>
              {t("archives")} <span className="count">{entries.length}</span>
            </h3>
            <button
              className="text-button"
              disabled={busy}
              onClick={extractAll}
            >
              {t("downloadAll")}
            </button>
          </div>
          <input
            className="archive-search"
            aria-label={t("search")}
            placeholder={t("search")}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <div className="archive-table">
            <div className="archive-table-head">
              <span>{t("file")}</span>
              <span>{t("size")}</span>
              <span />
            </div>
            {entries
              .filter((e) =>
                e.name.toLowerCase().includes(filter.toLowerCase()),
              )
              .slice(0, 300)
              .map((entry, i) => (
                <div className="archive-entry" key={i}>
                  <span>
                    <Icon name="file" size={17} />
                    <span title={entry.name}>{entry.name}</span>
                  </span>
                  <span>{formatSize(entry.size)}</span>
                  <div>
                    <button
                      className="icon-button"
                      disabled={busy}
                      onClick={() => extract(entry, true)}
                      title={t("preview")}
                      aria-label={`${t("preview")} ${entry.name}`}
                    >
                      <Icon name="search" size={17} />
                    </button>
                    <button
                      className="icon-button"
                      disabled={busy}
                      onClick={() => extract(entry)}
                      title={t("extract")}
                      aria-label={`${t("extract")} ${entry.name}`}
                    >
                      <Icon name="download" size={17} />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </section>
      )}
      {preview && (
        <section className="surface archive-preview">
          <div className="panel-heading">
            <h3>{preview.name}</h3>
            <button
              className="icon-button"
              aria-label={t("close")}
              onClick={() => setPreview(undefined)}
            >
              <Icon name="close" />
            </button>
          </div>
          {preview.blob ? (
            <img src={previewUrl} alt={preview.name} />
          ) : (
            <pre>{preview.text}</pre>
          )}
        </section>
      )}
      <Notice>{t("archiveNote")}</Notice>
      {error && <Notice error>{error}</Notice>}
      <Results batches={batches} onClear={clearBatches} />
    </>
  );
}
