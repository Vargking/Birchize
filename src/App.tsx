import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { I18n, locales, translate } from "./i18n";
import type { Locale } from "./i18n";
import { Icon, Logo } from "./components/Icons";
import type { IconName } from "./components/Icons";
import { Dropzone } from "./components/Shared";
import Tutorial from "./components/Tutorial";
import { Select } from "./components/Controls";
import type { Result, ConversionPreset } from "./components/Shared";
import { download, formatSize, inferTool } from "./lib/files";
import { groupResults, retainRecentResults } from "./lib/batches";
const Images = lazy(() => import("./panels/Images"));
const Media = lazy(() => import("./panels/Media"));
const Documents = lazy(() => import("./panels/Documents"));
const SvgEditor = lazy(() => import("./panels/SvgEditor"));
const Archives = lazy(() => import("./panels/Archives"));
const Developer = lazy(() => import("./panels/Developer"));
const Crypto = lazy(() => import("./panels/Crypto"));
type Tool =
  | "home"
  | "images"
  | "media"
  | "documents"
  | "svg"
  | "archives"
  | "dev"
  | "crypto";
const toolData: {
  id: Tool;
  icon: IconName;
  desc: string;
  tags: string;
  color: string;
  keywords: string;
}[] = [
  {
    id: "images",
    icon: "images",
    desc: "imageDesc",
    tags: "JPG · PNG · WEBP · SVG",
    color: "green",
    keywords:
      "图片 照片 image photo jpg png jpeg webp avif bmp ico tiff compress 压缩",
  },
  {
    id: "media",
    icon: "media",
    desc: "mediaDesc",
    tags: "MP4 · MP3 · MOV · FLAC",
    color: "blue",
    keywords:
      "音频 视频 media video audio mp4 mp3 wav flac ogg mov avi mkv webm extract compress",
  },
  {
    id: "documents",
    icon: "documents",
    desc: "documentDesc",
    tags: "WORD → PDF · TXT · HTML",
    color: "sand",
    keywords: "文档 document word docx pdf txt html markdown md",
  },
  {
    id: "svg",
    icon: "svg",
    desc: "svgDesc",
    tags: "SVG · DRAW · LIVE EDIT",
    color: "purple",
    keywords: "矢量 绘制 svg vector draw edit code 编辑",
  },
  {
    id: "archives",
    icon: "archives",
    desc: "archiveDesc",
    tags: "ZIP · RAR · 7Z · TAR",
    color: "peach",
    keywords: "压缩包 解压 archive extract zip rar 7z tar gz bz2 xz password",
  },
  {
    id: "dev",
    icon: "dev",
    desc: "devDesc",
    tags: "BASE64 · HASH · JSON",
    color: "slate",
    keywords:
      "开发 编码 哈希 md5 sha256 sha512 developer base64 hash json url uuid crc sm3",
  },
  {
    id: "crypto",
    icon: "crypto",
    desc: "cryptoDesc",
    tags: "AES-256 · ENCRYPT · DECRYPT",
    color: "green",
    keywords: "加密 解密 密码 encrypt decrypt aes crypto password",
  },
];
const panels = {
  images: Images,
  media: Media,
  documents: Documents,
  svg: SvgEditor,
  archives: Archives,
  dev: Developer,
  crypto: Crypto,
};
const conversions: {
  from: string;
  to: string;
  tool: Tool;
  label: string;
  icon: IconName;
  color: string;
  preset: ConversionPreset;
}[] = [
  {
    from: "PNG",
    to: "JPG",
    tool: "images",
    label: "imageConvert",
    icon: "images",
    color: "green",
    preset: { format: "jpg" },
  },
  {
    from: "MP4",
    to: "MP3",
    tool: "media",
    label: "extractAudio",
    icon: "media",
    color: "blue",
    preset: { format: "mp3" },
  },
  {
    from: "Word",
    to: "PDF",
    tool: "documents",
    label: "wordPdf",
    icon: "documents",
    color: "sand",
    preset: { format: "pdf" },
  },
  {
    from: "JPG",
    to: "WebP",
    tool: "images",
    label: "smallerImage",
    icon: "images",
    color: "green",
    preset: { format: "webp" },
  },
  {
    from: "SVG",
    to: "PNG",
    tool: "images",
    label: "svgRaster",
    icon: "svg",
    color: "purple",
    preset: { format: "png" },
  },
  {
    from: "MOV",
    to: "MP4",
    tool: "media",
    label: "videoConvert",
    icon: "media",
    color: "blue",
    preset: { format: "mp4" },
  },
  {
    from: "WAV",
    to: "MP3",
    tool: "media",
    label: "audioConvert",
    icon: "media",
    color: "peach",
    preset: { format: "mp3" },
  },
  {
    from: "JPG",
    to: "≤ 200 KB",
    tool: "images",
    label: "targetCompress",
    icon: "settings",
    color: "green",
    preset: { format: "jpg", compress: true, targetKB: 200 },
  },
];
function Botanical() {
  return (
    <div className="botanical" aria-hidden="true">
      <svg viewBox="0 0 480 310" fill="none">
        <defs>
          <linearGradient id="petal" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#fffef6" />
            <stop offset="1" stopColor="#e6eada" />
          </linearGradient>
          <linearGradient id="leaf" x1="0" x2="1" y2="1">
            <stop stopColor="#c0d4b6" />
            <stop offset="1" stopColor="#6d9978" />
          </linearGradient>
          <linearGradient id="stem" x1="0" x2="1">
            <stop stopColor="#f8f6e9" />
            <stop offset=".6" stopColor="#e8e7d7" />
            <stop offset="1" stopColor="#c9cdbd" />
          </linearGradient>
          <filter id="shadow" x="-80%" y="-80%" width="260%" height="260%">
            <feDropShadow
              dx="2"
              dy="8"
              stdDeviation="7"
              floodColor="#365339"
              floodOpacity=".12"
            />
          </filter>
        </defs>
        <circle
          cx="267"
          cy="153"
          r="126"
          stroke="#bccbb9"
          strokeOpacity=".35"
        />
        <circle
          cx="267"
          cy="153"
          r="93"
          stroke="#bccbb9"
          strokeOpacity=".24"
          strokeDasharray="3 7"
        />
        <path
          d="M109 253c63-18 104-36 144-81"
          stroke="#76907a"
          strokeWidth="1.3"
        />
        <path
          d="M151 236c-30-1-49-17-45-35 28-3 47 7 45 35Z"
          fill="url(#leaf)"
        />
        <path
          d="M181 222c-1-32 12-54 30-54 8 29-1 47-30 54Z"
          fill="url(#leaf)"
        />
        <g className="birch-stems">
          <path d="m316 295 6-203 20-9-6 212" fill="url(#stem)" />
          <path d="m354 295-8-159 14-6 14 165" fill="url(#stem)" />
          <path
            d="m320 128 12-3m-11 28 8 1m-8 37 14-3m-14 24 6 2m-8 28 13-1m-12 28 8 2m22-105 10-2m-8 32 8 1m-7 27 12-2m-10 34 8 1m-7 29 12-2"
            stroke="#747c6d"
            strokeWidth="2.7"
            strokeLinecap="round"
          />
          <path
            d="m329 109-11-31m16 45 18-39m3 73 19-31"
            stroke="#c6c9b6"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <path
            d="M348 89c1-26 15-45 36-47-1 27-12 44-36 47Z"
            fill="url(#leaf)"
          />
          <path
            d="M321 90c-27-8-38-23-34-45 26 5 38 20 34 45Z"
            fill="url(#leaf)"
          />
          <path
            d="M373 136c3-23 16-36 35-34-2 20-12 33-35 34Z"
            fill="url(#leaf)"
          />
        </g>
        <g
          className="hero-flower"
          filter="url(#shadow)"
          transform="translate(239 139)"
        >
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a, i) => (
            <g transform={`rotate(${a})`} key={a}>
              <ellipse
                cy="-45"
                rx="23"
                ry="53"
                fill="url(#petal)"
                stroke="#fffef6"
                strokeWidth=".8"
              />
              <path
                d="M0-17v-66"
                stroke="#d8decc"
                strokeOpacity=".55"
                strokeWidth=".8"
              />
              <path
                d="m0-47 10-18M0-37l-11-17"
                stroke="#d8decc"
                strokeOpacity=".4"
                strokeWidth=".8"
              />
              {i % 2 === 0 && (
                <ellipse cy="-80" rx="8" ry="10" fill="#ffffff" opacity=".2" />
              )}
            </g>
          ))}
          <circle r="25" fill="#b1c5a0" />
          <circle r="19" fill="#9bb68a" />
          {Array.from({ length: 19 }, (_, i) => {
            const a = i * 2.4,
              r = Math.sqrt(i) * 3.8;
            return (
              <circle
                key={i}
                cx={Math.cos(a) * r}
                cy={Math.sin(a) * r}
                r="1.8"
                fill={i % 2 ? "#dce3bf" : "#6e8e61"}
              />
            );
          })}
        </g>
        <path
          d="M238 164c-2 38-18 72-42 112"
          stroke="#799676"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M221 222c-20-1-37-14-36-30 22 1 35 13 36 30Z"
          fill="url(#leaf)"
        />
        <path
          d="M215 236c4-25 17-37 35-33-4 21-16 31-35 33Z"
          fill="url(#leaf)"
        />
        <circle cx="127" cy="113" r="3" fill="#a6b99c" />
        <path d="M398 198v10m-5-5h10" stroke="#a4b79a" strokeWidth="1.3" />
        <circle cx="173" cy="54" r="3" stroke="#9bae91" />
        <path d="m287 266 3-5 3 5-3 5z" fill="#afbf9c" />
      </svg>
      <div className="floating-tag tag-one">
        <span className="format-dot green" />
        PNG
        <Icon name="arrow" size={12} />
        JPG
      </div>
      <div className="floating-tag tag-two">
        <span className="format-dot blue" />
        MP4
        <Icon name="arrow" size={12} />
        MP3
      </div>
      <div className="art-caption">a little change. naturally.</div>
    </div>
  );
}
function App() {
  const [locale, setLocale] = useState<Locale>(() => {
    try {
      const saved = localStorage.getItem("birchize-language");
      return locales.some(([c]) => c === saved) ? (saved as Locale) : "zh";
    } catch {
      return "zh";
    }
  });
  const t = (key: string) => translate(locale, key);
  const [active, setActive] = useState<Tool>(() => {
      const hash = location.hash.slice(1);
      return ["home", ...toolData.map((t) => t.id)].includes(hash)
        ? (hash as Tool)
        : "home";
    }),
    [files, setFiles] = useState<File[]>([]),
    [recent, setRecent] = useState<Result[]>([]),
    [search, setSearch] = useState(""),
    [menu, setMenu] = useState(false),
    [help, setHelp] = useState(false),
    [offline, setOffline] = useState<"loading" | "ready" | "error" | "dev">(
      import.meta.env.DEV ? "dev" : "loading",
    );
  const searchInput = useRef<HTMLInputElement>(null),
    dialog = useRef<HTMLDialogElement>(null);
  const [preset, setPreset] = useState<ConversionPreset>();
  const [fileFeedback, setFileFeedback] = useState<{ id: number; count: number }>();
  useEffect(() => {
    if (!fileFeedback) return;
    const timer = window.setTimeout(() => setFileFeedback(undefined), 5500);
    return () => window.clearTimeout(timer);
  }, [fileFeedback]);
  const updateFiles = (next: File[]) => {
    const key = (file: File) => `${file.name}:${file.size}:${file.lastModified}`;
    const previous = new Set(files.map(key));
    const count = next.filter((file) => !previous.has(key(file))).length;
    if (count > 0 || (next.length === files.length && next.length > 0))
      setFileFeedback({ id: performance.now(), count });
    setFiles(next);
  };
  const navigate = (id: Tool, nextPreset?: ConversionPreset) => {
    setActive(id);
    setPreset(nextPreset);
    setFiles([]);
    setSearch("");
    setMenu(false);
    location.hash = id;
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  useEffect(() => {
    const listener = () => {
      const hash = location.hash.slice(1);
      if (["home", ...toolData.map((t) => t.id)].includes(hash)) {
        setActive(hash as Tool);
        setMenu(false);
      }
    };
    window.addEventListener("hashchange", listener);
    return () => window.removeEventListener("hashchange", listener);
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : locale;
    try {
      localStorage.setItem("birchize-language", locale);
    } catch {}
  }, [locale]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchInput.current?.focus();
      }
      if (e.key === "Escape") {
        setSearch("");
        setMenu(false);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    if (import.meta.env.DEV) return;
    if (!("serviceWorker" in navigator)) {
      setOffline("error");
      return;
    }
    let active = true;
    const message = (e: MessageEvent) => {
      if (e.data?.type === "OFFLINE_READY" && active) setOffline("ready");
    };
    navigator.serviceWorker.addEventListener("message", message);
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .then((reg) => {
        if (reg.active && active) setOffline("ready");
        reg.addEventListener("updatefound", () => {
          reg.installing?.addEventListener("statechange", () => {
            if (reg.installing?.state === "redundant" && active)
              setOffline("error");
          });
        });
      })
      .catch(() => {
        if (active) setOffline("error");
      });
    return () => {
      active = false;
      navigator.serviceWorker.removeEventListener("message", message);
    };
  }, []);
  useEffect(() => {
    if (help) dialog.current?.showModal();
    else dialog.current?.close();
  }, [help]);
  const selected = toolData.find((tool) => tool.id === active);
  const Panel = active !== "home" ? panels[active] : undefined;
  const found = toolData.filter((tool) =>
    `${t(tool.id)} ${t(tool.desc)} ${tool.keywords}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const addResult = (r: Result) => setRecent((prev) => retainRecentResults([r, ...prev]));
  const receive = (newFiles: File[]) => {
    if (!newFiles.length) return;
    const tool = inferTool(newFiles[0]) as Tool;
    setActive(tool);
    location.hash = tool;
    setPreset(undefined);
    updateFiles(newFiles);
  };
  return (
    <I18n.Provider value={{ locale, t }}>
      <div className="app-shell">
        {menu && (
          <button
            className="sidebar-backdrop"
            aria-label={t("close")}
            onClick={() => setMenu(false)}
          />
        )}
        <aside className={`sidebar ${menu ? "is-open" : ""}`}>
          <a
            href="#home"
            className="brand"
            onClick={(e) => {
              e.preventDefault();
              navigate("home");
            }}
          >
            <span className="brand-mark">
              <Logo size={41} />
            </span>
            <span>
              <b>
                Birchize<span className="brand-period">.</span>
              </b>
              <small>YOUR LOCAL FILE STUDIO</small>
            </span>
          </a>
          <div className="nav-label">{t("workspace")}</div>
          <nav>
            <button
              className={`nav-item ${active === "home" ? "active" : ""}`}
              onClick={() => navigate("home")}
            >
              <Icon name="home" size={19} />
              <span>{t("home")}</span>
              {active === "home" && <span className="active-dot" />}
            </button>
            <div className="nav-separator" />
            <div className="nav-label tools-label">{t("allTools")}</div>
            {toolData.map((tool) => (
              <button
                key={tool.id}
                className={`nav-item ${active === tool.id ? "active" : ""}`}
                onClick={() => navigate(tool.id)}
              >
                <Icon name={tool.icon} size={19} />
                <span>{t(tool.id)}</span>
                {active === tool.id && <span className="active-dot" />}
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="privacy-card">
              <span className="privacy-card-icon">
                <Icon name="shield" size={22} />
              </span>
              <strong>{t("privacy")}</strong>
              <p>{t("local")}</p>
              <div className="privacy-card-line">
                <span className="status-dot" />
                {t("noUpload")}
                <span>·</span>
                {t("noAccount")}
              </div>
            </div>
            <button
              className="nav-item help-button"
              onClick={() => setHelp(true)}
            >
              <Icon name="help" size={18} />
              <span>{t("help")}</span>
              <Icon name="external" size={14} />
            </button>
            <div className="sidebar-credit">
              <span>
                CRAFTED BY <b>Vargking</b>
              </span>
              <span>v1.0</span>
            </div>
          </div>
        </aside>
        <div className="main-shell">
          <header className="topbar">
            <div className="breadcrumb">
              <button
                className="icon-button mobile-menu"
                aria-label="Menu"
                onClick={() => setMenu(!menu)}
              >
                <Icon name="menu" />
              </button>
              <a
                className="header-brand"
                href="#home"
                aria-label="Birchize"
                onClick={(e) => {
                  e.preventDefault();
                  navigate("home");
                }}
              >
                <Logo size={31} />
                <b>
                  Birchize<span>.</span>
                </b>
              </a>
              <span className="desktop-breadcrumb">Workspace</span>
              <Icon name="chevron" size={12} />
              <strong className="desktop-breadcrumb">{t(active)}</strong>
            </div>
            <div className="header-actions">
              <div className="search-wrap">
                <Icon name="search" size={17} />
                <input
                  ref={searchInput}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("search")}
                  aria-label={t("search")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && found[0]) navigate(found[0].id);
                  }}
                />
                <kbd>⌘ K</kbd>
                {search && (
                  <div className="search-results">
                    {found.length ? (
                      found.map((tool) => (
                        <button key={tool.id} onClick={() => navigate(tool.id)}>
                          <Icon name={tool.icon} />
                          <span>
                            {t(tool.id)}
                            <small>{tool.tags}</small>
                          </span>
                          <Icon name="arrow" size={16} />
                        </button>
                      ))
                    ) : (
                      <p>{t("noResults")}</p>
                    )}
                  </div>
                )}
              </div>
              <div className="header-divider" />
              <label className="language-select">
                <Icon name="globe" size={17} />
                <Select
                  label="Language"
                  value={locale}
                  onChange={(value) => setLocale(value as Locale)}
                  items={locales.map(([code, name]) => ({
                    value: code,
                    label: name,
                  }))}
                  compact
                />
              </label>
            </div>
          </header>
          <main>
            <div className="page-heading">
              <div>
                <div className="page-eyebrow">
                  {active === "home"
                    ? "A LITTLE ROOM FOR POSSIBILITY"
                    : "YOUR FILES. YOUR DEVICE."}
                </div>
                <h1>
                  {active === "home" ? t("greeting") : t(active)}
                  <span className="heading-dot">.</span>
                </h1>
                <p>
                  {active === "home"
                    ? t("intro")
                    : selected && t(selected.desc)}
                </p>
              </div>
              <span className="local-badge">
                <span className="status-dot" />
                {t("local")}
              </span>
            </div>
            {active === "home" ? (
              <div className="home-content">
                <section className="hero-card">
                  <div className="hero-grain" />
                  <div className="hero-content">
                    <span className="hero-eyebrow">
                      <span /> {t("heroTag")}
                    </span>
                    <h2>{t("heroTitle")}</h2>
                    <p>{t("heroDesc")}</p>
                    <button
                      className="button hero-button"
                      onClick={() =>
                        document.getElementById("tools")?.scrollIntoView({
                          behavior: "smooth",
                          block: "start",
                        })
                      }
                    >
                      {t("explore")}
                      <Icon name="arrow" size={17} />
                    </button>
                    <div className="hero-bottom">
                      <Icon name="shield" size={13} />
                      {t("noUpload")}
                      <span /> {t("noAccount")}
                      <span /> {t("offlineShort")}
                    </div>
                  </div>
                  <Botanical />
                  <span className="hero-edition">BIRCHIZE — VOL. 01</span>
                </section>
                <section className="conversions-section" id="conversions">
                  <div className="section-title">
                    <div>
                      <h2>{t("conversionTitle")}</h2>
                      <p>{t("conversionSubtitle")}</p>
                    </div>
                    <span className="section-index">
                      PICK A FORMAT. MAKE A CHANGE.
                      <Icon name="arrow" size={16} />
                    </span>
                  </div>
                  <div className="conversions-grid">
                    {conversions.map((item, i) => (
                      <button
                        className="conversion-card"
                        key={i}
                        onClick={() => navigate(item.tool, item.preset)}
                      >
                        <span
                          className={`conversion-icon tool-icon ${item.color}`}
                        >
                          <Icon name={item.icon} size={18} />
                        </span>
                        <span className="conversion-copy">
                          <strong>
                            {item.from}
                            <Icon name="arrow" size={14} />
                            <span>{item.to}</span>
                          </strong>
                          <small>{t(item.label)}</small>
                        </span>
                        <Icon name="chevron" size={12} />
                      </button>
                    ))}
                  </div>
                </section>
                <Dropzone onFiles={receive} />
                <section id="tools" className="tools-section">
                  <div className="section-title">
                    <div>
                      <h2>{t("toolsTitle")}</h2>
                      <p>{t("toolCount")}</p>
                    </div>
                    <span className="section-index">
                      THE EVERYDAY COLLECTION <Icon name="sparkles" size={16} />
                    </span>
                  </div>
                  <div className="tools-grid">
                    {toolData.slice(0, 6).map((tool, i) => (
                      <button
                        key={tool.id}
                        className={`tool-card ${tool.color}`}
                        style={{ animationDelay: `${i * 45}ms` }}
                        onClick={() => navigate(tool.id)}
                      >
                        <div className="tool-card-top">
                          <span className={`tool-icon ${tool.color}`}>
                            <Icon name={tool.icon} size={24} />
                          </span>
                          {i === 0 ? (
                            <span className="popular-badge">
                              {t("popular")}
                              <span />
                            </span>
                          ) : (
                            <span className="tool-number">0{i + 1}</span>
                          )}
                        </div>
                        <h3>{t(tool.id)}</h3>
                        <p>{t(tool.desc)}</p>
                        <div className="tool-card-bottom">
                          <span>{tool.tags}</span>
                          <span className="tool-arrow">
                            <Icon name="arrow" size={17} />
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                  <button
                    className="encryption-strip"
                    onClick={() => navigate("crypto")}
                  >
                    <span className="encryption-strip-icon">
                      <Icon name="crypto" size={21} />
                    </span>
                    <span>
                      <strong>{t("crypto")}</strong>
                      <small>{t("cryptoDesc")}</small>
                    </span>
                    <span className="encryption-standard">
                      AES-256 <Icon name="shield" size={14} />
                    </span>
                    <Icon name="arrow" size={18} />
                  </button>
                </section>
                <section className="recent-section">
                  <div className="section-title">
                    <h2>
                      <Icon name="clock" size={19} />
                      {t("recent")}
                    </h2>
                    {recent.length > 0 && (
                      <button
                        className="text-button"
                        onClick={() => setRecent([])}
                      >
                        {t("clear")}
                      </button>
                    )}
                  </div>
                  {recent.length ? (
                    <div className="recent-batches">
                      {groupResults(recent).map((group) => (
                        <section className="recent-batch" key={group.id}>
                          <div className="recent-batch-heading">
                            <span>{t("batch")} · {group.results.length} {t("batchOutputs")}</span>
                            {group.startedAt && <time dateTime={new Date(group.startedAt).toISOString()}>{new Date(group.startedAt).toLocaleString(locale === "zh" ? "zh-CN" : locale)}</time>}
                          </div>
                          <div className="recent-list">
                      {group.results.map((r, i) => (
                        <button
                          key={i}
                          onClick={() => download(r.blob, r.name)}
                        >
                          <span className="recent-file-icon">
                            <Icon name="file" size={18} />
                          </span>
                          <span>
                            <strong>{r.name}</strong>
                            <small>
                              {formatSize(r.blob.size)} · {t("complete")}
                            </small>
                          </span>
                          <Icon name="download" size={17} />
                        </button>
                      ))}
                          </div>
                        </section>
                      ))}
                    </div>
                  ) : (
                    <div className="recent-empty">
                      <span className="empty-flower">
                        <Logo size={28} />
                      </span>
                      <p>{t("recentEmpty")}</p>
                    </div>
                  )}
                </section>
              </div>
            ) : (
              <div
                className="tool-workspace"
                key={`${active}-${preset?.format}-${preset?.compress}`}
              >
                <div className="tool-topline">
                  <span>{selected?.tags}</span>
                  <span>
                    <Icon name="shield" size={14} />
                    100% LOCAL
                  </span>
                </div>
                <Suspense
                  fallback={
                    <div className="panel-loading">
                      <span className="spinner" />
                      {t("processing")}
                    </div>
                  }
                >
                  {Panel && (
                    <Panel
                      files={files}
                      setFiles={updateFiles}
                      onResult={addResult}
                      preset={preset}
                    />
                  )}
                </Suspense>
              </div>
            )}
            <footer className="footer">
              <span>
                <Icon name="leaf" size={15} />
                {t("footer")}
              </span>
              <span>
                Made with care by <b>Vargking</b>
                <span className="footer-dot">·</span>
                <button
                  className={`offline-label ${offline === "error" ? "cache-error" : ""}`}
                  onClick={() => setHelp(true)}
                >
                  <span className="status-dot" />
                  {t(
                    offline === "ready"
                      ? "offline"
                      : offline === "loading"
                        ? "caching"
                        : offline === "error"
                          ? "cacheError"
                          : "local",
                  )}
                </button>
              </span>
            </footer>
          </main>
        </div>
        <dialog
          ref={dialog}
          onCancel={() => setHelp(false)}
          onClick={(e) => {
            if (e.target === e.currentTarget) setHelp(false);
          }}
          className="about-dialog"
        >
          <div className="dialog-heading">
            <div className="dialog-brand">
              <Logo size={40} />
              <span>Birchize.</span>
            </div>
            <button
              className="icon-button"
              aria-label={t("close")}
              onClick={() => setHelp(false)}
            >
              <Icon name="close" />
            </button>
          </div>
          <h2>{t("studio")}</h2>
          <p>{t("footer")}</p>
          <div className="about-grid">
            {toolData.map((tool) => (
              <div key={tool.id}>
                <Icon name={tool.icon} size={18} />
                <strong>{t(tool.id)}</strong>
                <span>{tool.tags}</span>
              </div>
            ))}
          </div>
          <div className="about-notes">
            <p>{t("imageNote")}</p>
            <p>{t("mediaNote")}</p>
            <p>{t("docNote")}</p>
            <p>{t("archiveNote")}</p>
            <p>{t("cryptoNote")}</p>
            <p>{t("svgNote")}</p>
          </div>
          <div className="about-offline">
            <Icon name="shield" size={20} />
            <p>
              {t(
                offline === "ready"
                  ? "offline"
                  : offline === "error"
                    ? "cacheError"
                    : offline === "dev"
                      ? "local"
                      : "caching",
              )}
            </p>
            {offline === "error" && (
              <button
                className="button small"
                onClick={() => location.reload()}
              >
                Retry
              </button>
            )}
          </div>
          <div className="dialog-credit">
            Birchize v1.0 · Designed & developed by Vargking
          </div>
        </dialog>
        <Tutorial />
        {fileFeedback && (
          <div className="file-success-toast" key={fileFeedback.id} role="status" aria-live="polite" aria-atomic="true">
            <span className="toast-check"><Icon name="check" size={19} /></span>
            <div>
              <strong>{t(fileFeedback.count ? "filesAdded" : "filesAlreadyAdded")}{fileFeedback.count > 0 && ` · ${fileFeedback.count}`}</strong>
              <span>{t("filesLocalHint")}</span>
            </div>
            <button className="icon-button" aria-label={t("close")} onClick={() => setFileFeedback(undefined)}><Icon name="close" size={16} /></button>
          </div>
        )}
      </div>
    </I18n.Provider>
  );
}
export default App;
