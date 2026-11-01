import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Icon } from "./Icons";
import { useI18n } from "../i18n";
import { retainBatches } from "../lib/batches";
import type { Result, ResultBatch } from "../lib/batches";
import { selectedFiles, toggleFile } from "../lib/selection";
import {
  download,
  formatSize,
  MAX_FILE_SIZE,
  readableError,
} from "../lib/files";

export type { Result } from "../lib/batches";

export function useFileSelection(files: File[]) {
  const [excluded, setExcluded] = useState<Set<File>>(() => new Set());
  useEffect(() => {
    setExcluded((previous) => new Set([...previous].filter((file) => files.includes(file))));
  }, [files]);
  const selected = selectedFiles(files, excluded);
  return {
    selected,
    toggle: (index: number) => setExcluded((previous) => toggleFile(previous, files[index])),
    toggleAll: () => setExcluded(selected.length === files.length ? new Set(files) : new Set()),
  };
}

export function useBatchResults(onResult: (result: Result) => void) {
  const [batches, setBatches] = useState<ResultBatch[]>([]);
  const sequence = useRef(0);
  function beginBatch(inputCount: number) {
    const info = { id: crypto.randomUUID(), startedAt: Date.now() };
    const batch: ResultBatch = {
      ...info, number: ++sequence.current, inputCount, failedCount: 0,
      status: "processing", results: [],
    };
    setBatches((previous) => retainBatches([batch, ...previous]));
    return {
      add: (result: Result) => {
        const tagged = { ...result, batch: info };
        setBatches((previous) => retainBatches(previous.map((item) => item.id === info.id
          ? { ...item, results: [...item.results, tagged] } : item)));
        onResult(tagged);
      },
      finish: (failedCount = 0, cancelled = false) => {
        setBatches((previous) => previous.map((item) => item.id === info.id ? {
          ...item, failedCount,
          status: cancelled ? "cancelled" : failedCount ? (item.results.length ? "partial" : "failed") : "complete",
        } : item));
      },
    };
  }
  return { batches, beginBatch, clearBatches: () => setBatches([]) };
}
export type ConversionPreset = {
  format?: string;
  compress?: boolean;
  targetKB?: number;
};
export type PanelProps = {
  files: File[];
  setFiles: (files: File[]) => void;
  onResult: (result: Result) => void;
  preset?: ConversionPreset;
};
export function useObjectUrl(blob?: Blob) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!blob) {
      setUrl("");
      return;
    }
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob]);
  return url;
}
export function Dropzone({
  onFiles,
  accept,
  multiple = true,
  compact = false,
  disabled = false,
  formats,
  formatNote,
}: {
  onFiles: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  compact?: boolean;
  disabled?: boolean;
  formats?: string[];
  formatNote?: string;
}) {
  const { t } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState("");
  const receive = (files: File[]) => {
    setError("");
    if (disabled || !files.length) return;
    if (files.some((f) => f.size > MAX_FILE_SIZE)) {
      setError("512 MB maximum per file · " + t("size"));
      return;
    }
    if (files.length > 50) {
      setError("50 files maximum");
      return;
    }
    onFiles(multiple ? files : [files[0]]);
  };
  return (
    <>
      <div
        className={`dropzone ${compact ? "compact" : ""} ${drag ? "dragging" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          receive(Array.from(e.dataTransfer.files));
        }}
      >
        <div className="drop-symbol">
          <Icon name="upload" size={25} />
          <span className="mini-plus">+</span>
        </div>
        <div className="drop-copy">
          <h3>{t("dropTitle")}</h3>
          <p>{t("dropHint")}</p>
        </div>
        <button
          className="button primary"
          disabled={disabled}
          onClick={() => input.current?.click()}
        >
          <Icon name="plus" size={17} />
          {t("choose")}
        </button>
        <input
          ref={input}
          type="file"
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          hidden
          onChange={(e) => {
            receive(Array.from(e.target.files || []));
            e.target.value = "";
          }}
        />
        <div className="supported-formats">
          <div className="supported-label">
            <Icon name="file" size={13} />
            {t("supportedInput")}
            <span>{multiple ? t("multiFile") : ""}</span>
          </div>
          <div className="format-chips">
            {(
              formats || [
                "JPG",
                "PNG",
                "WebP",
                "SVG",
                "MP4",
                "MOV",
                "MP3",
                "WAV",
                "DOCX",
                "PDF",
                "ZIP",
                "7Z",
                "RAR",
              ]
            ).map((format) => (
              <span key={format}>{format}</span>
            ))}
          </div>
          {formatNote && <p>{formatNote}</p>}
        </div>
      </div>
      {error && <Notice error>{error}</Notice>}
    </>
  );
}
export function Notice({
  children,
  error = false,
}: {
  children: ReactNode;
  error?: boolean;
}) {
  return (
    <div
      role={error ? "alert" : "note"}
      className={`notice ${error ? "error" : ""}`}
    >
      <Icon name={error ? "help" : "shield"} size={17} />
      <span>{children}</span>
    </div>
  );
}
export function FileList({
  files,
  onRemove,
  metadata,
  onSelect,
  selectedIndex,
  selection,
  disabled = false,
}: {
  files: File[];
  onRemove?: (index: number) => void;
  metadata?: Record<string, string>;
  onSelect?: (index: number) => void;
  selectedIndex?: number;
  selection?: ReturnType<typeof useFileSelection>;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className="file-collection">
      {selection && files.length > 0 && (
        <>
          <div className="file-selection-toolbar">
            <label className="select-all-label">
              <input
                type="checkbox"
                className="file-checkbox"
                checked={selection.selected.length === files.length}
                ref={(input) => { if (input) input.indeterminate = selection.selected.length > 0 && selection.selected.length < files.length; }}
                disabled={disabled}
                onChange={selection.toggleAll}
              />
              {t("selectAll")}
            </label>
            <span>{t("selectedFiles")} <b>{selection.selected.length}</b> / {files.length}</span>
          </div>
          <p className="selection-hint">{t("selectionHint")}</p>
        </>
      )}
      <div className="file-list">
      {files.map((f, i) => (
        <div
          className={`file-row ${onSelect && selectedIndex === i ? "selected-file" : ""}`}
          key={`${f.name}-${i}`}
        >
          {selection && (
            <label className="file-checkbox-target">
              <input
                type="checkbox"
                className="file-checkbox"
                aria-label={`${t("selectFile")} ${f.name}`}
                checked={selection.selected.includes(f)}
                onChange={() => selection.toggle(i)}
                disabled={disabled}
              />
            </label>
          )}
          <div className="file-symbol">
            <Icon name={f.type.startsWith("image/") ? "images" : "file"} />
          </div>
          <div className="file-info">
            {onSelect ? (
              <button
                className="file-select"
                onClick={() => onSelect(i)}
                aria-pressed={selectedIndex === i}
              >
                <strong>{f.name}</strong>
              </button>
            ) : (
              <strong>{f.name}</strong>
            )}
            <span>
              {formatSize(f.size)} <span className="dot">·</span>{" "}
              {metadata?.[f.name] ||
                f.type ||
                f.name.split(".").pop()?.toUpperCase() ||
                "Binary"}
            </span>
          </div>
          {onRemove && (
            <button
              className="icon-button"
              title={t("clear")}
              aria-label={`${t("clear")} ${f.name}`}
              onClick={() => onRemove(i)}
            >
              <Icon name="close" size={16} />
            </button>
          )}
        </div>
      ))}
      </div>
    </div>
  );
}
function ResultCard({ result }: { result: Result }) {
  const { t } = useI18n();
  const url = useObjectUrl(result.image ? result.blob : undefined);
  return (
    <div className="result-card">
      {url ? (
        <img src={url} alt={result.name} className="result-thumb" />
      ) : (
        <div className="result-icon">
          <Icon name="check" />
        </div>
      )}
      <div className="file-info">
        <strong>{result.name}</strong>
        <span>
          {formatSize(result.blob.size)}
          {result.detail && ` · ${result.detail}`}
        </span>
        {result.warning && (
          <small className="warning-text">{result.warning}</small>
        )}
      </div>
      <button
        className="button small"
        onClick={() => download(result.blob, result.name)}
      >
        <Icon name="download" size={16} />
        <span>{t("download")}</span>
      </button>
    </div>
  );
}
function BatchResults({ batch }: { batch: ResultBatch }) {
  const { t, locale } = useI18n();
  const results = batch.results;
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function all() {
    setBusy(true);
    setError("");
    try {
      const { BlobWriter, ZipWriter, BlobReader } =
        await import("@zip.js/zip.js");
      const writer = new ZipWriter(new BlobWriter("application/zip"), {
        useWebWorkers: false,
      });
      try {
        for (const [i, r] of results.entries())
          await writer.add(`${i + 1}-${r.name}`, new BlobReader(r.blob));
        download(await writer.close(), `birchize-batch-${batch.number}.zip`);
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
    <section className="result-batch" aria-label={`${t("batch")} ${batch.number}`} data-batch-id={batch.id}>
      <div className="batch-heading">
        <div>
          <h4><Icon name="file" size={16} />{t("batch")} {batch.number}</h4>
          <time dateTime={new Date(batch.startedAt).toISOString()}>
            {new Date(batch.startedAt).toLocaleString(locale === "zh" ? "zh-CN" : locale)}
          </time>
        </div>
        {results.length > 0 && batch.status !== "processing" && (
          <button className="text-button" onClick={all} disabled={busy}>
            <Icon name="download" size={15} />{t("downloadBatch")}
          </button>
        )}
      </div>
      <div className="batch-summary" role="status" aria-live="polite">
        <span className={`batch-status ${batch.status}`}>{t(batch.status === "processing" ? "processing" : batch.status === "complete" ? "complete" : `batch${batch.status[0].toUpperCase()}${batch.status.slice(1)}`)}</span>
        <span>{t("batchInputs")} {batch.inputCount} · {t("batchOutputs")} {results.length}{batch.failedCount > 0 && ` · ${t("batchFailed")} ${batch.failedCount}`}</span>
      </div>
      {results.map((r, i) => (
        <ResultCard key={i} result={r} />
      ))}
      {error && <Notice error>{error}</Notice>}
    </section>
  );
}
export function Results({ batches, onClear }: { batches: ResultBatch[]; onClear: () => void }) {
  const { t } = useI18n();
  if (!batches.length) return null;
  return (
    <section className="results">
      <div className="section-title">
        <h3>{t("result")} <span className="count">{batches.length} {t("batch")}</span></h3>
        <button className="text-button" onClick={onClear} disabled={batches.some((batch) => batch.status === "processing")}>{t("clearResults")}</button>
      </div>
      {batches.map((batch) => <BatchResults key={batch.id} batch={batch} />)}
      <p className="selection-hint">{t("historyNote")}</p>
    </section>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Progress({
  value,
  label,
  onCancel,
}: {
  value: number;
  label: string;
  onCancel?: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="progress-block" role="status">
      <div>
        <span className="spinner" />
        {label}
        <b>{Math.round(value)}%</b>
        {onCancel && (
          <button className="text-button" onClick={onCancel}>
            {t("cancel")}
          </button>
        )}
      </div>
      <div className="progress-track">
        <span style={{ width: `${Math.max(2, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}
export function Segmented({
  value,
  onChange,
  items,
}: {
  value: string;
  onChange: (v: string) => void;
  items: { id: string; label: string }[];
}) {
  return (
    <div className="segmented" role="tablist">
      {items.map((item) => (
        <button
          key={item.id}
          role="tab"
          aria-selected={value === item.id}
          className={value === item.id ? "active" : ""}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
