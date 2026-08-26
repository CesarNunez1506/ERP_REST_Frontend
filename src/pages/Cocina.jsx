import { useState } from 'react'
import Icon from '../components/Icon.jsx'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Loading,
  PageHeader,
  useToast,
} from '../components/ui.jsx'
import { plates, stations } from '../api/endpoints.js'
import { EV, ROOM } from '../api/events.js'
import { useAction, useFetch, useNow } from '../hooks/useApi.js'
import { useRealtime, useRefetchEnEventos, useSalas } from '../hooks/useRealtime.js'
import {
  PLATE_NEXT,
  PLATE_STATUS,
  PLATE_STATUS_LABEL,
  SLA_ALERTA_MIN,
  SLA_OBJETIVO_MIN,
} from '../lib/constants.js'
import { cronometro, cx, hora, minutosDesde, semaforoSla } from '../lib/format.js'

/** Estados que el KDS muestra; fuera de esta lista el plato sale del tablero. */
const ESTADOS_KDS = [PLATE_STATUS.PENDIENTE, PLATE_STATUS.EN_PREPARACION, PLATE_STATUS.LISTO]

const COLUMNAS = [
  { estado: PLATE_STATUS.PENDIENTE, titulo: 'En cola', acento: 'bg-carbon-400' },
  { estado: PLATE_STATUS.EN_PREPARACION, titulo: 'En preparación', acento: 'bg-amber-500' },
  { estado: PLATE_STATUS.LISTO, titulo: 'Listo para servir', acento: 'bg-emerald-500' },
]

const BORDE_SLA = {
  ok: 'border-l-emerald-500',
  warn: 'border-l-amber-500',
  danger: 'border-l-rose-500',
}

function Comanda({ plato, ahora, onAvanzar, onAnular, ocupado }) {
  const min = plato.sendTime ? minutosDesde(plato.sendTime, ahora) : 0
  const tono = semaforoSla(min)
  const siguiente = PLATE_NEXT[plato.status]

  return (
    <Card className={cx('border-l-4 p-4', BORDE_SLA[tono])}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-wide text-carbon-400 uppercase">
            Mesa {plato.tableNumber ?? '—'} · Orden #{plato.orderId}
          </p>
          <p className="mt-0.5 flex items-baseline gap-1.5 font-bold text-carbon-900">
            <span className="text-brasa-600 tabular-nums">{plato.quantityDispend}×</span>
            <span className="truncate">{plato.menu?.name ?? `Menú #${plato.menuId}`}</span>
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p
            className={cx(
              'font-mono text-lg leading-none font-bold tabular-nums',
              tono === 'danger'
                ? 'animate-pulso-sla text-rose-600'
                : tono === 'warn'
                  ? 'text-amber-600'
                  : 'text-emerald-600',
            )}
          >
            {cronometro(plato.sendTime, ahora)}
          </p>
          <p className="mt-0.5 text-[10px] text-carbon-400">{hora(plato.sendTime)}</p>
        </div>
      </div>

      {plato.comment && (
        <p className="mt-2.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-900">
          ⚠ {plato.comment}
        </p>
      )}

      <div className="mt-3 flex items-center gap-2">
        <Badge tone="neutral" className="shrink-0">
          {plato.station?.name ?? 'Sin estación'}
        </Badge>
        {tono === 'danger' && (
          <Badge tone="danger">
            <Icon name="alerta" size={11} />
            {min} min
          </Badge>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        {siguiente && (
          <Button
            size="sm"
            variant={siguiente === PLATE_STATUS.LISTO ? 'success' : 'dark'}
            className="flex-1"
            disabled={ocupado}
            onClick={() => onAvanzar(plato, siguiente)}
          >
            {siguiente === PLATE_STATUS.EN_PREPARACION && <Icon name="fuego" size={14} />}
            {siguiente === PLATE_STATUS.LISTO && <Icon name="check" size={14} />}
            {siguiente === PLATE_STATUS.ENTREGADO && <Icon name="flecha" size={14} />}
            {siguiente === PLATE_STATUS.EN_PREPARACION
              ? 'Empezar'
              : siguiente === PLATE_STATUS.LISTO
                ? 'Marcar listo'
                : 'Entregar'}
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          disabled={ocupado}
          onClick={() => onAnular(plato)}
          aria-label="Anular plato"
        >
          ✕
        </Button>
      </div>
    </Card>
  )
}

export default function Cocina() {
  const toast = useToast()
  const ahora = useNow(1000)
  const { saving, run } = useAction()
  const [estacionId, setEstacionId] = useState('')

  const estaciones = useFetch((signal) => stations.list(undefined, { signal }), [])

  const cola = useFetch(
    (signal) =>
      plates.list(
        {
          enviados: 'true',
          status: ESTADOS_KDS.join(','),
          stationId: estacionId || undefined,
        },
        { signal },
      ),
    [estacionId],
    // El tablero se alimenta del gateway; este intervalo largo solo repara
    // huecos si se cayó la conexión y se perdieron eventos.
    { refetchInterval: 120_000 },
  )

  // Solo la sala de la estación elegida: la parrilla no recibe el tráfico de barra.
  useSalas([estacionId ? ROOM.estacion(estacionId) : ROOM.COCINA], { enabled: true })

  /** ¿Este plato pertenece al tablero que se está mirando? */
  const enTablero = (p) =>
    Boolean(p?.sendTime) &&
    ESTADOS_KDS.includes(p.status) &&
    (!estacionId || String(p.stationId) === estacionId)

  // Altas y cambios de estado se aplican directo sobre la lista: en cocina no
  // se puede esperar un refetch completo por cada plato que avanza.
  useRealtime([EV.PLATE_CREATED, EV.PLATE_UPDATED], (plato, evento) => {
    if (!plato?.id) return
    const entra = enTablero(plato)
    if (entra && evento === EV.PLATE_CREATED) {
      toast.info(`Nueva comanda · Mesa ${plato.tableNumber ?? '—'} · ${plato.menu?.name ?? ''}`)
    }
    cola.setData((xs) => {
      const resto = (xs ?? []).filter((p) => p.id !== plato.id)
      if (!entra) return resto
      return [...resto, plato].sort(
        (a, b) => new Date(a.sendTime ?? 0) - new Date(b.sendTime ?? 0),
      )
    })
  })

  useRealtime(EV.PLATE_DELETED, ({ plateId }) =>
    cola.setData((xs) => (xs ?? []).filter((p) => p.id !== plateId)),
  )

  // Los contadores por estación sí conviene releerlos del servidor.
  useRefetchEnEventos(
    [EV.STATION_UPDATED, EV.PLATE_CREATED, EV.PLATE_UPDATED, EV.PLATE_DELETED],
    estaciones.refetch,
  )

  const porEstado = (estado) => (cola.data ?? []).filter((p) => p.status === estado)

  async function avanzar(plato, siguiente) {
    // Optimista: el KDS se toca con las manos ocupadas, no puede esperar el
    // round-trip para reordenar la columna. El PLATE_UPDATED que devuelve el
    // gateway confirma (o corrige) el estado al instante siguiente.
    cola.setData((xs) =>
      siguiente === PLATE_STATUS.ENTREGADO
        ? xs?.filter((p) => p.id !== plato.id)
        : xs?.map((p) => (p.id === plato.id ? { ...p, status: siguiente } : p)),
    )
    try {
      await run(() => plates.setStatus(plato.id, siguiente))
      if (siguiente === PLATE_STATUS.ENTREGADO) toast.ok('Plato entregado')
    } catch (err) {
      toast.error(err)
      cola.refetch()
    }
  }

  async function anular(plato) {
    cola.setData((xs) => xs?.filter((p) => p.id !== plato.id))
    try {
      await run(() => plates.setStatus(plato.id, PLATE_STATUS.ANULADO))
      toast.info(`"${plato.menu?.name}" anulado`)
    } catch (err) {
      toast.error(err)
      cola.refetch()
    }
  }

  const vencidos = (cola.data ?? []).filter(
    (p) => p.status !== 'LISTO' && minutosDesde(p.sendTime, ahora) >= SLA_OBJETIVO_MIN,
  ).length

  return (
    <>
      <PageHeader
        title="Cocina — KDS"
        subtitle={`Objetivo ${SLA_OBJETIVO_MIN} min por plato · alerta a los ${SLA_ALERTA_MIN} min`}
        actions={
          <>
            {vencidos > 0 && (
              <Badge tone="danger">
                <Icon name="alerta" size={12} />
                {vencidos} fuera de SLA
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={() => cola.refetch()}>
              <Icon name="refresh" size={15} />
              Actualizar
            </Button>
          </>
        }
      />

      {/* Selector de estación */}
      <div className="mb-5 flex flex-wrap gap-2">
        <button
          onClick={() => setEstacionId('')}
          className={cx(
            'rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors',
            !estacionId
              ? 'border-carbon-800 bg-carbon-800 text-white'
              : 'border-carbon-200 bg-white text-carbon-600 hover:border-carbon-300',
          )}
        >
          Todas las estaciones
        </button>
        {(estaciones.data ?? []).map((s) => (
          <button
            key={s.id}
            onClick={() => setEstacionId(String(s.id))}
            disabled={!s.isAvailable}
            className={cx(
              'inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-40',
              String(s.id) === estacionId
                ? 'border-carbon-800 bg-carbon-800 text-white'
                : 'border-carbon-200 bg-white text-carbon-600 hover:border-carbon-300',
            )}
          >
            {s.name}
            {s.platesInQueue > 0 && (
              <span className="rounded-full bg-brasa-500 px-1.5 text-[10px] text-white tabular-nums">
                {s.platesInQueue}
              </span>
            )}
          </button>
        ))}
      </div>

      {cola.loading && !cola.data ? (
        <Loading label="Cargando comandas…" />
      ) : cola.error ? (
        <ErrorState error={cola.error} onRetry={cola.refetch} />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {COLUMNAS.map((col) => {
            const items = porEstado(col.estado)
            return (
              <section key={col.estado} className="flex min-h-0 flex-col">
                <header className="mb-3 flex items-center gap-2.5">
                  <span className={cx('h-5 w-1 rounded-full', col.acento)} />
                  <h2 className="text-sm font-bold text-carbon-800">{col.titulo}</h2>
                  <span className="rounded-full bg-carbon-100 px-2 py-0.5 text-xs font-semibold text-carbon-600 tabular-nums">
                    {items.length}
                  </span>
                </header>
                <div className="space-y-3">
                  {items.length ? (
                    items.map((p) => (
                      <Comanda
                        key={p.id}
                        plato={p}
                        ahora={ahora}
                        ocupado={saving}
                        onAvanzar={avanzar}
                        onAnular={anular}
                      />
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed border-carbon-200 py-10 text-center text-xs text-carbon-400">
                      Nada en «{PLATE_STATUS_LABEL[col.estado].toLowerCase()}»
                    </div>
                  )}
                </div>
              </section>
            )
          })}
        </div>
      )}

      {cola.data?.length === 0 && (
        <EmptyState
          icon="🍳"
          title="Cocina al día"
          description="No hay platos pendientes en esta estación."
          className="mt-4"
        />
      )}
    </>
  )
}
