import { useState } from "react";
import { useI18n } from "../i18n";
import {
  Dropzone,
  Field,
  FileList,
  Notice,
  Results,
  Segmented,
  useFileSelection,
  useBatchResults,
} from "../components/Shared";
import type { PanelProps, Result } from "../components/Shared";
import { Icon } from "../components/Icons";
import { Select } from "../components/Controls";
import { decryptFile, encryptFile } from "../engines/crypto";
import type { Cipher } from "../engines/crypto";
import { mergeFiles, readableError } from "../lib/files";
export default function Crypto({ files, setFiles, onResult }: PanelProps) {
  const { t } = useI18n();
  const [mode, setMode] = useState("encrypt"),
    [algorithm, setAlgorithm] = useState<Cipher>("AES-GCM"),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const selection = useFileSelection(files);
  const { batches, beginBatch, clearBatches } = useBatchResults(onResult);
  async function run() {
    if (!selection.selected.length || busy) return;
    setBusy(true);
    setError("");
    try {
      if (!crypto.subtle) throw new Error(t("secureContext"));
      if (mode === "encrypt" && password !== confirm)
        throw new Error(t("confirmPassword") + " ≠ " + t("password"));
      const batch = beginBatch(selection.selected.length);
      const failures: string[] = [];
      for (const file of selection.selected) {
        try {
          const r: Result =
            mode === "encrypt"
              ? {
                  blob: await encryptFile(file, password, algorithm),
                  name: `${file.name}.birch`,
                }
              : await decryptFile(file, password);
          batch.add(r);
        } catch (e) {
          failures.push(`${file.name}: ${readableError(e)}`);
        }
      }
      setError(failures.join("\n"));
      batch.finish(failures.length);
      setPassword("");
      setConfirm("");
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
        onChange={(v) => {
          setMode(v);
          setError("");
        }}
        items={[
          { id: "encrypt", label: t("encrypt") },
          { id: "decrypt", label: t("decrypt") },
        ]}
      />
      <Dropzone
        compact
        disabled={busy}
        onFiles={(incoming) => setFiles(mergeFiles(files, incoming))}
        formats={mode === "decrypt" ? [".birch"] : [t("allFiles")]}
        accept={mode === "decrypt" ? ".birch" : undefined}
      />
      <div className="work-grid">
        <section className="surface">
          <div className="panel-heading">
            <h3>{t(mode)}</h3>
            <Icon name="crypto" />
          </div>
          {mode === "encrypt" && (
            <Field label={t("algorithm")}>
              <Select
                label={t("algorithm")}
                value={algorithm}
                onChange={(value) => setAlgorithm(value as Cipher)}
                items={[
                  { value: "AES-GCM", label: "AES-256-GCM" },
                  { value: "AES-CBC", label: "AES-256-CBC + HMAC-SHA256" },
                  { value: "AES-CTR", label: "AES-256-CTR + HMAC-SHA256" },
                ]}
              />
            </Field>
          )}
          <Field label={t("password")}>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              placeholder="••••••••"
            />
          </Field>
          {mode === "encrypt" && (
            <Field label={t("confirmPassword")}>
              <input
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
              />
            </Field>
          )}
          <button
            className="button primary full"
            onClick={run}
            disabled={
              busy ||
              !selection.selected.length ||
              !password ||
              (mode === "encrypt" &&
                (password.length < 8 || password !== confirm))
            }
          >
            <Icon name="shield" size={18} />
            {busy ? t("processing") : `${t(mode)} (${selection.selected.length})`}
          </button>
        </section>
        <section className="surface">
          <div className="panel-heading">
            <h3>{t("file")}</h3>
            <span className="tiny-badge">AES-256</span>
          </div>
          {files.length ? (
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
          ) : (
            <div className="empty-state">
              <Icon name="crypto" size={36} />
              <p>{t("privacy")}</p>
            </div>
          )}
        </section>
      </div>
      <Notice>{t("cryptoNote")}</Notice>
      {error && <Notice error>{error}</Notice>}
      <Results batches={batches} onClear={clearBatches} />
    </>
  );
}
