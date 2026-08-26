import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { cx } from '../lib/format.js'

// ── Tonos compartidos por badges, banners y estados ───────────────────────
const TONOS = {
  ok: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  warn: 'bg-amber-50 text-amber-700 ring-amber-200',
  danger: 'bg-rose-50 text-rose-700 ring-rose-200',
  info: 'bg-sky-50 text-sky-700 ring-sky-200',
  neutral: 'bg-carbon-100 text-carbon-600 ring-carbon-200',
  brand: 'bg-brasa-50 text-brasa-700 ring-brasa-200',
}

export function Badge({ tone = 'neutral', children, className }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset whitespace-nowrap',
        TONOS[tone] ?? TONOS.neutral,
        className,
      )}
    >
      {children}
    </span>
  )
}

export function Dot({ tone = 'neutral', pulse = false }) {
  const color = {
    ok: 'bg-emerald-500',
    warn: 'bg-amber-500',
    danger: 'bg-rose-500',
    info: 'bg-sky-500',
    neutral: 'bg-carbon-400',
    brand: 'bg-brasa-500',
  }[tone]
  return <span className={cx('size-2 rounded-full', color, pulse && 'animate-pulso-sla')} />
}

// ── Botones ───────────────────────────────────────────────────────────────
const VARIANTES = {
  primary: 'bg-brasa-600 text-white hover:bg-brasa-700 focus-visible:outline-brasa-600',
  dark: 'bg-carbon-800 text-white hover:bg-carbon-900 focus-visible:outline-carbon-800',
  outline:
    'bg-white text-carbon-700 ring-1 ring-inset ring-carbon-200 hover:bg-carbon-50 focus-visible:outline-carbon-400',
  ghost: 'text-carbon-600 hover:bg-carbon-100 focus-visible:outline-carbon-400',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 focus-visible:outline-rose-600',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:outline-emerald-600',
}

const TAMANOS = {
  sm: 'px-2.5 py-1.5 text-xs gap-1.5',
  md: 'px-3.5 py-2 text-sm gap-2',
  lg: 'px-5 py-2.5 text-sm gap-2',
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  loading = false,
  disabled,
  children,
  ...props
}) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center rounded-lg font-semibold transition-colors',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTES[variant],
        TAMANOS[size],
        className,
      )}
    >
      {loading && <Spinner size={14} />}
      {children}
    </button>
  )
}

export function Spinner({ size = 18, className }) {
  return (
    <svg
      className={cx('animate-spin', className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
      <path
        d="M22 12a10 10 0 0 1-10 10"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  )
}

// ── Contenedores ──────────────────────────────────────────────────────────
export function Card({ className, children, ...props }) {
  return (
    <div
      {...props}
      className={cx(
        'rounded-xl border border-carbon-200/70 bg-white shadow-sm shadow-carbon-900/5',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function CardHeader({ title, subtitle, actions, className }) {
  return (
    <div
      className={cx(
        'flex flex-wrap items-center justify-between gap-3 border-b border-carbon-200/70 px-5 py-4',
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="truncate text-sm font-semibold text-carbon-900">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-carbon-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-carbon-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-carbon-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

// ── Estados de carga / error / vacío ──────────────────────────────────────
export function Loading({ label = 'Cargando…', className }) {
  return (
    <div className={cx('flex items-center justify-center gap-3 py-16 text-carbon-500', className)}>
      <Spinner />
      <span className="text-sm">{label}</span>
    </div>
  )
}

export function ErrorState({ error, onRetry, className }) {
  return (
    <div
      className={cx(
        'flex flex-col items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-6 py-10 text-center',
        className,
      )}
    >
      <div className="grid size-10 place-items-center rounded-full bg-rose-100 text-lg">⚠️</div>
      <div>
        <p className="text-sm font-semibold text-rose-800">No se pudo cargar la información</p>
        <p className="mt-1 max-w-md text-xs text-rose-700">{error?.message ?? 'Error desconocido'}</p>
        {error?.status ? (
          <p className="mt-1 text-[11px] text-rose-600">HTTP {error.status}</p>
        ) : null}
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Reintentar
        </Button>
      )}
    </div>
  )
}

export function EmptyState({ icon = '🗒️', title, description, action, className }) {
  return (
    <div
      className={cx(
        'flex flex-col items-center gap-2 px-6 py-14 text-center text-carbon-500',
        className,
      )}
    >
      <div className="text-3xl opacity-70">{icon}</div>
      <p className="text-sm font-semibold text-carbon-700">{title}</p>
      {description && <p className="max-w-sm text-xs">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

// ── Formulario ────────────────────────────────────────────────────────────
export function Field({ label, hint, error, required, children, className }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1.5 block text-xs font-semibold text-carbon-700">
        {label}
        {required && <span className="text-brasa-600"> *</span>}
      </span>
      {children}
      {hint && !error && <span className="mt-1 block text-[11px] text-carbon-500">{hint}</span>}
      {error && <span className="mt-1 block text-[11px] font-medium text-rose-600">{error}</span>}
    </label>
  )
}

const inputBase =
  'w-full rounded-lg border border-carbon-200 bg-white px-3 py-2 text-sm text-carbon-900 ' +
  'placeholder:text-carbon-400 focus:border-brasa-500 focus:ring-2 focus:ring-brasa-500/20 focus:outline-none ' +
  'disabled:bg-carbon-50 disabled:text-carbon-400'

export const Input = (props) => <input {...props} className={cx(inputBase, props.className)} />

export const Textarea = (props) => (
  <textarea {...props} className={cx(inputBase, 'resize-y', props.className)} />
)

export function Select({ children, ...props }) {
  return (
    <select {...props} className={cx(inputBase, 'appearance-none pr-8', props.className)}>
      {children}
    </select>
  )
}

export function Toggle({ checked, onChange, label, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2 disabled:opacity-50"
    >
      <span
        className={cx(
          'relative h-5 w-9 rounded-full transition-colors',
          checked ? 'bg-emerald-500' : 'bg-carbon-300',
        )}
      >
        <span
          className={cx(
            'absolute top-0.5 size-4 rounded-full bg-white shadow transition-all',
            checked ? 'left-4.5' : 'left-0.5',
          )}
        />
      </span>
      {label && <span className="text-xs font-medium text-carbon-600">{label}</span>}
    </button>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, subtitle, children, footer, width = 'max-w-lg' }) {
  useEffect(() => {
    if (!open) return
    const cerrar = (e) => e.key === 'Escape' && onClose?.()
    document.addEventListener('keydown', cerrar)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', cerrar)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-carbon-950/50 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cx(
          'relative flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl',
          width,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-carbon-200 px-5 py-4">
          <div>
            <h3 className="text-base font-bold text-carbon-900">{title}</h3>
            {subtitle && <p className="mt-0.5 text-xs text-carbon-500">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="-mr-1 rounded-lg p-1.5 text-carbon-400 hover:bg-carbon-100 hover:text-carbon-700"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-carbon-200 bg-carbon-50/60 px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Tabla ─────────────────────────────────────────────────────────────────
export function Table({ columns, rows, keyOf, empty, onRowClick, className }) {
  if (!rows?.length) return empty ?? <EmptyState title="Sin registros" />

  return (
    <div className={cx('overflow-x-auto', className)}>
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-carbon-200 bg-carbon-50/70">
            {columns.map((c) => (
              <th
                key={c.key}
                className={cx(
                  'px-4 py-2.5 text-left text-[11px] font-semibold tracking-wide text-carbon-500 uppercase',
                  c.align === 'right' && 'text-right',
                  c.align === 'center' && 'text-center',
                  c.className,
                )}
                style={c.width ? { width: c.width } : undefined}
              >
                {c.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={keyOf?.(row) ?? row.id ?? i}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cx(
                'border-b border-carbon-100 last:border-0',
                onRowClick && 'cursor-pointer hover:bg-brasa-50/40',
              )}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={cx(
                    'px-4 py-3 align-middle text-carbon-700',
                    c.align === 'right' && 'text-right',
                    c.align === 'center' && 'text-center',
                    c.cellClassName,
                  )}
                >
                  {c.render ? c.render(row, i) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Avisos (toasts) ───────────────────────────────────────────────────────
const ToastCtx = createContext(() => {})

export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }) {
  const [items, setItems] = useState([])

  const push = useCallback((mensaje, tone = 'ok') => {
    const id = `${Date.now()}-${Math.random()}`
    setItems((xs) => [...xs, { id, mensaje, tone }])
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 4200)
  }, [])

  const api = useMemo(
    () => ({
      ok: (m) => push(m, 'ok'),
      error: (m) => push(typeof m === 'string' ? m : (m?.message ?? 'Ocurrió un error'), 'danger'),
      info: (m) => push(m, 'info'),
    }),
    [push],
  )

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-80 flex-col gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            className={cx(
              'pointer-events-auto flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm shadow-lg',
              t.tone === 'danger'
                ? 'border-rose-200 bg-rose-50 text-rose-800'
                : t.tone === 'info'
                  ? 'border-sky-200 bg-sky-50 text-sky-800'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-800',
            )}
          >
            <span className="mt-px">
              {t.tone === 'danger' ? '⚠️' : t.tone === 'info' ? 'ℹ️' : '✅'}
            </span>
            <span className="flex-1">{t.mensaje}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}
