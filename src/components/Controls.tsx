import { useEffect, useId, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, PointerEvent } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icons";
import { useI18n } from "../i18n";

function usePopover(width?: number) {
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<CSSProperties>({});
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const place = () => {
      const box = trigger.current?.getBoundingClientRect();
      if (!box) return;
      const w = Math.min(
        width || Math.max(190, box.width),
        window.innerWidth - 24,
      );
      const below = window.innerHeight - box.bottom - 18;
      const above = box.top - 18;
      const upwards = below < 220 && above > below;
      setStyle({
        width: w,
        left: Math.max(12, Math.min(box.left, window.innerWidth - w - 12)),
        ...(upwards
          ? { bottom: window.innerHeight - box.top + 7 }
          : { top: box.bottom + 7 }),
        maxHeight: Math.max(100, Math.min(upwards ? above : below, 340)),
      });
    };
    place();
    const outside = (e: globalThis.PointerEvent) => {
      if (
        !trigger.current?.contains(e.target as Node) &&
        !panel.current?.contains(e.target as Node)
      )
        setOpen(false);
    };
    const escape = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
        trigger.current?.focus();
      }
    };
    const scroll = (e: Event) => {
      if (!panel.current?.contains(e.target as Node)) place();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", scroll, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", scroll, true);
    };
  }, [open, width]);
  return { open, setOpen, style, trigger, panel };
}

export type SelectItem = {
  value: string | number;
  label: string;
  group?: string;
};
export function Select({
  value,
  onChange,
  items,
  label,
  disabled = false,
  compact = false,
}: {
  value: string | number;
  onChange: (value: string) => void;
  items: SelectItem[];
  label: string;
  disabled?: boolean;
  compact?: boolean;
}) {
  const p = usePopover();
  const id = useId();
  const selected = Math.max(
    0,
    items.findIndex((o) => String(o.value) === String(value)),
  );
  const [highlight, setHighlight] = useState(selected);
  const search = useRef({ value: "", at: 0 });
  useEffect(() => {
    if (disabled) p.setOpen(false);
  }, [disabled]);
  useEffect(() => {
    if (p.open)
      p.panel.current
        ?.querySelector(`#${CSS.escape(id + "-" + highlight)}`)
        ?.scrollIntoView({ block: "nearest" });
  }, [highlight, p.open]);
  const choose = (i: number) => {
    onChange(String(items[i].value));
    p.setOpen(false);
    p.trigger.current?.focus();
  };
  const key = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
      e.preventDefault();
      p.setOpen(true);
      setHighlight(
        e.key === "Home"
          ? 0
          : e.key === "End"
            ? items.length - 1
            : Math.max(
                0,
                Math.min(
                  items.length - 1,
                  (p.open ? highlight : selected) +
                    (e.key === "ArrowDown" ? 1 : -1),
                ),
              ),
      );
    } else if ((e.key === "Enter" || e.key === " ") && p.open) {
      e.preventDefault();
      choose(highlight);
    } else if (e.key === "Tab") p.setOpen(false);
    else if (e.key.length === 1 && e.key !== " ") {
      const now = Date.now();
      search.current = {
        value:
          (now - search.current.at < 700 ? search.current.value : "") +
          e.key.toLowerCase(),
        at: now,
      };
      const match = items.findIndex((o) =>
        o.label.toLowerCase().startsWith(search.current.value),
      );
      if (match >= 0) {
        p.setOpen(true);
        setHighlight(match);
      }
    }
  };
  return (
    <>
      <button
        ref={p.trigger}
        type="button"
        role="combobox"
        aria-label={label}
        aria-expanded={p.open}
        aria-haspopup="listbox"
        aria-controls={p.open ? id : undefined}
        aria-activedescendant={p.open ? `${id}-${highlight}` : undefined}
        disabled={disabled}
        className={`select-control ${compact ? "compact-control" : ""} ${p.open ? "control-open" : ""}`}
        onKeyDown={key}
        onClick={() => {
          setHighlight(selected);
          p.setOpen(!p.open);
        }}
      >
        <span>{items[selected]?.label}</span>
        <Icon name="chevron" size={14} />
      </button>
      {p.open &&
        createPortal(
          <div
            ref={p.panel}
            id={id}
            role="listbox"
            aria-label={label}
            className="control-popover select-options"
            style={p.style}
          >
            {items.map((item, i) => (
              <div key={item.value}>
                {item.group && item.group !== items[i - 1]?.group && (
                  <div className="select-group">{item.group}</div>
                )}
                <button
                  id={`${id}-${i}`}
                  type="button"
                  role="option"
                  aria-selected={selected === i}
                  tabIndex={-1}
                  className={`select-option ${highlight === i ? "highlighted" : ""}`}
                  onPointerMove={() => setHighlight(i)}
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => choose(i)}
                >
                  <span>{item.label}</span>
                  {selected === i && <Icon name="check" size={15} />}
                </button>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}

function hsv(hex: string) {
  const values = hex
    .match(/[a-f\d]{2}/gi)
    ?.map((n) => parseInt(n, 16) / 255) || [0, 0, 0];
  const [r, g, b] = values,
    max = Math.max(...values),
    min = Math.min(...values),
    d = max - min;
  const h = !d
    ? 0
    : max === r
      ? ((g - b) / d + 6) % 6
      : max === g
        ? (b - r) / d + 2
        : (r - g) / d + 4;
  return { h: h * 60, s: max ? d / max : 0, v: max };
}
function hex(h: number, s: number, v: number) {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return Math.round((v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(5)}${f(3)}${f(1)}`;
}
const swatches = [
  "#315c47",
  "#557348",
  "#8fa879",
  "#c5d5b4",
  "#f0f3e4",
  "#ffffff",
  "#34465b",
  "#7296b2",
  "#9b8bb0",
  "#c69488",
  "#c7ad7e",
  "#27392e",
];
export function ColorPicker({
  value,
  onChange,
  label,
  compact = false,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const p = usePopover(264);
  const id = useId();
  const parsed = hsv(value);
  const [hue, setHue] = useState(parsed.h);
  const [entry, setEntry] = useState(value);
  const h = parsed.s > 0 ? parsed.h : hue;
  useEffect(() => setEntry(value), [value]);
  const adjust = (e: PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    onChange(
      hex(
        h,
        Math.min(1, Math.max(0, (e.clientX - box.left) / box.width)),
        Math.min(1, Math.max(0, 1 - (e.clientY - box.top) / box.height)),
      ),
    );
  };
  return (
    <>
      <button
        ref={p.trigger}
        type="button"
        className={`color-control ${compact ? "compact-color" : ""}`}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={p.open}
        aria-controls={p.open ? id : undefined}
        onClick={() => p.setOpen(!p.open)}
      >
        <span className="color-chip" style={{ background: value }} />
        {!compact && <span>{value.toUpperCase()}</span>}
        <Icon name="chevron" size={13} />
      </button>
      {p.open &&
        createPortal(
          <div
            ref={p.panel}
            id={id}
            role="dialog"
            aria-label={label}
            className="control-popover color-popover"
            style={p.style}
          >
            <div className="color-popover-heading">
              <span>{label}</span>
              <button
                type="button"
                className="icon-button"
                aria-label={t("close")}
                onClick={() => {
                  p.setOpen(false);
                  p.trigger.current?.focus();
                }}
              >
                <Icon name="close" size={15} />
              </button>
            </div>
            <div
              className="color-plane"
              style={{ backgroundColor: `hsl(${h} 100% 50%)` }}
              aria-hidden="true"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                adjust(e);
              }}
              onPointerMove={(e) => {
                if (e.buttons) adjust(e);
              }}
            >
              <span
                className="color-cursor"
                style={{
                  left: `${parsed.s * 100}%`,
                  top: `${(1 - parsed.v) * 100}%`,
                  background: value,
                }}
              />
            </div>
            <input
              className="hue-slider"
              type="range"
              min={0}
              max={359}
              step={1}
              value={h}
              aria-label={t("hue")}
              onChange={(e) => {
                const next = +e.target.value;
                setHue(next);
                onChange(hex(next, parsed.s, parsed.v));
              }}
            />
            <div className="color-swatches">
              {swatches.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={color.toUpperCase()}
                  aria-pressed={color === value.toLowerCase()}
                  style={{ background: color }}
                  onClick={() => onChange(color)}
                >
                  {color === value.toLowerCase() && (
                    <Icon
                      name="check"
                      size={13}
                      style={{
                        color: hsv(color).v > 0.8 ? "#31553e" : "#ffffff",
                      }}
                    />
                  )}
                </button>
              ))}
            </div>
            <div className="color-hex-row">
              <span className="color-chip" style={{ background: value }} />
              <label>
                <span>HEX</span>
                <input
                  aria-label="HEX"
                  value={entry.toUpperCase()}
                  maxLength={7}
                  spellCheck={false}
                  onChange={(e) => {
                    const next = e.target.value;
                    setEntry(next);
                    if (/^#[a-f\d]{6}$/i.test(next))
                      onChange(next.toLowerCase());
                  }}
                  onBlur={() => setEntry(value)}
                />
              </label>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
