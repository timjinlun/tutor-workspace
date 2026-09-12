/** 设计系统组件。无业务、不 import store。 */
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes } from "react";

/* ---------- Button ---------- */
type BtnVariant = "primary" | "secondary" | "ghost" | "danger";
export function Button({
  variant = "secondary",
  size,
  solid,
  icon,
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: "sm" | "lg"; solid?: boolean; icon?: ReactNode }) {
  return (
    <button type="button" className={`btn ${variant} ${size ?? ""} ${solid ? "solid" : ""} ${!children ? "icon" : ""} ${className}`} {...rest}>
      {icon}
      {children}
    </button>
  );
}

/* ---------- Field ---------- */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  );
}
export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="input" {...props} />;
}
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className="select" {...props} />;
}
export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="segmented" role="radiogroup">
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={o.value === value} className={o.value === value ? "on" : ""} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- MonthPicker：上月 / 下月，中文显示 ---------- */
export function MonthPicker({ value, onChange, max }: { value: string; onChange: (ym: string) => void; max?: string }) {
  const shift = (d: number) => {
    const [y, m] = value.split("-").map(Number);
    const dt = new Date(y ?? 2026, (m ?? 1) - 1 + d, 1);
    onChange(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`);
  };
  return (
    <div className="month-nav">
      <button type="button" onClick={() => shift(-1)} aria-label="上个月"><ChevronLeft size={16} /></button>
      <span className="num">{value.slice(0, 4)} 年 {Number(value.slice(5))} 月</span>
      <button type="button" onClick={() => shift(1)} aria-label="下个月" disabled={!!max && value >= max}><ChevronRight size={16} /></button>
    </div>
  );
}

/* ---------- Chip / Avatar ---------- */
export function Chip({ tone, children }: { tone?: "accent" | "green" | "orange" | "red"; children: ReactNode }) {
  return <span className={`chip ${tone ?? ""}`}>{children}</span>;
}

const AVATAR_COLORS = ["#ff6b4a", "#4f6bff", "#30b0c7", "#af52de", "#ff9f0a", "#34c759", "#ff2d55", "#5e5ce6"];
export function Avatar({ name, size }: { name: string; size?: "sm" | "lg" }) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const bg = AVATAR_COLORS[h % AVATAR_COLORS.length];
  return (
    <div className={`avatar ${size ?? ""}`} style={{ background: bg }}>
      {name.slice(-2) || "?"}
    </div>
  );
}

/* ---------- Num ---------- */
export function Num({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`num ${className}`}>{children}</span>;
}

/* ---------- Empty ---------- */
export function Empty({ title, desc, actions }: { title: string; desc?: string; actions?: ReactNode }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {desc && <p>{desc}</p>}
      {actions && <div className="actions">{actions}</div>}
    </div>
  );
}

/* ---------- Sheet（弹层，弹簧入场） ---------- */
export function Sheet({ open, onClose, title, sub, wide, children }: { open: boolean; onClose: () => void; title: string; sub?: ReactNode; wide?: boolean; children: ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="sheet-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
          <motion.div
            className={`sheet ${wide ? "wide" : ""}`}
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 520, damping: 38, mass: 0.8 }}
          >
            <h2>{title}</h2>
            {sub && <div className="sheet-sub">{sub}</div>}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------- Stamp（打卡章，落下时回弹一下） ---------- */
export function Stamp({ label = "已上", fresh }: { label?: string; fresh?: boolean }) {
  return (
    <motion.span
      className="stamp"
      initial={fresh ? { scale: 1.6, rotate: -8, opacity: 0 } : false}
      animate={{ scale: 1, rotate: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 600, damping: 22, mass: 0.7 }}
    >
      <Check strokeWidth={3} />
      {label}
    </motion.span>
  );
}
