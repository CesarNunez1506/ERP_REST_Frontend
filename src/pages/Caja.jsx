import { useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../components/Icon.jsx'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  Loading,
  Modal,
  PageHeader,
  Table,
  useToast,
} from '../components/ui.jsx'
import { tickets } from '../api/endpoints.js'
import { GRUPOS, ROOM } from '../api/events.js'
import { useAction, useFetch } from '../hooks/useApi.js'
import { useRefetchEnEventos, useSalas } from '../hooks/useRealtime.js'
import { TICKET_STATUS_LABEL, TICKET_STATUS_TONE } from '../lib/constants.js'
import { cx, fechaHora, money } from '../lib/format.js'

export default function Caja() {
  const toast = useToast()
  const { saving, run } = useAction()
  const [filtro, setFiltro] = useState('')
  const [cobrar, setCobrar] = useState(null)

  const { data, loading, error, refetch } = useFetch(
    (signal) => tickets.list(filtro ? { status: filtro } : undefined, { signal }),
    [filtro],
    { refetchInterval: 120_000 },
  )

  // Un ticket emitido en el salón tiene que aparecer en caja sin refrescar.
  useSalas(ROOM.CAJA)
  useRefetchEnEventos(GRUPOS.caja, refetch)

  const lista = data ?? []
  const pagados = lista.filter((t) => t.status === 'PAGADA')
  const pendientes = lista.filter((t) => t.status === 'PENDIENTE')

  async function confirmarPago() {
    try {
      await run(() => tickets.pay(cobrar.id))
      toast.ok(`Ticket #${cobrar.id} cobrado por ${money(cobrar.amount)}`)
      setCobrar(null)
      refetch()
    } catch (err) {
      toast.error(err)
    }
  }

  const columnas = [
    {
      key: 'id',
      title: 'Ticket',
      width: 100,
      render: (t) => <span className="font-semibold text-carbon-900">#{t.id}</span>,
    },
    {
      key: 'orderId',
      title: 'Orden',
      width: 100,
      render: (t) => (
        <Link
          to={`/ordenes/${t.orderId}`}
          className="font-medium text-brasa-600 hover:text-brasa-700"
          onClick={(e) => e.stopPropagation()}
        >
          #{t.orderId}
        </Link>
      ),
    },
    { key: 'tableNumber', title: 'Mesa', width: 80, render: (t) => t.tableNumber ?? '—' },
    { key: 'workerName', title: 'Mozo', render: (t) => t.workerName ?? '—' },
    {
      key: 'withoutIgv',
      title: 'Sin IGV',
      align: 'right',
      render: (t) => <span className="tabular-nums text-carbon-600">{money(t.withoutIgv)}</span>,
    },
    {
      key: 'igv',
      title: 'IGV',
      align: 'right',
      render: (t) => <span className="tabular-nums text-carbon-600">{money(t.igv)}</span>,
    },
    {
      key: 'amount',
      title: 'Total',
      align: 'right',
      render: (t) => <span className="font-bold tabular-nums">{money(t.amount)}</span>,
    },
    {
      key: 'status',
      title: 'Estado',
      render: (t) => <Badge tone={TICKET_STATUS_TONE[t.status]}>{TICKET_STATUS_LABEL[t.status]}</Badge>,
    },
    {
      key: 'createdAt',
      title: 'Emitido',
      render: (t) => <span className="text-xs text-carbon-500">{fechaHora(t.createdAt)}</span>,
    },
    {
      key: 'acciones',
      title: '',
      align: 'right',
      render: (t) =>
        t.status === 'PENDIENTE' ? (
          <Button
            size="sm"
            variant="success"
            onClick={(e) => {
              e.stopPropagation()
              setCobrar(t)
            }}
          >
            Cobrar
          </Button>
        ) : null,
    },
  ]

  return (
    <>
      <PageHeader
        title="Caja"
        subtitle="ORDER_TICKET — amount incluye IGV; without_igv es la base imponible"
        actions={
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <Icon name="refresh" size={15} />
            Actualizar
          </Button>
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          ['Cobrado', money(pagados.reduce((a, t) => a + t.amount, 0)), `${pagados.length} tickets`, 'ok'],
          [
            'Por cobrar',
            money(pendientes.reduce((a, t) => a + t.amount, 0)),
            `${pendientes.length} tickets`,
            pendientes.length ? 'warn' : 'neutral',
          ],
          [
            'IGV del día',
            money(pagados.reduce((a, t) => a + t.igv, 0)),
            'Sobre lo ya cobrado',
            'neutral',
          ],
        ].map(([label, valor, hint, tone]) => (
          <Card key={label} className="p-5">
            <p className="text-xs font-semibold tracking-wide text-carbon-500 uppercase">{label}</p>
            <p
              className={cx(
                'mt-2 text-2xl font-bold tabular-nums',
                tone === 'ok'
                  ? 'text-emerald-600'
                  : tone === 'warn'
                    ? 'text-amber-600'
                    : 'text-carbon-900',
              )}
            >
              {valor}
            </p>
            <p className="mt-1 text-xs text-carbon-500">{hint}</p>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader
          title="Tickets"
          actions={
            <div className="flex gap-1.5">
              {[
                ['', 'Todos'],
                ['PENDIENTE', 'Pendientes'],
                ['PAGADA', 'Pagados'],
              ].map(([v, l]) => (
                <button
                  key={l}
                  onClick={() => setFiltro(v)}
                  className={cx(
                    'rounded-full px-3 py-1 text-xs font-semibold transition-colors',
                    filtro === v
                      ? 'bg-carbon-800 text-white'
                      : 'bg-carbon-100 text-carbon-600 hover:bg-carbon-200',
                  )}
                >
                  {l}
                </button>
              ))}
            </div>
          }
        />
        {loading && !data ? (
          <Loading label="Cargando tickets…" />
        ) : error ? (
          <ErrorState error={error} onRetry={refetch} className="m-5" />
        ) : (
          <Table
            columns={columnas}
            rows={lista}
            empty={
              <EmptyState
                icon="🧾"
                title="Sin tickets"
                description="Los tickets se emiten desde el detalle de cada orden."
              />
            }
          />
        )}
      </Card>

      <Modal
        open={Boolean(cobrar)}
        onClose={() => setCobrar(null)}
        title={`Cobrar ticket #${cobrar?.id ?? ''}`}
        subtitle={`Mesa ${cobrar?.tableNumber ?? '—'} · Orden #${cobrar?.orderId ?? ''}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCobrar(null)}>
              Cancelar
            </Button>
            <Button variant="success" loading={saving} onClick={confirmarPago}>
              Confirmar pago
            </Button>
          </>
        }
      >
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-carbon-500">Base imponible</span>
            <span className="tabular-nums">{money(cobrar?.withoutIgv)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-carbon-500">IGV</span>
            <span className="tabular-nums">{money(cobrar?.igv)}</span>
          </div>
          <div className="flex justify-between border-t border-carbon-200 pt-2 text-lg font-bold">
            <span>Total</span>
            <span className="tabular-nums">{money(cobrar?.amount)}</span>
          </div>
        </div>
      </Modal>
    </>
  )
}
