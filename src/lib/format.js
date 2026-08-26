import { IGV, SLA_ALERTA_MIN, SLA_OBJETIVO_MIN } from './constants.js'

const soles = new Intl.NumberFormat('es-PE', {
  style: 'currency',
  currency: 'PEN',
  minimumFractionDigits: 2,
})

export const money = (n) => soles.format(Number(n ?? 0))

export const hora = (iso) =>
  iso
    ? new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
    : '—'

export const fechaHora = (iso) =>
  iso
    ? new Date(iso).toLocaleString('es-PE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—'

/** Minutos transcurridos desde un ISO hasta ahora (o hasta `hasta`). */
export function minutosDesde(iso, hasta = Date.now()) {
  if (!iso) return 0
  return Math.max(0, Math.floor((hasta - new Date(iso).getTime()) / 60000))
}

/** mm:ss transcurrido, para el cronómetro del KDS. */
export function cronometro(iso, ahora = Date.now()) {
  if (!iso) return '--:--'
  const seg = Math.max(0, Math.floor((ahora - new Date(iso).getTime()) / 1000))
  const m = String(Math.floor(seg / 60)).padStart(2, '0')
  const s = String(seg % 60).padStart(2, '0')
  return `${m}:${s}`
}

/**
 * Semáforo del SLA: `ok` dentro de objetivo, `warn` cerca del límite,
 * `danger` vencido. `min` son minutos transcurridos.
 */
export function semaforoSla(min) {
  if (min >= SLA_OBJETIVO_MIN) return 'danger'
  if (min >= SLA_ALERTA_MIN) return 'warn'
  return 'ok'
}

/**
 * Desglose de IGV para previsualizar el ticket.
 * ORDER_TICKET guarda `amount` (total con IGV) y `withoutIgv` (base imponible).
 */
export function desgloseIgv(totalConIgv) {
  const total = Number(totalConIgv ?? 0)
  const base = total / (1 + IGV)
  return {
    total,
    base,
    igv: total - base,
    tasa: IGV,
  }
}

export const iniciales = (worker) =>
  worker ? `${worker.name?.[0] ?? ''}${worker.lastname?.[0] ?? ''}`.toUpperCase() : '??'

export const nombreCompleto = (worker) =>
  worker ? `${worker.name ?? ''} ${worker.lastname ?? ''}`.trim() : '—'

export const cx = (...clases) => clases.filter(Boolean).join(' ')
