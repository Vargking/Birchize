import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n";
import {
  Dropzone,
  Field,
  FileList,
  Notice,
  Progress,
  Results,
  useObjectUrl,
  useFileSelection,
  useBatchResults,
} from "../components/Shared";
import type { PanelProps } from "../components/Shared";
import { Icon } from "../components/Icons";
import { Select } from "../components/Controls";
import { MediaEngine, audioFormats } from "../engines/media";
import { mergeFiles, readableError, stem } from "../lib/files";
export default function Media({
  files,
  setFiles,
  onResult,
  preset,
}: PanelProps) {
  const { t } = useI18n();
  const [format, setFormat] = useState(preset?.format || "mp4"),
    [resolution, setResolution] = useState(0),
    [bitrate, setBitrate] = useState(192),
    [compress, setCompress] = useState(preset?.compress || false),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(0),
    [error, setError] = useState(""),
    [meta, setMeta] = useState("");
  const engine = useRef<MediaEngine | null>(null);
  const cancelled = useRef(false);
  const selection = useFileSelection(files);
  const { batches, beginBatch, clearBatches } = useBatchResults(onResult);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const file = files[Math.min(selectedIndex, Math.max(0, files.length - 1))];
  const url = useObjectUrl(file);
  useEffect(() => () => engine.current?.cancel(), []);
  useEffect(() => {
    setMeta("");
  }, [file]);
  async function run() {
    const queue = selection.selected;
    if (!queue.length || busy) return;
    setBusy(true);
    setError("");
    setProgress(0);
    const batch = beginBatch(queue.length);
    cancelled.current = false;
    const failures: string[] = [];
    try {
      for (const [i, queued] of queue.entries()) {
        if (cancelled.current) break;
        setSelectedIndex(files.indexOf(queued));
        try {
          engine.current = new MediaEngine();
          const blob = await engine.current.run(
            queued,
            { format, resolution, bitrate, compress },
            (p) => setProgress((i * 100 + p) / queue.length),
          );
          const r = { blob, name: `${stem(queued.name)}.${format}` };
          batch.add(r);
        } catch (e) {
          if (!cancelled.current)
            failures.push(`${queued.name}: ${readableError(e)}`);
        }
      }
      setError(failures.join("\n"));
    } finally {
      batch.finish(failures.length, cancelled.current);
      setBusy(false);
      engine.current = null;
    }
  }
  return (
    <>
      <Dropzone
        onFiles={(incoming) => setFiles(mergeFiles(files, incoming))}
        disabled={busy}
        formats={[
          "MP4",
          "MOV",
          "MKV",
          "WebM",
          "AVI",
          "M4V",
          "MPEG",
          "MPG",
          "TS",
          "WMV",
          "FLV",
          "3GP",
          "MP3",
          "WAV",
          "FLAC",
          "AAC",
          "M4A",
          "OGG",
          "Opus",
          "AIFF",
          "WMA",
        ]}
        formatNote={t("mediaInputNote")}
        accept="audio/*,video/*,.mkv,.avi,.flac,.aiff,.wmv,.ts"
        compact
      />
      <div className="work-grid">
        <section className="surface">
          <div className="panel-heading">
            <h3>{t("media")}</h3>
            <span className="tiny-badge">FFMPEG · WASM</span>
          </div>
          <div className="form-grid">
            <Field label={t("format")}>
              <Select
                label={t("format")}
                value={format}
                onChange={setFormat}
                items={[
                  ...["mp4", "webm", "mkv", "mov", "avi", "ts", "gif"].map(
                    (f) => ({
                      value: f,
                      label: f.toUpperCase(),
                      group: "VIDEO",
                    }),
                  ),
                  ...audioFormats.map((f) => ({
                    value: f,
                    label: f.toUpperCase(),
                    group: "AUDIO",
                  })),
                ]}
              />
            </Field>
            <Field label={t("resolution")}>
              <Select
                label={t("resolution")}
                value={resolution}
                onChange={(value) => setResolution(+value)}
                disabled={audioFormats.includes(format)}
                items={[
                  { value: 0, label: t("original") },
                  ...[2160, 1440, 1080, 720, 480, 360].map((n) => ({
                    value: n,
                    label: `${n}p`,
                  })),
                ]}
              />
            </Field>
            <Field label={t("bitrate")}>
              <Select
                label={t("bitrate")}
                value={bitrate}
                onChange={(value) => setBitrate(+value)}
                items={[64, 96, 128, 192, 256, 320].map((n) => ({
                  value: n,
                  label: `${n} kbps`,
                }))}
              />
            </Field>
          </div>
          <label className="switch-row">
            <span>
              <strong>{t("compress")}</strong>
              <small>CRF 28 / VP9 38 · {t("resolution")}</small>
            </span>
            <input
              className="switch"
              type="checkbox"
              checked={compress}
              onChange={(e) => setCompress(e.target.checked)}
            />
          </label>
          <button
            className="button primary full"
            disabled={busy || !selection.selected.length}
            onClick={run}
          >
            <Icon name="media" size={18} />
            {busy ? t("processing") : `${t("convertSelected")} (${selection.selected.length})`}
          </button>
          {busy && (
            <Progress
              value={progress}
              label={t("processing")}
              onCancel={() => {
                cancelled.current = true;
                engine.current?.cancel();
              }}
            />
          )}
        </section>
        <section className="surface">
          <div className="panel-heading">
            <h3>{t("preview")}</h3>
            <Icon name="shield" size={18} />
          </div>
          {file ? (
            <>
              <FileList
                files={files}
                selection={selection}
                disabled={busy}
                selectedIndex={files.indexOf(file)}
                onSelect={busy ? undefined : setSelectedIndex}
                onRemove={
                  busy
                    ? undefined
                    : (i) => {
                        setFiles(files.filter((_, index) => i !== index));
                        setSelectedIndex(0);
                      }
                }
                metadata={{ [file.name]: meta || file.type }}
              />
              {file.type.startsWith("audio/") ? (
                <audio
                  src={url}
                  controls
                  onLoadedMetadata={(e) =>
                    setMeta(`${Math.round(e.currentTarget.duration)} s`)
                  }
                />
              ) : (
                <video
                  src={url}
                  controls
                  playsInline
                  className="media-preview"
                  onLoadedMetadata={(e) => {
                    const v = e.currentTarget;
                    setMeta(
                      `${v.videoWidth} × ${v.videoHeight} · ${Math.round(v.duration)} s`,
                    );
                  }}
                />
              )}
            </>
          ) : (
            <div className="empty-state">
              <Icon name="media" size={38} />
              <p>{t("empty")}</p>
              <small>MP4 · MOV · MKV · WEBM · MP3 · FLAC</small>
            </div>
          )}
        </section>
      </div>
      <Notice>{t("mediaNote")}</Notice>
      {error && <Notice error>{error}</Notice>}
      <Results batches={batches} onClear={clearBatches} />
    </>
  );
}
