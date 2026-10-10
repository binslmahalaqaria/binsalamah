"use client";

/** Small shared building blocks for the sales CRM screens. */
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Tone } from "@/lib/crm/constants";
import { nz, telLink, waLink } from "@/lib/crm/util";

const IC: Record<string, string> = {
  today: "M4 6h16v14H4zM4 10h16M9 3v4M15 3v4",
  requests: "M4 4h16v12h-5l-3 4-3-4H4zM8 9h8M8 12h5",
  clients: "M9 4.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7ZM2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c2 .7 3.2 2.4 3.6 5.2",
  props: "M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6",
  sales: "M4 19V5M4 19h16M7 15l4-4 3 3 5-6",
  chat: "M4 5h16v11H9l-5 4z",
  team: "M12 4.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7ZM5 20c.9-3.5 3.6-5.3 7-5.3s6.1 1.8 7 5.3",
  web: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM3 12h18M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3Z",
  leads: "M4 4h16v16H4zM4 9h16M9 13h6",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  wa: "M4.5 19.5l1.2-3.6A7.5 7.5 0 1 1 8.4 18.6zM9.2 9.3c.3 1.9 1.6 3.4 3.6 4.1l1-1 1.7.8-.3 1.3c-3.2.3-6.2-2.6-6-5.9l1.3-.3.8 1.7z",
  phone: "M6.5 3.5h3l1.5 4-2 1.3a10.5 10.5 0 0 0 5.2 5.2l1.3-2 4 1.5v3a2 2 0 0 1-2 2A15.5 15.5 0 0 1 4.5 5.5a2 2 0 0 1 2-2z",
  close: "M6 6l12 12M18 6L6 18",
  chevL: "M14.5 6l-6 6 6 6",
  chevR: "M9.5 6l6 6-6 6",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  plus: "M12 5v14M5 12h14",
};

export function Icon({ k, size = 20, className }: { k: string; size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={k === "more" ? 3 : 1.7}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d={IC[k] || ""} />
    </svg>
  );
}

export function Pill({ tone, children }: { tone?: Tone; children?: ReactNode }) {
  if (children == null || children === "") return null;
  return <span className={"crm-pill tone-" + (tone || "muted")}>{children}</span>;
}

export function Chip({ children, cls }: { children: ReactNode; cls?: string }) {
  return <span className={"crm-chip " + (cls || "")}>{children}</span>;
}

export function Empty({ children, big }: { children: ReactNode; big?: boolean }) {
  return <div className={"crm-empty" + (big ? " py-10 text-[15px]" : "")}>{children}</div>;
}

export function ContactIcons({ phone, text }: { phone?: string | null; text?: string }) {
  if (!phone) return null;
  const wa = waLink(phone, text),
    tel = telLink(phone);
  return (
    <>
      {wa && (
        <a className="crm-btn sm icon wa" href={wa} target="_blank" rel="noopener" title="واتساب" aria-label="واتساب" onClick={(e) => e.stopPropagation()}>
          <Icon k="wa" size={18} />
        </a>
      )}
      {tel && (
        <a className="crm-btn sm icon" href={tel} title="اتصال" aria-label="اتصال" onClick={(e) => e.stopPropagation()}>
          <Icon k="phone" size={18} />
        </a>
      )}
    </>
  );
}

export interface KebabItem {
  label: string;
  onClick?: () => void;
  href?: string;
}

/** "⋯" menu that positions itself in the viewport (fixed) so it never gets clipped by scroll containers. */
export function Kebab({ items }: { items: (KebabItem | null | false | undefined)[] }) {
  const list = items.filter(Boolean) as KebabItem[];
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!pos) return;
    const close = (e: Event) => {
      if (menu.current?.contains(e.target as Node) || btn.current?.contains(e.target as Node)) return;
      setPos(null);
    };
    const shut = () => setPos(null);
    document.addEventListener("mousedown", close);
    window.addEventListener("scroll", shut, true);
    window.addEventListener("resize", shut);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("scroll", shut, true);
      window.removeEventListener("resize", shut);
    };
  }, [pos]);
  useEffect(() => {
    if (!pos || !menu.current) return;
    const r = btn.current!.getBoundingClientRect();
    const w = menu.current.offsetWidth,
      h = menu.current.offsetHeight;
    let left = r.left;
    if (left + w > innerWidth - 8) left = innerWidth - w - 8;
    if (left < 8) left = 8;
    let top = r.bottom + 4;
    if (top + h > innerHeight - 8) top = Math.max(8, r.top - h - 4);
    if (left !== pos.left || top !== pos.top) setPos({ left, top });
  }, [pos]);
  if (!list.length) return null;
  return (
    <>
      <button ref={btn} type="button" className="crm-btn sm icon" aria-haspopup="menu" aria-label="خيارات أكثر" title="خيارات أكثر"
        onClick={(e) => {
          e.stopPropagation();
          if (pos) return setPos(null);
          const r = e.currentTarget.getBoundingClientRect();
          setPos({ left: r.left, top: r.bottom + 4 });
        }}>
        <Icon k="more" size={18} />
      </button>
      {pos && (
        <div ref={menu} className="crm-kebab" role="menu" style={{ left: pos.left, top: pos.top }}>
          {list.map((it, i) =>
            it.href ? (
              <a key={i} role="menuitem" href={it.href} target="_blank" rel="noopener" onClick={() => setPos(null)}>{it.label}</a>
            ) : (
              <button key={i} type="button" role="menuitem" onClick={(e) => { e.stopPropagation(); setPos(null); it.onClick?.(); }}>
                {it.label}
              </button>
            )
          )}
        </div>
      )}
    </>
  );
}

export function ModalFrame({ title, onClose, children, width, footer }: {
  title: ReactNode; onClose: () => void; children: ReactNode; width?: number; footer?: ReactNode;
}) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="crm-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="crm-modal" role="dialog" aria-modal="true" dir="rtl" style={width ? { maxWidth: width } : undefined}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg">{title}</h2>
          <button type="button" className="crm-btn ghost icon" aria-label="إغلاق" onClick={onClose}><Icon k="close" size={18} /></button>
        </div>
        {children}
        {footer && <div className="mt-4 flex flex-wrap items-center justify-between gap-2">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, children, full, hint }: { label?: ReactNode; children: ReactNode; full?: boolean; hint?: ReactNode }) {
  return (
    <div className={"crm-field" + (full ? " sm:col-span-2" : "")}>
      {label && <label>{label}</label>}
      {children}
      {hint && <span className="crm-hint">{hint}</span>}
    </div>
  );
}

export const Sec = ({ children }: { children: ReactNode }) => <div className="crm-sec sm:col-span-2">{children}</div>;

export function More({ title, open, children }: { title: string; open?: boolean; children: ReactNode }) {
  return (
    <details className="crm-more sm:col-span-2" open={open}>
      <summary>{title}</summary>
      <div className="grid gap-3 pb-3 sm:grid-cols-2">{children}</div>
    </details>
  );
}

export function Select({ value, onChange, options, blank, className, disabled, ariaLabel }: {
  value: string | null | undefined; onChange: (v: string) => void; options: readonly (string | [string, string])[];
  blank?: string; className?: string; disabled?: boolean; ariaLabel?: string;
}) {
  return (
    <select className={className} value={value || ""} disabled={disabled} aria-label={ariaLabel} onChange={(e) => onChange(e.target.value)}>
      {blank != null && <option value="">{blank}</option>}
      {options.map((o) => {
        const [v, l] = Array.isArray(o) ? o : [o, o];
        return <option key={v} value={v}>{l}</option>;
      })}
    </select>
  );
}

export function MultiCheck({ options, value, onChange }: { options: readonly string[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <label key={o} className="crm-check">
          <input type="checkbox" checked={value.includes(o)} onChange={(e) => onChange(e.target.checked ? [...value, o] : value.filter((x) => x !== o))} />
          <span>{o}</span>
        </label>
      ))}
    </div>
  );
}

export function RadioChips({ options, value, onChange }: { options: readonly (string | [string, string])[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const [v, l] = Array.isArray(o) ? o : [o, o];
        return (
          <label key={v} className="crm-check">
            <input type="radio" checked={value === v} onChange={() => onChange(v)} />
            <span>{l}</span>
          </label>
        );
      })}
    </div>
  );
}

/** Searchable multi-district picker with "add new" for districts not in the list. */
export function DistrictPicker({ all, value, onChange }: { all: string[]; value: string[]; onChange: (v: string[]) => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const nq = nz(q.trim());
  const opts = all.filter((d) => !value.includes(d) && (!nq || nz(d).includes(nq))).slice(0, 40);
  const exact = q.trim() && all.includes(q.trim());
  const add = (d: string) => {
    if (d && !value.includes(d)) onChange([...value, d]);
    setQ("");
  };
  return (
    <div className="grid gap-1.5" onFocus={() => setOpen(true)} onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setOpen(false)}>
      <div className="flex min-h-7 flex-wrap items-center gap-1.5">
        {value.length ? (
          value.map((d) => (
            <span key={d} className="inline-flex items-center gap-1 rounded-full bg-[#ece9e4] py-0.5 ps-2.5 pe-1 text-[13.5px] font-semibold">
              {d}
              <button type="button" className="rounded-full px-1.5 hover:bg-[var(--crm-ink)] hover:text-white" aria-label={"إزالة " + d}
                onClick={() => onChange(value.filter((x) => x !== d))}>×</button>
            </span>
          ))
        ) : (
          <span className="crm-hint">ما اخترت أحياء</span>
        )}
      </div>
      <input className="crm-input" placeholder="ابحث عن حي واضغط عليه…" value={q} autoComplete="off" onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add(opts[0] || q.trim());
          }
        }} />
      {open && (
        <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto rounded-lg border border-[var(--crm-line)] bg-[var(--crm-surface-2)] p-2">
          {opts.map((d) => (
            <button key={d} type="button" className="rounded-full border border-[var(--crm-line)] bg-white px-3 py-1 text-[13.5px] hover:border-[var(--crm-gold)]"
              onMouseDown={(e) => e.preventDefault()} onClick={() => add(d)}>{d}</button>
          ))}
          {q.trim() && !exact && !value.includes(q.trim()) && (
            <button type="button" className="rounded-full border border-dashed border-[var(--crm-gold)] bg-white px-3 py-1 text-[13.5px]"
              onMouseDown={(e) => e.preventDefault()} onClick={() => add(q.trim())}>+ أضف «{q.trim()}»</button>
          )}
          {!opts.length && !q && <span className="crm-hint">اكتب اسم الحي</span>}
        </div>
      )}
    </div>
  );
}

/** Button that needs a second click to confirm (used for deletes). */
export function ConfirmButton({ onConfirm, children, className }: { onConfirm: () => void; children: ReactNode; className?: string }) {
  const [armed, setArmed] = useState(false);
  return (
    <button type="button" className={"crm-btn danger " + (armed ? "armed " : "") + (className || "")}
      onClick={() => (armed ? onConfirm() : setArmed(true))}>
      {armed ? "اضغط مرة ثانية للتأكيد" : children}
    </button>
  );
}

export function PageHeader({ eyebrow, title, sub, action }: { eyebrow?: string; title: string; sub?: string; action?: ReactNode }) {
  return (
    <header className="mb-5 flex flex-wrap items-end gap-3 border-b border-[var(--crm-line)] pb-4">
      <div className="min-w-0 flex-1">
        {eyebrow && <span className="mb-1 block text-[11.5px] font-semibold tracking-wide text-[var(--crm-gold-ink)]">{eyebrow}</span>}
        <h1 className="text-2xl md:text-[28px]">{title}</h1>
        {sub && <p className="mt-1 hidden text-[13.5px] text-[var(--crm-ink-3)] md:block">{sub}</p>}
      </div>
      {action}
    </header>
  );
}
