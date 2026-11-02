import { useEffect, useRef, useState } from "react";

export interface CacheFailure { url: string; code: string; detail: string }
export interface OfflineState {
  phase: "checking" | "caching" | "ready" | "error" | "dev";
  completed: number;
  total: number;
  bytes: number;
  totalBytes: number;
  currentFile: string;
  currentSource: string;
  failures: CacheFailure[];
}
const initial: OfflineState = {
  phase: import.meta.env.DEV ? "dev" : "checking",
  completed: 0, total: 0, bytes: 0, totalBytes: 0, currentFile: "", currentSource: "", failures: [],
};
export function useOfflineCache() {
  const [state, setState] = useState<OfflineState>(initial);
  const command = useRef<() => void>(() => {});
  useEffect(() => {
    if (import.meta.env.DEV) return;
    let disposed = false;
    let registration: ServiceWorkerRegistration | undefined;
    let poll: number | undefined;
    const cleanups: (() => void)[] = [];
    const fail = (code: string, detail = "") => {
      if (!disposed) setState((previous) => ({ ...previous, phase: "error", failures: [{ url: "", code, detail }] }));
    };
    if (!window.isSecureContext) { fail("https"); return; }
    if (!("serviceWorker" in navigator)) { fail("unsupported"); return; }
    const send = (type: string) => {
      const worker = registration?.active;
      if (worker?.state === "activated") worker.postMessage({ type });
    };
    const watch = (worker: ServiceWorker | null) => {
      if (!worker) return;
      const changed = () => {
        if (worker.state === "activated") send("CACHE_START");
        if (worker.state === "redundant" && !registration?.active)
          fail("registration", "Service Worker installation failed.");
      };
      worker.addEventListener("statechange", changed);
      cleanups.push(() => worker.removeEventListener("statechange", changed));
      changed();
    };
    const message = (event: MessageEvent) => {
      if (event.data?.type !== "OFFLINE_STATUS" || disposed) return;
      const source = event.source as ServiceWorker | null;
      if (source?.scriptURL !== new URL(`${import.meta.env.BASE_URL}sw.js`, document.baseURI).href) return;
      const incoming = event.data.state as OfflineState;
      if (!["checking", "caching", "ready", "error"].includes(incoming?.phase)) return;
      setState(incoming);
    };
    navigator.serviceWorker.addEventListener("message", message);
    const start = async () => {
      try {
        registration = await navigator.serviceWorker.register(
          new URL(`${import.meta.env.BASE_URL}sw.js`, document.baseURI), { updateViaCache: "none" },
        );
        if (disposed) return;
        const update = () => watch(registration?.installing || null);
        registration.addEventListener("updatefound", update);
        cleanups.push(() => registration?.removeEventListener("updatefound", update));
        watch(registration.installing);
        watch(registration.waiting);
        watch(registration.active);
        send("CACHE_START");
        // Recover status when this page reloads or the worker is restarted.
        poll = window.setInterval(() => send("CACHE_STATUS"), 5000);
      } catch (error) { fail("registration", error instanceof Error ? error.message : String(error)); }
    };
    const controllerChanged = () => send("CACHE_START");
    navigator.serviceWorker.addEventListener("controllerchange", controllerChanged);
    command.current = () => {
      setState((previous) => ({ ...previous, phase: "caching", failures: [] }));
      if (registration?.active) send("CACHE_RETRY");
      else void start();
    };
    void start();
    return () => {
      disposed = true;
      window.clearInterval(poll);
      navigator.serviceWorker.removeEventListener("message", message);
      navigator.serviceWorker.removeEventListener("controllerchange", controllerChanged);
      for (const cleanup of cleanups) cleanup();
    };
  }, []);
  return { state, retry: () => command.current() };
}
