import DOMPurify from "dompurify";
export function cleanSvg(source: string) {
  if (source.length > 5_000_000)
    throw new Error("SVG exceeds the 5 MB editor limit.");
  const parsed = new DOMParser().parseFromString(source, "image/svg+xml");
  if (
    parsed.querySelector("parsererror") ||
    parsed.documentElement.localName !== "svg"
  )
    throw new Error("Invalid SVG · Check XML syntax and the <svg> root.");
  const clean = DOMPurify.sanitize(source, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: ["style", "foreignObject", "image", "animate", "set"],
    FORBID_ATTR: ["style"],
  });
  const doc = new DOMParser().parseFromString(clean, "image/svg+xml");
  doc.querySelectorAll("*").forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      if (
        (/href$/i.test(attr.name) && !attr.value.startsWith("#")) ||
        /url\(\s*['"]?(?!#)/i.test(attr.value)
      )
        el.removeAttribute(attr.name);
    }
  });
  return new XMLSerializer().serializeToString(doc.documentElement);
}
export const starterSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 420" width="600" height="420">
  <rect width="600" height="420" rx="24" fill="#f0f5ed"/>
  <g transform="translate(300 185)" fill="#7caa85">
    <ellipse cy="-52" rx="29" ry="61"/>
    <ellipse cy="-52" rx="29" ry="61" transform="rotate(60)"/>
    <ellipse cy="-52" rx="29" ry="61" transform="rotate(120)"/>
    <ellipse cy="-52" rx="29" ry="61" transform="rotate(180)"/>
    <ellipse cy="-52" rx="29" ry="61" transform="rotate(240)"/>
    <ellipse cy="-52" rx="29" ry="61" transform="rotate(300)"/>
  </g>
  <path d="M292 177h16v142h-16z" fill="#f0f5ed"/>
  <path d="M294 217h13m-15 26h9m-6 28h12m-15 25h9" stroke="#315c47" stroke-width="3"/>
  <circle cx="300" cy="179" r="13" fill="#315c47"/>
  <text x="300" y="368" text-anchor="middle" font-family="system-ui,sans-serif" font-size="28" letter-spacing="3" fill="#315c47">birchize</text>
</svg>`;
