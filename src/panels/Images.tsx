import { useEffect, useState } from "react";
import { useI18n } from "../i18n";
import {
  Dropzone,
  Field,
  FileList,
  Notice,
  Progress,
  Results,
  useFileSelection,
  useBatchResults,
} from "../components/Shared";
import type { PanelProps, Result } from "../components/Shared";
import { Icon } from "../components/Icons";
import { Select, ColorPicker } from "../components/Controls";
import { convertImage, loadImage } from "../engines/image";
import { mergeFiles, readableError, stem } from "../lib/files";

export default function Images({
  files,
  setFiles,
  onResult,
  preset,
}: PanelProps) {
  const { t } = useI18n();
  const [format, setFormat] = useState(preset?.format || "jpg"),
    [quality, setQuality] = useState(0.92),
    [maxWidth, setMaxWidth] = useState(0),
    [compress, setCompress] = useState(preset?.compress || false),
    [target, setTarget] = useState(preset?.targetKB || 200),
    [background, setBackground] = useState("#ffffff");
  const [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(0),
    [error, setError] = useState(""),
    [metadata, setMetadata] = useState<Record<string, string>>({});
  const selection = useFileSelection(files);
  const { batches, beginBatch, clearBatches } = useBatchResults(onResult);
  useEffect(() => {
    let alive = true;
    setMetadata({});
    for (const file of files)
      loadImage(file, file.name)
        .then((img) => {
          if (alive)
            setMetadata((prev) => ({
              ...prev,
              [file.name]: `${img.naturalWidth} × ${img.naturalHeight} px · ${file.type || file.name.split(".").pop()?.toUpperCase()}`,
            }));
        })
        .catch((e) => {
          if (alive)
            setMetadata((prev) => ({ ...prev, [file.name]: readableError(e) }));
        });
    return () => {
      alive = false;
    };
  }, [files]);
  async function run() {
    const queued = selection.selected;
    if (!queued.length || busy) return;
    setBusy(true);
    setError("");
    setProgress(0);
    const batch = beginBatch(queued.length);
    let failures: string[] = [];
    try {
      for (let i = 0; i < queued.length; i++) {
        try {
          const f = queued[i];
          const result = await convertImage(f, {
            format,
            quality,
            maxWidth,
            compress,
            targetKB: target,
            background,
          });
          const saved = Math.round((1 - result.blob.size / f.size) * 100);
          const item: Result = {
            name: `${stem(f.name)}.${format}`,
            blob: result.blob,
            image: true,
            detail: `${result.width} × ${result.height} px${saved > 0 ? ` · −${saved}%` : ""}`,
            warning: result.targetMet ? undefined : t("targetMiss"),
          };
          batch.add(item);
        } catch (e) {
          failures.push(`${queued[i].name}: ${readableError(e)}`);
        }
        setProgress(((i + 1) / queued.length) * 100);
      }
      setError(failures.join("\n"));
    } finally {
      batch.finish(failures.length);
      setBusy(false);
    }
  }
  return (
    <>
      <Dropzone
        onFiles={(incoming) => setFiles(mergeFiles(files, incoming))}
        disabled={busy}
        formats={[
          "JPG",
          "JPEG",
          "PNG",
          "WebP",
          "AVIF",
          "SVG",
          "BMP",
          "TIFF",
          "ICO",
          "GIF",
        ]}
        formatNote={t("imageNote")}
        accept="image/*,.tif,.tiff,.ico,.bmp"
        compact
      />
      <div className="work-grid">
        <section className="surface">
          <div className="panel-heading">
            <h3>{t("images")}</h3>
            <span className="tiny-badge">LOCAL CANVAS</span>
          </div>
          <div className="form-grid">
            <Field label={t("format")}>
              <Select
                value={format}
                label={t("format")}
                onChange={setFormat}
                items={["jpg", "png", "webp", "avif", "bmp", "ico"].map(
                  (f) => ({
                    value: f,
                    label:
                      f.toUpperCase() +
                      (f === "avif" ? " · Browser-dependent" : ""),
                  }),
                )}
              />
            </Field>
            <Field label={t("resize")}>
              <Select
                label={t("resize")}
                value={maxWidth}
                onChange={(value) => setMaxWidth(+value)}
                items={[
                  { value: 0, label: t("original") },
                  ...[3840, 2560, 1920, 1280, 800, 512, 256].map((v) => ({
                    value: v,
                    label: `${v} px`,
                  })),
                ]}
              />
            </Field>
            <Field label={`${t("quality")} · ${Math.round(quality * 100)}%`}>
              <input
                type="range"
                min=".7"
                max="1"
                step=".01"
                value={quality}
                onChange={(e) => setQuality(+e.target.value)}
                disabled={!["jpg", "webp", "avif"].includes(format)}
              />
            </Field>
            <Field label={t("background")}>
              <ColorPicker
                value={background}
                onChange={setBackground}
                label={t("background")}
              />
            </Field>
          </div>
          <label className="switch-row">
            <span>
              <strong>{t("compress")}</strong>
              <small>{t("compressDesc")}</small>
            </span>
            <input
              type="checkbox"
              className="switch"
              checked={compress}
              onChange={(e) => setCompress(e.target.checked)}
            />
          </label>
          {compress && (
            <Field label={t("target")}>
              <input
                type="number"
                min="1"
                max="102400"
                value={target}
                onChange={(e) => setTarget(+e.target.value)}
              />
            </Field>
          )}
          <button
            className="button primary full"
            disabled={
              busy || !selection.selected.length || (compress && (!target || target < 1))
            }
            onClick={run}
          >
            <Icon name="sparkles" size={18} />
            {busy ? t("processing") : `${t("convertSelected")} (${selection.selected.length})`}
          </button>
          {busy && <Progress value={progress} label={t("processing")} />}
        </section>
        <section className="surface file-surface">
          <div className="panel-heading">
            <h3>
              {t("file")} <span className="count">{files.length}</span>
            </h3>
            <Icon name="shield" size={18} />
          </div>
          {files.length ? (
            <FileList
              files={files}
              selection={selection}
              disabled={busy}
              metadata={metadata}
              onRemove={
                busy
                  ? undefined
                  : (i) => setFiles(files.filter((_, index) => i !== index))
              }
            />
          ) : (
            <div className="empty-state">
              <Icon name="images" size={35} />
              <p>{t("empty")}</p>
              <small>JPG · PNG · WEBP · SVG · BMP · TIFF · ICO</small>
            </div>
          )}
        </section>
      </div>
      <Notice>{t("imageNote")}</Notice>
      {error && <Notice error>{error}</Notice>}
      <Results batches={batches} onClear={clearBatches} />
    </>
  );
}
