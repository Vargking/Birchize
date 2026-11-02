import { useEffect, useRef } from "react";
import { Logo, Icon } from "./Icons";
import { useI18n } from "../i18n";
import { formatSize } from "../lib/files";
import type { OfflineState } from "../lib/offline";

export function CacheProgress({ state }: { state: OfflineState }) {
  const { t } = useI18n();
  const percent = state.phase === "ready" ? 100
    : state.totalBytes ? Math.min(99, Math.floor(state.bytes / state.totalBytes * 100)) : 0;
  return <div className="cache-progress">
    <div className="cache-progress-caption">
      <span>{t(state.phase === "checking" ? "cacheChecking" : "cacheProgress")}</span>
      <strong>{percent}<small>%</small></strong>
    </div>
    <div className="cache-progress-track" role="progressbar" aria-label={t("cacheProgress")}
      aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
      <div style={{ width: `${percent}%` }} />
    </div>
    <div className="cache-progress-meta">
      <span>{state.completed} / {state.total || "—"} {t("cacheResources")}</span>
      <span>{formatSize(state.bytes)} / {state.totalBytes ? formatSize(state.totalBytes) : "—"}</span>
    </div>
    {state.currentFile && <p className="cache-current" title={state.currentFile}>{state.currentFile}</p>}
    {state.currentSource && <p className="cache-source">{t("cacheSource")} · {state.currentSource}</p>}
  </div>;
}

export function CacheFailures({ state }: { state: OfflineState }) {
  const { t } = useI18n();
  if (!state.failures.length) return null;
  const codes: Record<string, string> = { https: "secureContext", unsupported: "cacheUnsupported",
    quota: "cacheQuota", storage: "cacheStorage", http: "cacheHttp", content: "cacheContent",
    timeout: "cacheTimeout", network: "cacheNetwork", registration: "cacheRegistration" };
  return <div className="cache-failures" role="status">
    <p>{t(state.failures.some((failure) => ["https", "unsupported", "registration"].includes(failure.code)) ? "cacheSetupHint" : "cacheSaved")}</p>
    <ul>{state.failures.map((failure, index) => <li key={`${failure.url}-${index}`}>
      {failure.url && <code>{failure.url}</code>}
      <span>{t(codes[failure.code] || "cacheNetwork")}</span>
      {failure.detail && <small>{failure.detail}</small>}
    </li>)}</ul>
    {state.failures.some((failure) => failure.code === "https") &&
      <a className="button small" href={location.href.replace(/^http:/, "https:")}>{t("cacheUseHttps")}</a>}
  </div>;
}

export default function OfflineLoading({ state, retry, onContinue }: {
  state: OfflineState; retry: () => void; onContinue: () => void;
}) {
  const { t } = useI18n();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  const error = state.phase === "error";
  return <dialog ref={dialog} className="cache-loading-dialog" onCancel={onContinue}
    aria-labelledby="cache-loading-title" aria-describedby="cache-loading-description">
    <div className="cache-loading-card">
      <div className={`cache-brand-icon ${error ? "is-paused" : ""}`}><Logo size={72} /></div>
      <div className="cache-brand-name">Birchize<span>.</span></div>
      <span className="cache-eyebrow">YOUR LOCAL FILE STUDIO</span>
      <h1 id="cache-loading-title">{t(error ? "cachePaused" : "cacheWelcome")}</h1>
      <p id="cache-loading-description" className="cache-description">{t("cacheWelcomeHint")}</p>
      <CacheProgress state={state} />
      <CacheFailures state={state} />
      <div className="cache-loading-actions">
        {error && <button className="button primary" onClick={retry}>{t("cacheRetry")}</button>}
        <button className="text-button" onClick={onContinue}>{t("cacheContinue")} <Icon name="arrow" size={15} /></button>
      </div>
      <div className="cache-loading-credit"><Icon name="shield" size={13} /> {t("cachePrivacy")} <span>· Vargking</span></div>
    </div>
  </dialog>;
}
