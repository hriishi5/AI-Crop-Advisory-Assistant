import { type ReactNode } from 'react';
import { LoaderCircle, Search, X } from 'lucide-react';

export function Button({ children, variant = 'primary', type = 'button', className = '', onClick, disabled, dataTestId }: {
  children: ReactNode; variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; type?: 'button' | 'submit'; className?: string; onClick?: () => void; disabled?: boolean; dataTestId?: string;
}) {
  const styles = {
    primary: 'bg-primary text-primary-foreground hover:brightness-105 shadow-sm',
    secondary: 'bg-secondary text-secondary-foreground hover:brightness-105',
    ghost: 'bg-transparent text-foreground hover:bg-muted',
    danger: 'bg-destructive text-destructive-foreground hover:brightness-105',
  };
  return <button type={type} onClick={onClick} disabled={disabled} data-testid={dataTestId} className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}>{disabled && variant === 'primary' ? <LoaderCircle size={15} className="animate-spin" /> : null}{children}</button>;
}

export function Card({ children, className = '', accent = false }: { children: ReactNode; className?: string; accent?: boolean }) {
  return <section className={`relative overflow-hidden rounded-2xl border border-card-border bg-card shadow-[0_10px_30px_rgba(50,65,39,.05)] ${accent ? 'before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-secondary' : ''} ${className}`}>{children}</section>;
}

export function Field({ label, value, onChange, placeholder, type = 'text', required, name, hint }: { label: string; value: string | number; onChange: (value: string) => void; placeholder?: string; type?: string; required?: boolean; name?: string; hint?: string }) {
  return <label className="grid gap-1.5 text-sm font-medium text-foreground" data-testid={`field-${name ?? label.toLowerCase().replace(/\s+/g, '-')}`}>
    <span>{label}{required ? <span className="ml-1 text-accent">*</span> : null}</span>
    <input name={name} required={required} type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-11 w-full rounded-xl border border-input bg-background px-3.5 text-sm outline-none transition focus:border-secondary focus:ring-2 focus:ring-secondary/25" data-testid={`input-${name ?? label.toLowerCase().replace(/\s+/g, '-')}`} />
    {hint ? <span className="text-xs font-normal text-muted-foreground">{hint}</span> : null}
  </label>;
}

export function SelectField({ label, value, onChange, options, name, required }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[]; name?: string; required?: boolean }) {
  return <label className="grid gap-1.5 text-sm font-medium text-foreground" data-testid={`field-${name ?? label.toLowerCase().replace(/\s+/g, '-')}`}>
    <span>{label}{required ? <span className="ml-1 text-accent">*</span> : null}</span>
    <select name={name} required={required} value={value} onChange={(e) => onChange(e.target.value)} className="h-11 w-full rounded-xl border border-input bg-background px-3.5 text-sm outline-none transition focus:border-secondary focus:ring-2 focus:ring-secondary/25" data-testid={`select-${name ?? label.toLowerCase().replace(/\s+/g, '-')}`}>
      <option value="">Choose an option</option>
      {options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
    </select>
  </label>;
}

export function TextAreaField({ label, value, onChange, placeholder, name, rows = 4, required }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; name?: string; rows?: number; required?: boolean }) {
  return <label className="grid gap-1.5 text-sm font-medium text-foreground"><span>{label}{required ? <span className="ml-1 text-accent">*</span> : null}</span><textarea name={name} required={required} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full resize-y rounded-xl border border-input bg-background px-3.5 py-3 text-sm outline-none transition focus:border-secondary focus:ring-2 focus:ring-secondary/25" data-testid={`textarea-${name ?? label.toLowerCase().replace(/\s+/g, '-')}`} /></label>;
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'gold' | 'green' | 'coral' | 'red' }) {
  const colors = { neutral: 'bg-muted text-muted-foreground', gold: 'bg-secondary/25 text-foreground', green: 'bg-[hsl(155_35%_84%)] text-[hsl(155_40%_25%)]', coral: 'bg-accent/15 text-accent', red: 'bg-destructive/12 text-destructive' };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[.08em] ${colors[tone]}`}>{children}</span>;
}

export function PageHeader({ eyebrow, title, description, children }: { eyebrow?: string; title: string; description?: string; children?: ReactNode }) {
  return <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><div className="mb-2 font-mono-app text-[11px] uppercase tracking-[.2em] text-accent">{eyebrow}</div><h1 className="font-display text-4xl leading-[1.05] tracking-[-.03em] text-foreground sm:text-5xl">{title}</h1>{description ? <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p> : null}</div>{children ? <div className="flex shrink-0 gap-2">{children}</div> : null}</header>;
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-muted ${className}`} aria-label="Loading" data-testid="loading-skeleton" />;
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-card-border bg-card/50 px-6 py-14 text-center"><div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-secondary/25 text-primary"><span className="h-2.5 w-2.5 rounded-full bg-accent" /></div><h3 className="font-display text-2xl">{title}</h3><p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{description}</p>{action ? <div className="mt-5">{action}</div> : null}</div>;
}

export function ErrorState({ onRetry }: { onRetry: () => void }) {
  return <div className="rounded-2xl border border-accent/25 bg-accent/5 px-6 py-10 text-center" data-testid="error-state"><p className="font-display text-2xl">The field notes are out of reach.</p><p className="mt-2 text-sm text-muted-foreground">Check your connection and try again.</p><Button className="mt-5" variant="secondary" onClick={onRetry} dataTestId="button-retry">Try again</Button></div>;
}

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-primary/35 p-4 backdrop-blur-sm" role="dialog" aria-modal="true"><div className="max-h-[90dvh] w-full max-w-2xl overflow-auto rounded-2xl border border-card-border bg-card p-5 shadow-2xl sm:p-7"><div className="mb-6 flex items-start justify-between gap-4"><h2 className="font-display text-3xl">{title}</h2><button onClick={onClose} className="rounded-full p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground" data-testid="button-close-modal" aria-label="Close"><X size={18} /></button></div>{children}</div></div>;
}

export function SearchField({ value, onChange, placeholder = 'Search records' }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <label className="relative block"><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-11 w-full rounded-xl border border-input bg-background pl-9 pr-3 text-sm outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/25" data-testid="input-search" /></label>;
}

export const labels = (value?: string | null) => value ? value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) : 'Not recorded';
export const formatDate = (value?: string | null) => value ? new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value)) : '—';
export const pct = (value?: number | null) => `${Math.round((value ?? 0) * 100)}%`;