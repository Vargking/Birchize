import type { CSSProperties } from "react";
export type IconName =
  | "home"
  | "images"
  | "media"
  | "documents"
  | "svg"
  | "archives"
  | "dev"
  | "crypto"
  | "arrow"
  | "upload"
  | "download"
  | "search"
  | "check"
  | "chevron"
  | "globe"
  | "shield"
  | "sparkles"
  | "plus"
  | "close"
  | "help"
  | "clock"
  | "menu"
  | "trash"
  | "copy"
  | "file"
  | "leaf"
  | "settings"
  | "undo"
  | "redo"
  | "pen"
  | "rect"
  | "ellipse"
  | "line"
  | "external"
  | "folder";
const paths: Record<IconName, React.ReactNode> = {
  home: (
    <>
      <rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1.8" />
      <rect x="14" y="3.5" width="6.5" height="6.5" rx="1.8" />
      <rect x="3.5" y="14" width="6.5" height="6.5" rx="1.8" />
      <rect x="14" y="14" width="6.5" height="6.5" rx="1.8" />
    </>
  ),
  images: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <circle cx="8.5" cy="9" r="1.5" />
      <path d="m4 17 5-5 4 4 3-3 5 5" />
    </>
  ),
  media: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <path d="m10 8 6 4-6 4z" />
    </>
  ),
  documents: (
    <>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M14 3v6h6M8 13h8m-8 4h5" />
    </>
  ),
  svg: (
    <>
      <path d="m12 3 8 6-8 12L4 9zM4 9h16M12 3v18" />
      <circle cx="12" cy="9" r="2" fill="currentColor" stroke="none" />
    </>
  ),
  archives: (
    <>
      <path d="M3 8h18v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <rect x="2" y="3" width="20" height="5" rx="1.5" />
      <path d="M9 12h6m-6 4h6" />
    </>
  ),
  dev: (
    <>
      <path d="m8 6-6 6 6 6m8-12 6 6-6 6M14 4l-4 16" />
    </>
  ),
  crypto: (
    <>
      <rect x="5" y="10" width="14" height="11" rx="2.5" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2" />
    </>
  ),
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  upload: (
    <>
      <path d="M12 16V3m-5 5 5-5 5 5M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v13m-5-5 5 5 5-5M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 5 5" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  chevron: <path d="m8 5 7 7-7 7" />,
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <ellipse cx="12" cy="12" rx="4" ry="9" />
      <path d="M3 12h18" />
    </>
  ),
  shield: (
    <>
      <path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z" />
      <path d="m8 11 3 3 5-5" />
    </>
  ),
  sparkles: (
    <>
      <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5zM20 2v4m-2-2h4" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9a2.5 2.5 0 1 1 4 2c-1.5 1-1.5 1.5-1.5 2.5M12 17h.01" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  trash: (
    <>
      <path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7" />
    </>
  ),
  copy: (
    <>
      <rect x="8" y="8" width="13" height="13" rx="2" />
      <path d="M16 8V3H3v13h5" />
    </>
  ),
  file: (
    <>
      <path d="M14 3H5v18h14V8zM14 3v5h5" />
    </>
  ),
  leaf: (
    <>
      <path d="M20 3C5 3 2 9 5 15c6 8 16 2 15-12Z" />
      <path d="M3 21 15 9" />
    </>
  ),
  settings: (
    <>
      <path d="M4 7h16M4 17h16" />
      <circle cx="9" cy="7" r="3" />
      <circle cx="16" cy="17" r="3" />
    </>
  ),
  undo: (
    <>
      <path d="M8 4 3 9l5 5M3 9h11a7 7 0 0 1 7 7v3" />
    </>
  ),
  redo: (
    <>
      <path d="m16 4 5 5-5 5m5-5H10a7 7 0 0 0-7 7v3" />
    </>
  ),
  pen: (
    <>
      <path d="m4 16-1 5 5-1L21 7l-4-4zM14 6l4 4" />
    </>
  ),
  rect: <rect x="4" y="5" width="16" height="14" rx="1" />,
  ellipse: <ellipse cx="12" cy="12" rx="9" ry="7" />,
  line: <path d="m4 20 16-16" />,
  external: (
    <>
      <path d="M14 3h7v7m0-7L10 14M10 3H3v18h18v-7" />
    </>
  ),
  folder: <path d="M3 7V4h7l2 3h9v14H3z" />,
};
export function Icon({
  name,
  size = 20,
  className = "",
  style,
}: {
  name: IconName;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      style={style}
    >
      {paths[name]}
    </svg>
  );
}
export function Logo({ size = 38 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
    >
      <rect width="64" height="64" rx="17" fill="#557348" />
      <g fill="#f0f3e4" transform="translate(32 28)">
        {[0, 60, 120, 180, 240, 300].map((a) => (
          <ellipse
            key={a}
            cy="-9"
            rx="5.2"
            ry="10.8"
            transform={`rotate(${a})`}
          />
        ))}
      </g>
      <path d="M29.5 30h5v22h-5z" fill="#f0f3e4" />
      <path d="M29.5 37h3m-1 6h3m-5 5h2.5" stroke="#557348" strokeWidth="1.5" />
      <circle cx="32" cy="27" r="3.5" fill="#557348" />
    </svg>
  );
}
