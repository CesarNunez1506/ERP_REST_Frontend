import { Link } from 'react-router-dom'
import Icon from '../components/Icon.jsx'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Dot,
  ErrorState,
  Loading,
  PageHeader,
} from '../components/ui.jsx'
import { dashboard } from '../api/endpoints.js'
import { GRUPOS, ROOM } from '../api/events.js'
import { useFetch } from '../hooks/useApi.js'
import { useRefetchEnEventos, useSalas } from '../hooks/useRealtime.js'
import { SLA_OBJETIVO_MIN } from '../lib/constants.js'
import { cx, money } from '../lib/format.js'

function Kpi({ label, value, hint, tone = 'neutral', icon, to }) {
  const cuerpo = (
    <Card
      className={cx(
        'p-5 transition-shadow',
        to && 'hover:shadow-md hover:shadow-carbon-900/10',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold tracking-wide text-carbon-500 uppercase">{label}</p>
        {icon && (
          <span
            className={cx(
              'grid size-8 place-items-center rounded-lg',
              tone === 'danger'
                ? 'bg-rose-50 text-rose-600'
                : tone === 'warn'
                  ? 'bg-amber-50 text-amber-600'
                  : tone === 'ok'
                    ? 'bg-emerald-50 text-emerald-600'
                    : 'bg-brasa-50 text-brasa-600',
            )}
          >
            <Icon name={icon} size={17} />
          </span>
        )}
      </div>
      <p className="mt-3 text-3xl font-bold tracking-tight text-carbon-900 tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-carbon-500">{hint}</p>}
    </Card>
  )
  return to ? <Link to={to}>{cuerpo}</Link> : cuerpo
}

/** Barra horizontal simple: evita traer una librería de gráficos. */
function Barra({ label, valor, max, sufijo }) {
  const pct = max > 0 ? Math.round((valor / max) * 100) : 0
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className="truncate font-medium text-carbon-700">{label}</span>
        <span className="shrink-0 font-semibold text-carbon-900 tabular-nums">{sufijo}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-carbon-100">
        <div
          className="h-full rounded-full bg-brasa-500 transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export default function Panel() {
  const { data, loading, error, refetch } = useFetch(
    (signal) => dashboard.resumen({ signal }),
    [],
    { refetchInterval: 120_000 },
  )

  // Los KPIs son agregados: no se pueden recalcular en el cliente a partir de
  // un evento suelto, así que cada evento dispara un refetch (agrupado).
  useSalas([ROOM.SALON, ROOM.COCINA, ROOM.CAJA])
  useRefetchEnEventos([...GRUPOS.salon, ...GRUPOS.cocina], refetch, { espera: 500 })

  if (loading && !data) return <Loading label="Cargando panel…" />
  if (error && !data) return <ErrorState error={error} onRetry={refetch} />
  if (!data) return null

  const maxMonto = Math.max(...(data.topPlatos?.map((p) => p.monto) ?? [0]), 1)
  const maxCola = Math.max(...(data.cargaEstaciones?.map((e) => e.enCola) ?? [0]), 1)

  return (
    <>
      <PageHeader
        title="Panel del día"
        subtitle="Estado del salón, cocina y caja en tiempo real"
        actions={
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <Icon name="refresh" size={15} />
            Actualizar
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Ventas del día"
          value={money(data.ventasDia)}
          hint={`Ticket promedio ${money(data.ticketPromedio)}`}
          icon="billete"
          tone="ok"
          to="/caja"
        />
        <Kpi
          label="Órdenes activas"
          value={data.ordenesActivas}
          hint={`${data.mesas.ocupadas} mesas ocupadas · ${data.mesas.porCobrar} por cobrar`}
          icon="ordenes"
          to="/ordenes"
        />
        <Kpi
          label="Platos en cola"
          value={data.platosEnCola}
          hint={
            data.platosVencidos
              ? `${data.platosVencidos} fuera de SLA (${SLA_OBJETIVO_MIN} min)`
              : 'Todo dentro del SLA'
          }
          icon="cocina"
          tone={data.platosVencidos ? 'danger' : 'neutral'}
          to="/cocina"
        />
        <Kpi
          label="Por cobrar"
          value={money(data.ticketsPendientes.monto)}
          hint={`${data.ticketsPendientes.cantidad} ticket(s) pendiente(s)`}
          icon="caja"
          tone={data.ticketsPendientes.cantidad ? 'warn' : 'neutral'}
          to="/caja"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Ocupación del salón */}
        <Card className="lg:col-span-1">
          <CardHeader
            title="Ocupación del salón"
            subtitle={`${data.mesas.total} mesas`}
            actions={
              <Link
                to="/mesas"
                className="text-xs font-semibold text-brasa-600 hover:text-brasa-700"
              >
                Ver salón →
              </Link>
            }
          />
          <div className="space-y-4 p-5">
            <div className="flex h-3 overflow-hidden rounded-full bg-carbon-100">
              <div
                className="bg-emerald-500"
                style={{ width: `${(data.mesas.libres / data.mesas.total) * 100}%` }}
              />
              <div
                className="bg-amber-500"
                style={{ width: `${(data.mesas.ocupadas / data.mesas.total) * 100}%` }}
              />
              <div
                className="bg-sky-500"
                style={{ width: `${(data.mesas.porCobrar / data.mesas.total) * 100}%` }}
              />
            </div>
            <ul className="space-y-2.5 text-sm">
              {[
                ['Libres', data.mesas.libres, 'ok'],
                ['Ocupadas', data.mesas.ocupadas, 'warn'],
                ['Por cobrar', data.mesas.porCobrar, 'info'],
              ].map(([label, valor, tone]) => (
                <li key={label} className="flex items-center gap-2.5">
                  <Dot tone={tone} />
                  <span className="flex-1 text-carbon-600">{label}</span>
                  <span className="font-semibold text-carbon-900 tabular-nums">{valor}</span>
                </li>
              ))}
            </ul>
            <div className="rounded-lg bg-carbon-50 px-3 py-2.5 text-center">
              <p className="text-[11px] text-carbon-500">SLA promedio de cocina</p>
              <p
                className={cx(
                  'text-xl font-bold tabular-nums',
                  data.slaPromedioMin >= SLA_OBJETIVO_MIN ? 'text-rose-600' : 'text-emerald-600',
                )}
              >
                {data.slaPromedioMin} min
              </p>
            </div>
          </div>
        </Card>

        {/* Top de carta */}
        <Card className="lg:col-span-2">
          <CardHeader title="Platos más vendidos" subtitle="Por monto facturado en el día" />
          <div className="space-y-4 p-5">
            {data.topPlatos?.length ? (
              data.topPlatos.map((p) => (
                <Barra
                  key={p.name}
                  label={`${p.name} · ${p.cantidad} u.`}
                  valor={p.monto}
                  max={maxMonto}
                  sufijo={money(p.monto)}
                />
              ))
            ) : (
              <p className="py-6 text-center text-sm text-carbon-500">Aún no hay ventas.</p>
            )}
          </div>
        </Card>
      </div>

      {/* Carga por estación */}
      <Card className="mt-6">
        <CardHeader
          title="Carga por estación"
          subtitle="Platos pendientes o en preparación asignados a cada estación"
          actions={
            <Link
              to="/cocina"
              className="text-xs font-semibold text-brasa-600 hover:text-brasa-700"
            >
              Abrir KDS →
            </Link>
          }
        />
        <div className="grid grid-cols-1 gap-x-8 gap-y-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
          {data.cargaEstaciones?.map((e) => (
            <div key={e.id} className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs">
                <Dot tone={e.isAvailable ? 'ok' : 'neutral'} />
                <span className="flex-1 truncate font-medium text-carbon-700">{e.name}</span>
                {!e.isAvailable && <Badge tone="neutral">Cerrada</Badge>}
                <span className="font-semibold text-carbon-900 tabular-nums">{e.enCola}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-carbon-100">
                <div
                  className={cx(
                    'h-full rounded-full transition-[width] duration-500',
                    e.enCola >= 4 ? 'bg-rose-500' : e.enCola >= 2 ? 'bg-amber-500' : 'bg-emerald-500',
                  )}
                  style={{ width: `${(e.enCola / maxCola) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </>
  )
}
