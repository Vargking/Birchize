import { useEffect, useState } from "react";
import DOMPurify from "dompurify";
import { useI18n } from "../i18n";
import {
  Dropzone,
  Field,
  FileList,
  Notice,
  Results,
  useFileSelection,
  useBatchResults,
} from "../components/Shared";
import type { PanelProps } from "../components/Shared";
import { Icon } from "../components/Icons";
import { Select } from "../components/Controls";
import { extension, mergeFiles, readableError, stem } from "../lib/files";

function safeHtml(source: string) {
  const clean = DOMPurify.sanitize(source, {
    FORBID_TAGS: [
      "style",
      "link",
      "iframe",
      "object",
      "embed",
      "video",
      "audio",
      "form",
      "input",
    ],
    FORBID_ATTR: ["style", "srcset", "href"],
  });
  const doc = new DOMParser().parseFromString(clean, "text/html");
  doc.querySelectorAll("[src]").forEach((el) => {
    if (
      !/^data:image\/(png|jpeg|webp|gif);base64,/.test(
        el.getAttribute("src") || "",
      )
    )
      el.removeAttribute("src");
  });
  return doc.body.innerHTML;
}
const escape = (s: string) =>
  s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
async function readDocument(file: File) {
  if (file.size > 20 * 1024 * 1024)
    throw new Error("Documents are limited to 20 MB.");
  const ext = extension(file.name);
  if (ext === "docx") {
    const mammoth = await import("mammoth");
    const data = await mammoth.convertToHtml({
      arrayBuffer: await file.arrayBuffer(),
    });
    return safeHtml(data.value);
  }
  if (["html", "htm"].includes(ext)) return safeHtml(await file.text());
  if (["txt", "md", "csv", "json", "log", "xml"].includes(ext))
    return `<pre>${escape(await file.text())}</pre>`;
  throw new Error(
    "Supported document input: DOCX, PDF, TXT, MD, HTML, CSV, JSON, XML. Legacy DOC/XLS/PPT require a desktop office suite.",
  );
}
async function openPdf(file: File) {
  const pdf = await import("pdfjs-dist");
  const worker = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url"))
    .default;
  pdf.GlobalWorkerOptions.workerSrc = worker;
  const base = new URL(
    "engines/pdf/",
    new URL(import.meta.env.BASE_URL, document.baseURI),
  );
  return pdf.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    cMapUrl: new URL("cmaps/", base).href,
    cMapPacked: true,
    standardFontDataUrl: new URL("standard_fonts/", base).href,
    wasmUrl: new URL("wasm/", base).href,
  }).promise;
}
export default function Documents({
  files,
  setFiles,
  onResult,
  preset,
}: PanelProps) {
  const { t } = useI18n();
  const [format, setFormat] = useState(preset?.format || "pdf"),
    [html, setHtml] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [meta, setMeta] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selection = useFileSelection(files);
  const { batches, beginBatch, clearBatches } = useBatchResults(onResult);
  const file = files[Math.min(selectedIndex, Math.max(0, files.length - 1))];
  useEffect(() => {
    let active = true;
    setHtml("");
    setMeta("");
    setError("");
    if (!file) return;
    if (extension(file.name) === "pdf") {
      setMeta("PDF · " + t("preview"));
      openPdf(file)
        .then(async (doc) => {
          if (active) setMeta(`${doc.numPages} pages · PDF`);
          await doc.destroy();
        })
        .catch((e) => {
          if (active) setError(readableError(e));
        });
      return () => {
        active = false;
      };
    }
    readDocument(file)
      .then((value) => {
        if (active) {
          setHtml(value);
          const doc = new DOMParser().parseFromString(value, "text/html");
          setMeta(`${doc.body.textContent?.length || 0} characters`);
        }
      })
      .catch((e) => {
        if (active) setError(readableError(e));
      });
    return () => {
      active = false;
    };
  }, [file]);
  useEffect(() => {
    if (files.length && files.every((f) => extension(f.name) === "pdf"))
      setFormat("txt");
  }, [files]);
  async function run() {
    if (!selection.selected.length || busy) return;
    setBusy(true);
    setError("");
    const batch = beginBatch(selection.selected.length);
    const add = batch.add;
    const failures: string[] = [];
    for (const file of selection.selected) {
      try {
        if (extension(file.name) === "pdf") {
          if (!["txt", "png"].includes(format))
            throw new Error(
              "PDF output supports TXT or PNG. Select one of these formats.",
            );
          if (file.size > 30 * 1024 * 1024)
            throw new Error("PDF is limited to 30 MB.");
          const doc = await openPdf(file);
          try {
            if (doc.numPages > 100)
              throw new Error("PDF extraction is limited to 100 pages.");
            let text = "";
            for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
              const page = await doc.getPage(pageNumber);
              if (format === "png") {
                const viewport = page.getViewport({ scale: 1.5 });
                if (viewport.width * viewport.height > 20_000_000)
                  throw new Error("PDF page exceeds image size limit.");
                const canvas = document.createElement("canvas");
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                await page.render({
                  canvas,
                  canvasContext: canvas.getContext("2d")!,
                  viewport,
                }).promise;
                const blob = await new Promise<Blob>((resolve, reject) =>
                  canvas.toBlob(
                    (b) => (b ? resolve(b) : reject(new Error("PNG failed"))),
                    "image/png",
                  ),
                );
                add({
                  name: `${stem(file.name)}-${pageNumber}.png`,
                  blob,
                  image: true,
                });
                canvas.width = canvas.height = 0;
              } else {
                const content = await page.getTextContent();
                text +=
                  content.items
                    .map((item) =>
                      "str" in item
                        ? item.str +
                          ("hasEOL" in item && item.hasEOL ? "\n" : " ")
                        : "",
                    )
                    .join("") + "\n\n";
              }
              page.cleanup();
            }
            if (format !== "png") {
              add({
                name: `${stem(file.name)}.txt`,
                blob: new Blob([text], { type: "text/plain;charset=utf-8" }),
              });
            }
          } finally {
            await doc.destroy();
          }
        } else {
          if (!["pdf", "txt", "html"].includes(format))
            throw new Error("Document output supports PDF, TXT or HTML.");
          const content = await readDocument(file);
          if (format === "txt") {
            const doc = new DOMParser().parseFromString(
              content.replace(/<\/(p|h[1-6]|tr|li)>/gi, "</$1>\n"),
              "text/html",
            );
            add({
              name: `${stem(file.name)}.txt`,
              blob: new Blob([doc.body.textContent || ""], {
                type: "text/plain;charset=utf-8",
              }),
            });
          } else if (format === "html")
            add({
              name: `${stem(file.name)}.html`,
              blob: new Blob(
                [
                  `<!doctype html><html><head><meta charset="utf-8"><title>${escape(stem(file.name))}</title></head><body>${content}</body></html>`,
                ],
                { type: "text/html;charset=utf-8" },
              ),
            });
          else {
            const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
              import("html2canvas"),
              import("jspdf"),
            ]);
            const sheet = document.createElement("div");
            sheet.className = "pdf-export-sheet";
            sheet.innerHTML = content;
            document.body.appendChild(sheet);
            try {
              await document.fonts.ready;
              if (sheet.scrollHeight > 25000)
                throw new Error(
                  "Document is too long for browser PDF rendering. Split it into smaller documents.",
                );
              const canvas = await html2canvas(sheet, {
                scale: 1.5,
                backgroundColor: "#ffffff",
                useCORS: false,
                allowTaint: false,
                logging: false,
              });
              const pdf = new jsPDF({ unit: "mm", format: "a4" });
              const pageWidth = 190,
                pageHeight = 277;
              const imageHeight = (canvas.height / canvas.width) * pageWidth;
              const image = canvas.toDataURL("image/jpeg", 0.94);
              for (let offset = 0; offset < imageHeight; offset += pageHeight) {
                if (offset) pdf.addPage();
                pdf.addImage(
                  image,
                  "JPEG",
                  10,
                  10 - offset,
                  pageWidth,
                  imageHeight,
                );
                pdf.setFillColor(255, 255, 255);
                pdf.rect(0, 0, 210, 10, "F");
                pdf.rect(0, 287, 210, 10, "F");
              }
              add({ name: `${stem(file.name)}.pdf`, blob: pdf.output("blob") });
            } finally {
              sheet.remove();
            }
          }
        }
      } catch (e) {
        failures.push(`${file.name}: ${readableError(e)}`);
      }
    }
    setError(failures.join("\n"));
    batch.finish(failures.length);
    setBusy(false);
  }
  const isPdf = file && extension(file.name) === "pdf";
  return (
    <>
      <Dropzone
        compact
        onFiles={(incoming) => setFiles(mergeFiles(files, incoming))}
        disabled={busy}
        formats={[
          "DOCX",
          "PDF",
          "TXT",
          "MD",
          "HTML",
          "HTM",
          "CSV",
          "JSON",
          "XML",
          "LOG",
        ]}
        formatNote={t("docNote")}
        accept=".docx,.pdf,.txt,.md,.html,.htm,.csv,.json,.xml,.log"
      />
      <div className="work-grid">
        <section className="surface">
          <div className="panel-heading">
            <h3>{t("documents")}</h3>
            <span className="tiny-badge">LOCAL DOCUMENTS</span>
          </div>
          {file && (
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
          )}
          <Field label={t("format")}>
            <Select
              label={t("format")}
              value={format}
              onChange={setFormat}
              items={["pdf", "txt", "html", "png"].map((f) => ({
                value: f,
                label: f.toUpperCase() + (f === "png" ? " · PDF pages" : ""),
              }))}
            />
          </Field>
          <button
            className="button primary full"
            disabled={!selection.selected.length || busy}
            onClick={run}
          >
            <Icon name="documents" size={18} />
            {busy ? t("processing") : `${t("convertSelected")} (${selection.selected.length})`}
          </button>
        </section>
        <section className="surface document-preview">
          <div className="panel-heading">
            <h3>{t("preview")}</h3>
            <span className="tiny-badge">SANITIZED</span>
          </div>
          {html ? (
            <iframe
              title={t("preview")}
              sandbox=""
              srcDoc={`<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"><style>body{font:14px/1.7 system-ui;color:#293b31;padding:18px;overflow-wrap:anywhere}img{max-width:100%}pre{white-space:pre-wrap}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:6px}</style>${html}`}
            />
          ) : (
            <div className="empty-state">
              <Icon name="documents" size={36} />
              <p>{isPdf ? "PDF → TXT / PNG" : t("empty")}</p>
            </div>
          )}
        </section>
      </div>
      <Notice>{t("docNote")}</Notice>
      {error && <Notice error>{error}</Notice>}
      <Results batches={batches} onClear={clearBatches} />
    </>
  );
}
