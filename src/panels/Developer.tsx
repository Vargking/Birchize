import { useState } from "react";
import { useI18n } from "../i18n";
import {
  Dropzone,
  Field,
  FileList,
  Notice,
  Segmented,
  useFileSelection,
  useBatchResults,
  Results,
} from "../components/Shared";
import type { PanelProps } from "../components/Shared";
import { Icon } from "../components/Icons";
import { Select } from "../components/Controls";
import {
  base64ToBytes,
  bytesToBase64,
  download,
  mergeFiles,
  readableError,
} from "../lib/files";
async function computeHash(data: string | Uint8Array, algorithm: string) {
  const hash = await import("hash-wasm");
  const algorithms: Record<string, () => Promise<string>> = {
    MD5: () => hash.md5(data),
    "SHA-1": () => hash.sha1(data),
    "SHA-224": () => hash.sha224(data),
    "SHA-256": () => hash.sha256(data),
    "SHA-384": () => hash.sha384(data),
    "SHA-512": () => hash.sha512(data),
    "SHA3-256": () => hash.sha3(data, 256),
    "SHA3-512": () => hash.sha3(data, 512),
    BLAKE2b: () => hash.blake2b(data),
    BLAKE3: () => hash.blake3(data),
    "RIPEMD-160": () => hash.ripemd160(data),
    CRC32: () => hash.crc32(data),
    xxHash64: () => hash.xxhash64(data),
    SM3: () => hash.sm3(data),
  };
  return algorithms[algorithm]();
}
export default function Developer({ files, setFiles, onResult }: PanelProps) {
  const { t } = useI18n();
  const [tool, setTool] = useState("base64"),
    [input, setInput] = useState(""),
    [output, setOutput] = useState(""),
    [algorithm, setAlgorithm] = useState("SHA-256"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [copied, setCopied] = useState(false),
    [useFile, setUseFile] = useState(false);
  const selection = useFileSelection(files);
  const { batches, beginBatch, clearBatches } = useBatchResults(onResult);
  async function run(action: string) {
    setError("");
    setBusy(true);
    try {
      if (
        useFile &&
        (tool === "hash" || (tool === "base64" && action === "encode"))
      ) {
        if (!selection.selected.length) throw new Error(t("selectAtLeastOne"));
        const batch = beginBatch(selection.selected.length);
        const outputs: string[] = [];
        const failures: string[] = [];
        for (const file of selection.selected) {
          try {
            if (file.size > 32 * 1024 * 1024)
              throw new Error(`${file.name}: 32 MB limit for Base64 / hashing`);
            const data = new Uint8Array(await file.arrayBuffer());
            const result =
              tool === "hash"
                ? await computeHash(data, algorithm)
                : bytesToBase64(data);
            outputs.push(`[${file.name}]\n${result}`);
            batch.add({
              name: `${file.name}.${tool}.txt`,
              blob: new Blob([result], { type: "text/plain;charset=utf-8" }),
            });
          } catch (e) {
            failures.push(`${file.name}: ${readableError(e)}`);
          }
        }
        batch.finish(failures.length);
        setError(failures.join("\n"));
        setOutput(outputs.join("\n\n"));
        return;
      }
      if (tool === "base64") {
        if (action === "encode")
          setOutput(
            bytesToBase64(
              useFile && files[0]
                ? new Uint8Array(await files[0].arrayBuffer())
                : new TextEncoder().encode(input),
            ),
          );
        else
          setOutput(
            new TextDecoder("utf-8", { fatal: true }).decode(
              base64ToBytes(input),
            ),
          );
      }
      if (tool === "url")
        setOutput(
          action === "encode"
            ? encodeURIComponent(input)
            : decodeURIComponent(input),
        );
      if (tool === "json")
        setOutput(
          JSON.stringify(JSON.parse(input), null, action === "minify" ? 0 : 2),
        );
      if (tool === "uuid")
        setOutput(
          Array.from({ length: 10 }, () => crypto.randomUUID()).join("\n"),
        );
      if (tool === "hash") {
        setOutput(await computeHash(input, algorithm));
      }
    } catch (e) {
      setError(readableError(e));
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch (e) {
      setError(readableError(e));
    }
  }
  return (
    <>
      <Segmented
        value={tool}
        onChange={(v) => {
          setTool(v);
          setOutput("");
          setError("");
        }}
        items={[
          { id: "base64", label: "Base64" },
          { id: "hash", label: "Hash / MD5" },
          { id: "url", label: "URL" },
          { id: "json", label: "JSON" },
          { id: "uuid", label: "UUID" },
        ]}
      />
      {["base64", "hash"].includes(tool) && (
        <>
          <label className="switch-row surface file-mode">
            <span>
              {t("file")} / {t("text")}
            </span>
            <input
              className="switch"
              type="checkbox"
              checked={useFile}
              onChange={(e) => setUseFile(e.target.checked)}
            />
          </label>
          {useFile && (
            <>
              <Dropzone
                compact
                disabled={busy}
                formats={[t("allFiles")]}
                onFiles={(f) => {
                  if (f.some((file) => file.size > 32 * 1024 * 1024)) {
                    setError("32 MB limit for Base64 / hashing");
                    return;
                  }
                  setFiles(mergeFiles(files, f));
                }}
              />
              {files.length > 0 && (
                <FileList
                  files={files}
                  selection={selection}
                  disabled={busy}
                  onRemove={
                    busy
                      ? undefined
                      : (i) => setFiles(files.filter((_, index) => i !== index))
                  }
                />
              )}
            </>
          )}
        </>
      )}
      {tool === "hash" && (
        <Field label={t("algorithm")}>
          <Select
            label={t("algorithm")}
            value={algorithm}
            onChange={setAlgorithm}
            items={[
              "MD5",
              "SHA-1",
              "SHA-224",
              "SHA-256",
              "SHA-384",
              "SHA-512",
              "SHA3-256",
              "SHA3-512",
              "BLAKE2b",
              "BLAKE3",
              "RIPEMD-160",
              "CRC32",
              "xxHash64",
              "SM3",
            ].map((a) => ({ value: a, label: a }))}
          />
        </Field>
      )}
      <div className="work-grid equal">
        <section className="surface">
          <div className="panel-heading">
            <h3>{t("input")}</h3>
            <button className="text-button" onClick={() => setInput("")}>
              {t("clear")}
            </button>
          </div>
          <textarea
            className="code-textarea"
            spellCheck={false}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              tool === "json"
                ? '{ "hello": "Birchize" }'
                : tool === "uuid"
                  ? "UUID v4 · crypto.randomUUID()"
                  : "Hello, Birchize."
            }
            aria-label={t("input")}
          />
          <div className="action-row">
            {["base64", "url"].includes(tool) ? (
              <>
                <button
                  className="button primary"
                  disabled={busy || (tool === "base64" && useFile && !selection.selected.length)}
                  onClick={() => run("encode")}
                >
                  {t("encode")}{tool === "base64" && useFile && ` (${selection.selected.length})`}
                  <Icon name="arrow" size={16} />
                </button>
                <button
                  className="button"
                  disabled={busy}
                  onClick={() => run("decode")}
                >
                  {t("decode")}
                </button>
              </>
            ) : tool === "json" ? (
              <>
                <button
                  className="button primary"
                  onClick={() => run("format")}
                >
                  Format JSON
                </button>
                <button className="button" onClick={() => run("minify")}>
                  Minify
                </button>
              </>
            ) : (
              <button
                className="button primary"
                disabled={busy || (useFile && tool === "hash" && !selection.selected.length)}
                onClick={() => run("hash")}
              >
                {busy
                  ? t("processing")
                  : tool === "uuid"
                    ? "Generate UUID"
                    : `${t("calculate")}${useFile ? ` (${selection.selected.length})` : ""}`}
                <Icon name="arrow" size={16} />
              </button>
            )}
          </div>
        </section>
        <section className="surface">
          <div className="panel-heading">
            <h3>{t("output")}</h3>
            <button className="text-button" disabled={!output} onClick={copy}>
              <Icon name={copied ? "check" : "copy"} size={15} />
              {t(copied ? "copied" : "copy")}
            </button>
          </div>
          <textarea
            className="code-textarea output"
            value={output}
            readOnly
            spellCheck={false}
            aria-label={t("output")}
            placeholder="…"
          />
          <div className="action-row">
            <button
              className="button"
              disabled={!output}
              onClick={() =>
                download(
                  new Blob([output], { type: "text/plain;charset=utf-8" }),
                  `birchize-${tool}.txt`,
                )
              }
            >
              <Icon name="download" size={16} />
              {t("download")}
            </button>
            {tool === "base64" && (
              <button
                className="button"
                disabled={!input}
                onClick={() => {
                  try {
                    download(new Blob([base64ToBytes(input)]), "decoded.bin");
                  } catch (e) {
                    setError(readableError(e));
                  }
                }}
              >
                Base64 → {t("file")}
              </button>
            )}
          </div>
        </section>
      </div>
      {tool === "hash" && (
        <Notice>
          MD5 / SHA-1 / CRC / xxHash: checksums only, not password storage or
          security signatures.
        </Notice>
      )}
      {error && <Notice error>{error}</Notice>}
      <Results batches={batches} onClear={clearBatches} />
    </>
  );
}
