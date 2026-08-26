import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../components/Icon.jsx'
import CroquisLienzo from '../components/croquis/CroquisLienzo.jsx'
import {
  Badge,
  Button,
  Card,
  Dot,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Loading,
  Modal,
  PageHeader,
  Select,
  useToast,
} from '../components/ui.jsx'
import { croquis as croquisApi, orders, tables, workers } from '../api/endpoints.js'
import { EV, ROOM } from '../api/events.js'
import { useAction, useFetch } from '../hooks/useApi.js'
import { useRealtime, useRefetchEnEventos, useSalas } from '../hooks/useRealtime.js'
import { ROLES, TABLE_STATUS_LABEL, TABLE_STATUS_TONE } from '../lib/constants.js'
import { normalizarCroquis } from '../lib/croquis.js'
import { cx } from '../lib/format.js'

const ESTILO_MESA = {
  LIBRE: 'border-emerald-200 bg-emerald-50/60 hover:border-emerald-400',
  OCUPADA: 'border-amber-200 bg-amber-50/60 hover:border-amber-400',
  POR_COBRAR: 'border-sky-200 bg-sky-50/60 hover:border-sky-400',
}

function MesaCard({ mesa, onClick }) {
  return (
    <button
      onClick={() => onClick(mesa)}
      className={cx(
        'flex aspect-square flex-col items-center justify-center gap-1.5 rounded-2xl border-2 p-3 transition-all',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brasa-500',
        ESTILO_MESA[mesa.status] ?? 'border-carbon-200 bg-white',
      )}
    >
      <span className="text-[10px] font-semibold tracking-wide text-carbon-500 uppercase">
        Mesa
      </span>
      <span className="text-3xl leading-none font-bold text-carbon-900 tabular-nums">
        {mesa.number}
      </span>
      <span className="flex items-center gap-1 text-[11px] text-carbon-500">
        <Icon name="personal" size={12} />
        {mesa.capacityPersons}
      </span>
      <Badge tone={TABLE_STATUS_TONE[mesa.status]} className="mt-0.5">
        {TABLE_STATUS_LABEL[mesa.status]}
      </Badge>
      {mesa.currentOrderId && (
        <span className="text-[10px] text-carbon-400">#{mesa.currentOrderId}</span>
      )}
    </button>
  )
}

export default function Mesas() {
  const toast = useToast()
  const navigate = useNavigate()
  const { saving, run } = useAction()

  const [vista, setVista] = useState('plano') // 'plano' = croquis · 'lista' = cuadrícula
  const [filtro, setFiltro] = useState('')
  const [abrir, setAbrir] = useState(null) // mesa sobre la que se abre orden
  const [mozoId, setMozoId] = useState('')
  const [nuevaMesa, setNuevaMesa] = useState(null)

  const mesas = useFetch((signal) => tables.list(undefined, { signal }), [], {
    refetchInterval: 120_000,
  })
  const mozos = useFetch((signal) => workers.list({ role: ROLES.MOZO }, { signal }), [])
  const local = useFetch((signal) => croquisApi.get({ signal }), [])

  useSalas(ROOM.SALON)

  // TABLE.updated ya trae la mesa completa con su status recalculado: se
  // reemplaza en sitio y el plano se repinta sin volver a pedir todo el salón.
  useRealtime(EV.TABLE_UPDATED, (mesa) => {
    if (!mesa?.id) return
    mesas.setData((xs) => {
      if (!xs) return xs
      return xs.some((m) => m.id === mesa.id)
        ? xs.map((m) => (m.id === mesa.id ? mesa : m))
        : [...xs, mesa].sort((a, b) => a.number - b.number)
    })
  })

  // Alta o baja de mesas sí requieren releer la lista.
  useRefetchEnEventos([EV.ORDER_DELETED], mesas.refetch)

  // Si alguien reacomoda el local desde el editor, el plano se actualiza solo.
  useRealtime(EV.CROQUIS_UPDATED, (payload) => local.setData(payload))

  const plano = useMemo(
    () => normalizarCroquis(local.data?.drawCroquisLocal),
    [local.data],
  )

  const mesasPorId = useMemo(
    () => Object.fromEntries((mesas.data ?? []).map((m) => [m.id, m])),
    [mesas.data],
  )

  const ubicadas = useMemo(
    () => new Set(plano.tables.map((m) => m.tableId).filter(Boolean)),
    [plano],
  )

  const sinUbicar = (mesas.data ?? []).filter((m) => !ubicadas.has(m.id))
  const hayCroquis = plano.tables.length > 0 || plano.walls.length > 0

  const visibles = (mesas.data ?? []).filter((m) => !filtro || m.status === filtro)

  const conteo = (estado) => (mesas.data ?? []).filter((m) => m.status === estado).length

  async function clicMesa(mesa) {
    if (mesa.status === 'LIBRE') {
      setMozoId(String(mozos.data?.[0]?.id ?? ''))
      setAbrir(mesa)
    } else if (mesa.currentOrderId) {
      navigate(`/ordenes/${mesa.currentOrderId}`)
    }
  }

  async function crearOrden(e) {
    e.preventDefault()
    try {
      const orden = await run(() =>
        orders.create({ tableId: abrir.id, workerId: Number(mozoId) }),
      )
      toast.ok(`Orden #${orden.id} abierta en la mesa ${abrir.number}`)
      setAbrir(null)
      navigate(`/ordenes/${orden.id}`)
    } catch (err) {
      toast.error(err)
    }
  }

  async function crearMesa(e) {
    e.preventDefault()
    try {
      await run(() =>
        tables.create({
          number: Number(nuevaMesa.number),
          capacityPersons: Number(nuevaMesa.capacityPersons),
        }),
      )
      toast.ok(`Mesa ${nuevaMesa.number} registrada`)
      setNuevaMesa(null)
      mesas.refetch()
    } catch (err) {
      toast.error(err)
    }
  }

  return (
    <>
      <PageHeader
        title="Salón"
        subtitle="Toca una mesa libre para abrir una orden, o una ocupada para verla"
        actions={
          <>
            <div className="flex rounded-lg bg-carbon-100 p-0.5">
              {[
                ['plano', 'Plano', 'estaciones'],
                ['lista', 'Cuadrícula', 'panel'],
              ].map(([v, label, icono]) => (
                <button
                  key={v}
                  onClick={() => setVista(v)}
                  className={cx(
                    'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                    vista === v ? 'bg-white text-carbon-900 shadow-sm' : 'text-carbon-500',
                  )}
                >
                  <Icon name={icono} size={14} />
                  {label}
                </button>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate('/mesas/croquis')}>
              <Icon name="lapiz" size={15} />
              Editar croquis
            </Button>
            <Button
              size="sm"
              onClick={() => setNuevaMesa({ number: '', capacityPersons: 4 })}
            >
              <Icon name="mas" size={15} />
              Nueva mesa
            </Button>
          </>
        }
      />

      {/* En el plano se muestran siempre todas las mesas: los chips son leyenda,
          no filtro. En la cuadrícula sí filtran. */}
      <div className="mb-5 flex flex-wrap gap-2">
        {[
          ['', 'Todas', mesas.data?.length ?? 0, 'neutral'],
          ['LIBRE', 'Libres', conteo('LIBRE'), 'ok'],
          ['OCUPADA', 'Ocupadas', conteo('OCUPADA'), 'warn'],
          ['POR_COBRAR', 'Por cobrar', conteo('POR_COBRAR'), 'info'],
        ].map(([valor, label, n, tone]) =>
          vista === 'plano' ? (
            valor && (
              <span
                key={label}
                className="inline-flex items-center gap-2 rounded-full border border-carbon-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-carbon-600"
              >
                <Dot tone={tone} />
                {label}
                <span className="tabular-nums opacity-70">{n}</span>
              </span>
            )
          ) : (
            <button
              key={label}
              onClick={() => setFiltro(valor)}
              className={cx(
                'inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors',
                filtro === valor
                  ? 'border-carbon-800 bg-carbon-800 text-white'
                  : 'border-carbon-200 bg-white text-carbon-600 hover:border-carbon-300',
              )}
            >
              {valor && <Dot tone={tone} />}
              {label}
              <span className="tabular-nums opacity-70">{n}</span>
            </button>
          ),
        )}
      </div>

      {mesas.loading && !mesas.data ? (
        <Loading label="Cargando salón…" />
      ) : mesas.error ? (
        <ErrorState error={mesas.error} onRetry={mesas.refetch} />
      ) : vista === 'plano' ? (
        hayCroquis ? (
          <>
            <Card className="overflow-hidden p-0">
              <div className="overflow-x-auto bg-carbon-100 p-3">
                <div className="min-w-[680px]">
                  <CroquisLienzo
                    croquis={plano}
                    mesasPorId={mesasPorId}
                    modo="vista"
                    onMesaClick={clicMesa}
                    className="rounded-lg border border-carbon-300 bg-white shadow-sm"
                  />
                </div>
              </div>
            </Card>
            {sinUbicar.length > 0 && (
              <Card className="mt-4 flex flex-wrap items-center gap-3 p-4">
                <Badge tone="warn">{sinUbicar.length} sin ubicar</Badge>
                <p className="flex-1 text-xs text-carbon-600">
                  Estas mesas existen pero todavía no están dibujadas en el croquis:{' '}
                  <strong>{sinUbicar.map((m) => `N.º ${m.number}`).join(', ')}</strong>
                </p>
                <Button variant="outline" size="sm" onClick={() => navigate('/mesas/croquis')}>
                  Ubicarlas
                </Button>
              </Card>
            )}
          </>
        ) : (
          <EmptyState
            icon="📐"
            title="Todavía no hay croquis del local"
            description="Dibuja las paredes, ubica las mesas y coloca las sillas para ver el salón como es en realidad."
            action={
              <Button size="sm" onClick={() => navigate('/mesas/croquis')}>
                <Icon name="lapiz" size={15} />
                Dibujar el croquis
              </Button>
            }
          />
        )
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
          {visibles.map((m) => (
            <MesaCard key={m.id} mesa={m} onClick={clicMesa} />
          ))}
        </div>
      )}

      {/* Abrir orden */}
      <Modal
        open={Boolean(abrir)}
        onClose={() => setAbrir(null)}
        title={`Abrir orden — Mesa ${abrir?.number ?? ''}`}
        subtitle={`Capacidad ${abrir?.capacityPersons ?? ''} personas`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAbrir(null)}>
              Cancelar
            </Button>
            <Button form="form-orden" type="submit" loading={saving}>
              Abrir orden
            </Button>
          </>
        }
      >
        <form id="form-orden" onSubmit={crearOrden} className="space-y-4">
          <Field label="Mozo a cargo" required hint="ORDER.worker_id — quién atiende la mesa">
            <Select value={mozoId} onChange={(e) => setMozoId(e.target.value)} required>
              <option value="" disabled>
                Selecciona un mozo…
              </option>
              {(mozos.data ?? []).map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} {w.lastname} · {w.startWork}–{w.endWork}
                </option>
              ))}
            </Select>
          </Field>
          <Card className="bg-carbon-50 p-4 text-xs text-carbon-600">
            La orden se crea en estado <strong>ABIERTA</strong>. Los platos se agregan en el
            detalle y recién al enviarlos a cocina se sella su <code>send_time</code>, que es lo
            que arranca el SLA.
          </Card>
        </form>
      </Modal>

      {/* Nueva mesa */}
      <Modal
        open={Boolean(nuevaMesa)}
        onClose={() => setNuevaMesa(null)}
        title="Nueva mesa"
        footer={
          <>
            <Button variant="ghost" onClick={() => setNuevaMesa(null)}>
              Cancelar
            </Button>
            <Button form="form-mesa" type="submit" loading={saving}>
              Guardar
            </Button>
          </>
        }
      >
        <form id="form-mesa" onSubmit={crearMesa} className="grid grid-cols-2 gap-4">
          <Field label="Número" required>
            <Input
              type="number"
              min="1"
              required
              value={nuevaMesa?.number ?? ''}
              onChange={(e) => setNuevaMesa((m) => ({ ...m, number: e.target.value }))}
            />
          </Field>
          <Field label="Capacidad" required hint="Personas">
            <Input
              type="number"
              min="1"
              required
              value={nuevaMesa?.capacityPersons ?? ''}
              onChange={(e) => setNuevaMesa((m) => ({ ...m, capacityPersons: e.target.value }))}
            />
          </Field>
        </form>
      </Modal>
    </>
  )
}
