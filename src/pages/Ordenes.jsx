import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../components/Icon.jsx'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Loading,
  PageHeader,
  Table,
} from '../components/ui.jsx'
import { orders } from '../api/endpoints.js'
import { GRUPOS, ROOM } from '../api/events.js'
import { useFetch } from '../hooks/useApi.js'
import { useRefetchEnEventos, useSalas } from '../hooks/useRealtime.js'
import {
  ORDER_STATUS,
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TONE,
  TICKET_STATUS_LABEL,
  TICKET_STATUS_TONE,
} from '../lib/constants.js'
import { cx, fechaHora, money, nombreCompleto } from '../lib/format.js'

const FILTROS = [
  { valor: 'activas', label: 'Activas' },
  { valor: '', label: 'Todas' },
  ...Object.values(ORDER_STATUS).map((s) => ({ valor: s, label: ORDER_STATUS_LABEL[s] })),
]

export default function Ordenes() {
  const navigate = useNavigate()
  const [filtro, setFiltro] = useState('activas')

  const query = filtro === 'activas' ? { activas: 'true' } : filtro ? { status: filtro } : undefined

  const { data, loading, error, refetch } = useFetch(
    (signal) => orders.list(query, { signal }),
    [filtro],
    { refetchInterval: 120_000 },
  )

  // El filtro activo decide qué órdenes entran o salen de la lista, así que
  // conviene releer del servidor en vez de intentar reconciliarlo en el cliente.
  useSalas(ROOM.SALON)
  useRefetchEnEventos(GRUPOS.salon, refetch)

  const columnas = [
    {
      key: 'id',
      title: 'Orden',
      width: 110,
      render: (o) => <span className="font-semibold text-carbon-900">#{o.id}</span>,
    },
    {
      key: 'mesa',
      title: 'Mesa',
      width: 90,
      render: (o) =>
        o.table ? (
          <span className="inline-flex items-center gap-1.5">
            <Icon name="mesas" size={14} className="text-carbon-400" />
            <span className="font-medium">{o.table.number}</span>
          </span>
        ) : (
          '—'
        ),
    },
    {
      key: 'worker',
      title: 'Mozo',
      render: (o) => nombreCompleto(o.worker),
    },
    {
      key: 'status',
      title: 'Estado',
      render: (o) => (
        <Badge tone={ORDER_STATUS_TONE[o.status]}>{ORDER_STATUS_LABEL[o.status]}</Badge>
      ),
    },
    {
      key: 'plateCount',
      title: 'Platos',
      align: 'center',
      width: 80,
      render: (o) => <span className="tabular-nums">{o.plateCount}</span>,
    },
    {
      key: 'ticket',
      title: 'Ticket',
      render: (o) =>
        o.ticket ? (
          <Badge tone={TICKET_STATUS_TONE[o.ticket.status]}>
            {TICKET_STATUS_LABEL[o.ticket.status]}
          </Badge>
        ) : (
          <span className="text-xs text-carbon-400">Sin emitir</span>
        ),
    },
    {
      key: 'createdAt',
      title: 'Apertura',
      render: (o) => <span className="text-xs text-carbon-500">{fechaHora(o.createdAt)}</span>,
    },
    {
      key: 'total',
      title: 'Total',
      align: 'right',
      render: (o) => <span className="font-semibold tabular-nums">{money(o.total)}</span>,
    },
  ]

  return (
    <>
      <PageHeader
        title="Órdenes"
        subtitle="ORDER — una comanda por mesa, con sus platos y su ticket"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <Icon name="refresh" size={15} />
              Actualizar
            </Button>
            <Button size="sm" onClick={() => navigate('/mesas')}>
              <Icon name="mas" size={15} />
              Nueva orden
            </Button>
          </>
        }
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {FILTROS.map((f) => (
          <button
            key={f.label}
            onClick={() => setFiltro(f.valor)}
            className={cx(
              'rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors',
              filtro === f.valor
                ? 'border-carbon-800 bg-carbon-800 text-white'
                : 'border-carbon-200 bg-white text-carbon-600 hover:border-carbon-300',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <Card>
        {loading && !data ? (
          <Loading label="Cargando órdenes…" />
        ) : error ? (
          <ErrorState error={error} onRetry={refetch} className="m-5" />
        ) : (
          <Table
            columns={columnas}
            rows={data ?? []}
            onRowClick={(o) => navigate(`/ordenes/${o.id}`)}
            empty={
              <EmptyState
                icon="🧾"
                title="No hay órdenes con este filtro"
                description="Abre una orden desde el salón tocando una mesa libre."
                action={
                  <Button size="sm" onClick={() => navigate('/mesas')}>
                    Ir al salón
                  </Button>
                }
              />
            }
          />
        )}
      </Card>
    </>
  )
}
