import { useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { useI18n } from "../i18n";
import { Dropzone, FileList, Notice, Segmented } from "../components/Shared";
import { ColorPicker } from "../components/Controls";
import type { PanelProps, Result } from "../components/Shared";
import { Icon } from "../components/Icons";
import type { IconName } from "../components/Icons";
import { cleanSvg, starterSvg } from "../lib/svg";
import { download, mergeFiles, readableError, stem } from "../lib/files";
import { convertImage } from "../engines/image";
type Point = { x: number; y: number };
export default function SvgEditor({ files, setFiles, onResult }: PanelProps) {
  const { t } = useI18n();
  const [source, setSource] = useState(starterSvg),
    [safe, setSafe] = useState(starterSvg),
    [mode, setMode] = useState("draw"),
    [tool, setTool] = useState<IconName>("pen"),
    [color, setColor] = useState("#315c47"),
    [width, setWidth] = useState(4),
    [error, setError] = useState(""),
    [history, setHistory] = useState<string[]>([starterSvg]),
    [index, setIndex] = useState(0),
    [draft, setDraft] = useState(""),
    [busy, setBusy] = useState(false);
  const svg = useRef<SVGSVGElement>(null),
    points = useRef<Point[]>([]),
    drawing = useRef(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedFile =
    files[Math.min(selectedIndex, Math.max(0, files.length - 1))];
  const documents = useRef(new Map<File, string>());
  const currentFile = useRef<File | undefined>(undefined);
  const currentSource = useRef(source);
  currentSource.current = source;
  const commit = (next: string) => {
    // Commit the finished stroke in the same render that removes the draft.
    // The source editor's debounce must never delay pointer drawing.
    setSafe(cleanSvg(next));
    setError("");
    setSource(next);
    setHistory((prev) => [...prev.slice(0, index + 1), next].slice(-100));
    setIndex(Math.min(index + 1, 99));
  };
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        setSafe(cleanSvg(source));
        setError("");
      } catch (e) {
        setError(readableError(e));
      }
    }, 180);
    return () => clearTimeout(timer);
  }, [source]);
  useEffect(() => {
    let active = true;
    if (currentFile.current)
      documents.current.set(currentFile.current, currentSource.current);
    currentFile.current = undefined;
    if (selectedFile) {
      const saved = documents.current.get(selectedFile);
      (saved !== undefined ? Promise.resolve(saved) : selectedFile.text())
        .then((text) => {
          if (active) {
            const safe = cleanSvg(text);
            currentFile.current = selectedFile;
            setSafe(safe);
            setSource(safe);
            setHistory([safe]);
            setIndex(0);
          }
        })
        .catch((e) => {
          if (active) setError(readableError(e));
        });
    } else {
      setSource(starterSvg);
      setSafe(starterSvg);
      setHistory([starterSvg]);
      setIndex(0);
    }
    return () => {
      active = false;
    };
  }, [selectedFile]);
  const doc = new DOMParser().parseFromString(safe, "image/svg+xml");
  const root = doc.documentElement;
  const viewBox =
    root.getAttribute("viewBox") ||
    `0 0 ${parseFloat(root.getAttribute("width") || "600") || 600} ${parseFloat(root.getAttribute("height") || "420") || 420}`;
  const view = viewBox.trim().split(/[ ,]+/).map(Number);
  const artWidth = view[2] || 600,
    artHeight = view[3] || 420;
  function point(e: PointerEvent<SVGSVGElement>): Point {
    const matrix = e.currentTarget.getScreenCTM();
    if (!matrix) return { x: 0, y: 0 };
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(
      matrix.inverse(),
    );
    return { x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 };
  }
  function shape() {
    const p = points.current[0],
      q = points.current.at(-1);
    if (!p || !q) return "";
    const attrs = `stroke="${color}" stroke-width="${width}" fill="none" stroke-linecap="round" stroke-linejoin="round"`;
    if (tool === "pen")
      return `<path d="${points.current.map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`).join(" ")}" ${attrs}/>`;
    if (tool === "rect")
      return `<rect x="${Math.min(p.x, q.x)}" y="${Math.min(p.y, q.y)}" width="${Math.abs(q.x - p.x)}" height="${Math.abs(q.y - p.y)}" rx="3" ${attrs}/>`;
    if (tool === "ellipse")
      return `<ellipse cx="${(p.x + q.x) / 2}" cy="${(p.y + q.y) / 2}" rx="${Math.abs(q.x - p.x) / 2}" ry="${Math.abs(q.y - p.y) / 2}" ${attrs}/>`;
    return `<line x1="${p.x}" y1="${p.y}" x2="${q.x}" y2="${q.y}" ${attrs}/>`;
  }
  function start(e: PointerEvent<SVGSVGElement>) {
    if (mode !== "draw") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    points.current = [point(e)];
  }
  function move(e: PointerEvent<SVGSVGElement>) {
    if (!drawing.current) return;
    const p = point(e);
    if (tool === "pen") points.current.push(p);
    else points.current = [points.current[0], p];
    setDraft(shape());
  }
  function end() {
    if (!drawing.current) return;
    drawing.current = false;
    const addition = shape();
    setDraft("");
    if (addition) {
      // XMLSerializer makes an empty canvas a self-closing <svg/>. Append
      // through the SVG DOM so the first stroke also survives after clearing.
      const fragment = new DOMParser().parseFromString(
        `<svg xmlns="http://www.w3.org/2000/svg">${addition}</svg>`,
        "image/svg+xml",
      );
      for (const child of Array.from(fragment.documentElement.childNodes))
        root.appendChild(doc.importNode(child, true));
      commit(new XMLSerializer().serializeToString(root));
    }
  }
  async function save(format: string) {
    setBusy(true);
    try {
      const clean = cleanSvg(source);
      if (format === "svg") {
        const r: Result = {
          name: `${selectedFile ? stem(selectedFile.name) : "birchize-artwork"}.svg`,
          blob: new Blob([clean], { type: "image/svg+xml" }),
        };
        download(r.blob, r.name);
        onResult(r);
      } else {
        const file = new File([clean], "artwork.svg", {
          type: "image/svg+xml",
        });
        const output = await convertImage(file, {
          format: "png",
          quality: 1,
          maxWidth: 0,
          compress: false,
          targetKB: 200,
          background: "#ffffff",
        });
        const r = {
          name: `${selectedFile ? stem(selectedFile.name) : "birchize-artwork"}.png`,
          blob: output.blob,
          image: true,
        };
        download(r.blob, r.name);
        onResult(r);
      }
    } catch (e) {
      setError(readableError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="editor-top">
        <Segmented
          value={mode}
          onChange={(v) => {
            if (v === "draw") {
              try {
                const clean = cleanSvg(source);
                if (clean !== history[index]) commit(clean);
              } catch (e) {
                setError(readableError(e));
                return;
              }
            }
            setMode(v);
          }}
          items={[
            { id: "draw", label: t("draw") },
            { id: "code", label: t("code") },
          ]}
        />
        <div className="action-row">
          <button
            className="button small"
            disabled={busy || !!error}
            onClick={() => save("png")}
          >
            PNG
            <Icon name="download" size={15} />
          </button>
          <button
            className="button primary small"
            disabled={busy || !!error}
            onClick={() => save("svg")}
          >
            SVG
            <Icon name="download" size={15} />
          </button>
        </div>
      </div>
      <div className="svg-editor surface">
        <div className="drawing-toolbar">
          {(["pen", "rect", "ellipse", "line"] as IconName[]).map((name) => (
            <button
              key={name}
              className={`icon-button ${tool === name ? "selected" : ""}`}
              title={name}
              aria-label={name}
              onClick={() => {
                setTool(name);
                setMode("draw");
              }}
            >
              <Icon name={name} />
            </button>
          ))}
          <span className="toolbar-divider" />
          <ColorPicker
            label={t("color")}
            value={color}
            onChange={setColor}
            compact
          />
          <input
            className="stroke-width"
            title={t("width")}
            aria-label={t("width")}
            type="number"
            min={1}
            max={40}
            value={width}
            onChange={(e) =>
              setWidth(Math.min(40, Math.max(1, +e.target.value)))
            }
          />
          <span className="toolbar-spacer" />
          <button
            className="icon-button"
            aria-label={t("undo")}
            title={t("undo")}
            disabled={index < 1}
            onClick={() => {
              setIndex(index - 1);
              setSource(history[index - 1]);
              setSafe(cleanSvg(history[index - 1]));
            }}
          >
            <Icon name="undo" />
          </button>
          <button
            className="icon-button"
            aria-label={t("redo")}
            title={t("redo")}
            disabled={index >= history.length - 1}
            onClick={() => {
              setIndex(index + 1);
              setSource(history[index + 1]);
              setSafe(cleanSvg(history[index + 1]));
            }}
          >
            <Icon name="redo" />
          </button>
          <button
            className="icon-button"
            aria-label={t("clear")}
            title={t("clear")}
            onClick={() =>
              commit(
                `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 420" width="600" height="420"></svg>`,
              )
            }
          >
            <Icon name="trash" size={18} />
          </button>
        </div>
        <div className={`editor-body ${mode === "code" ? "code-mode" : ""}`}>
          {mode === "code" && (
            <textarea
              className="svg-code"
              aria-label="SVG code"
              spellCheck={false}
              value={source}
              onChange={(e) => setSource(e.target.value)}
            />
          )}
          <div className="svg-canvas checkerboard">
            <svg
              ref={svg}
              viewBox={viewBox}
              className={mode === "draw" ? "drawing" : ""}
              style={{ aspectRatio: `${artWidth}/${artHeight}` }}
              onPointerDown={start}
              onPointerMove={move}
              onPointerUp={end}
              onPointerCancel={() => {
                drawing.current = false;
                setDraft("");
              }}
            >
              <g dangerouslySetInnerHTML={{ __html: root.innerHTML }} />
              <g dangerouslySetInnerHTML={{ __html: draft }} />
            </svg>
            <span className="canvas-dimensions">
              {artWidth} × {artHeight} · SVG
            </span>
          </div>
        </div>
      </div>
      <Dropzone
        onFiles={(incoming) => setFiles(mergeFiles(files, incoming))}
        disabled={busy}
        formats={["SVG"]}
        formatNote={t("svgNote")}
        accept=".svg,image/svg+xml"
        compact
      />
      {!!files.length && (
        <section className="surface">
          <FileList
            files={files}
            selectedIndex={files.indexOf(selectedFile)}
            onSelect={busy ? undefined : setSelectedIndex}
            onRemove={
              busy
                ? undefined
                : (i) => {
                    documents.current.delete(files[i]);
                    setFiles(files.filter((_, index) => index !== i));
                    setSelectedIndex(0);
                  }
            }
          />
        </section>
      )}
      <Notice>{t("svgNote")}</Notice>
      {error && <Notice error>{error}</Notice>}
    </>
  );
}
