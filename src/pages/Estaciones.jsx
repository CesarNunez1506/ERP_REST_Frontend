import { useState } from 'react'
import Icon from '../components/Icon.jsx'
import {
  Badge,
  Button,
  Card,
  ErrorState,
  Field,
  Input,
  Loading,
  Modal,
  PageHeader,
  Select,
  Toggle,
  useToast,
} from '../components/ui.jsx'
import { stations, workers } from '../api/endpoints.js'
import { EV, ROOM } from '../api/events.js'
import { useAction, useFetch } from '../hooks/useApi.js'
import { useRealtime, useRefetchEnEventos, useSalas } from '../hooks/useRealtime.js'
import { ROLES } from '../lib/constants.js'
import { cx, iniciales, nombreCompleto } from '../lib/format.js'

const VACIA = { name: '', workerId: '', isAvailable: true }

export default function Estaciones() {
  const toast = useToast()
  const { saving, run } = useAction()
  const [editando, setEditando] = useState(null)

  const lista = useFetch((signal) => stations.list(undefined, { signal }), [], {
    refetchInterval: 120_000,
  })

  useSalas(ROOM.COCINA)

  useRealtime(EV.STATION_UPDATED, (est) => {
    if (!est?.id) return
    lista.setData((xs) => xs?.map((s) => (s.id === est.id ? est : s)))
  })

  // `platesInQueue` lo calcula el servidor: cada plato que se mueve lo cambia.
  useRefetchEnEventos([EV.PLATE_CREATED, EV.PLATE_UPDATED, EV.PLATE_DELETED], lista.refetch)
  const cocineros = useFetch(
    (signal) => workers.list({ role: ROLES.COCINERO }, { signal }),
    [],
  )
  const todos = useFetch((signal) => workers.list(undefined, { signal }), [])

  async function guardar(e) {
    e.preventDefault()
    const dto = {
      name: editando.name.trim(),
      workerId: editando.workerId ? Number(editando.workerId) : null,
      isAvailable: editando.isAvailable,
    }
    try {
      if (editando.id) {
        await run(() => stations.update(editando.id, dto))
        toast.ok('Estación actualizada')
      } else {
        await run(() => stations.create(dto))
        toast.ok('Estación creada')
      }
      setEditando(null)
      lista.refetch()
    } catch (err) {
      toast.error(err)
    }
  }

  async function alternar(est) {
    lista.setData((xs) =>
      xs?.map((s) => (s.id === est.id ? { ...s, isAvailable: !s.isAvailable } : s)),
    )
    try {
      await run(() => stations.update(est.id, { isAvailable: !est.isAvailable }))
    } catch (err) {
      toast.error(err)
      lista.refetch()
    }
  }

  async function eliminar(est) {
    try {
      await run(() => stations.remove(est.id))
      toast.ok(`Estación "${est.name}" eliminada`)
      lista.refetch()
    } catch (err) {
      toast.error(err)
    }
  }

  return (
    <>
      <PageHeader
        title="Estaciones"
        subtitle="STATION — cada plato de la comanda se despacha a una estación (PLATE N:1 STATION)"
        actions={
          <Button size="sm" onClick={() => setEditando({ ...VACIA })}>
            <Icon name="mas" size={15} />
            Nueva estación
          </Button>
        }
      />

      {lista.loading && !lista.data ? (
        <Loading label="Cargando estaciones…" />
      ) : lista.error ? (
        <ErrorState error={lista.error} onRetry={lista.refetch} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {(lista.data ?? []).map((s) => (
            <Card key={s.id} className={cx('p-5', !s.isAvailable && 'opacity-60')}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-base font-bold text-carbon-900">{s.name}</h3>
                  <Badge tone={s.isAvailable ? 'ok' : 'neutral'} className="mt-1.5">
                    {s.isAvailable ? 'Operativa' : 'Cerrada'}
                  </Badge>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => setEditando({ ...s, workerId: s.workerId ?? '' })}
                    className="rounded-lg p-1.5 text-carbon-400 hover:bg-carbon-100 hover:text-carbon-700"
                    aria-label="Editar"
                  >
                    <Icon name="lapiz" size={16} />
                  </button>
                  <button
                    onClick={() => eliminar(s)}
                    className="rounded-lg p-1.5 text-carbon-400 hover:bg-rose-50 hover:text-rose-600"
                    aria-label="Eliminar"
                  >
                    <Icon name="basura" size={16} />
                  </button>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-3 rounded-lg bg-carbon-50 px-3 py-2.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-carbon-800 text-xs font-bold text-white">
                  {s.worker ? iniciales(s.worker) : '—'}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-carbon-800">
                    {s.worker ? nombreCompleto(s.worker) : 'Sin responsable'}
                  </p>
                  <p className="text-[11px] text-carbon-500">STATION.worker_id</p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-carbon-900 tabular-nums">
                    {s.platesInQueue ?? 0}
                  </p>
                  <p className="text-[11px] text-carbon-500">platos en cola</p>
                </div>
                <Toggle
                  checked={s.isAvailable}
                  onChange={() => alternar(s)}
                  label={s.isAvailable ? 'Abierta' : 'Cerrada'}
                />
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(editando)}
        onClose={() => setEditando(null)}
        title={editando?.id ? 'Editar estación' : 'Nueva estación'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditando(null)}>
              Cancelar
            </Button>
            <Button form="form-estacion" type="submit" loading={saving}>
              Guardar
            </Button>
          </>
        }
      >
        <form id="form-estacion" onSubmit={guardar} className="space-y-4">
          <Field label="Nombre" required hint="Ej. Parrilla, Cocina caliente, Barra">
            <Input
              required
              value={editando?.name ?? ''}
              onChange={(s) => setEditando((x) => ({ ...x, name: s.target.value }))}
            />
          </Field>

          <Field label="Responsable" hint="Normalmente un cocinero; puede quedar sin asignar">
            <Select
              value={editando?.workerId ?? ''}
              onChange={(e) => setEditando((x) => ({ ...x, workerId: e.target.value }))}
            >
              <option value="">Sin asignar</option>
              <optgroup label="Cocineros">
                {(cocineros.data ?? []).map((w) => (
                  <option key={w.id} value={w.id}>
                    {nombreCompleto(w)}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Otros">
                {(todos.data ?? [])
                  .filter((w) => w.role !== ROLES.COCINERO)
                  .map((w) => (
                    <option key={w.id} value={w.id}>
                      {nombreCompleto(w)} ({w.role})
                    </option>
                  ))}
              </optgroup>
            </Select>
          </Field>

          <div className="flex items-center justify-between rounded-lg bg-carbon-50 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-carbon-800">Estación operativa</p>
              <p className="text-xs text-carbon-500">Si se cierra, no recibe platos nuevos</p>
            </div>
            <Toggle
              checked={editando?.isAvailable ?? true}
              onChange={(v) => setEditando((x) => ({ ...x, isAvailable: v }))}
            />
          </div>
        </form>
      </Modal>
    </>
  )
}
