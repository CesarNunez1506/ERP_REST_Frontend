import { useState } from 'react'
import Icon from '../components/Icon.jsx'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Loading,
  Modal,
  PageHeader,
  Select,
  Table,
  Toggle,
  useToast,
} from '../components/ui.jsx'
import { menus, stations } from '../api/endpoints.js'
import { EV } from '../api/events.js'
import { useAction, useFetch } from '../hooks/useApi.js'
import { useRealtime } from '../hooks/useRealtime.js'
import { cx, money } from '../lib/format.js'

const VACIO = { name: '', price: '', quantity: 0, stationId: '', isAvailable: true }

export default function Carta() {
  const toast = useToast()
  const { saving, run } = useAction()
  const [busqueda, setBusqueda] = useState('')
  const [editando, setEditando] = useState(null)

  const carta = useFetch((signal) => menus.list(undefined, { signal }), [])
  const estaciones = useFetch((signal) => stations.list(undefined, { signal }), [])

  // El stock baja solo cada vez que una comanda sale a cocina.
  useRealtime(EV.MENU_UPDATED, (menu) => {
    if (!menu?.id) return
    carta.setData((xs) => xs?.map((m) => (m.id === menu.id ? menu : m)))
  })

  const nombreEstacion = (id) => (estaciones.data ?? []).find((s) => s.id === id)?.name ?? '—'

  const visibles = (carta.data ?? []).filter((m) =>
    m.name.toLowerCase().includes(busqueda.toLowerCase()),
  )

  async function alternarDisponible(item) {
    // Optimista: el botón de agotar se usa en pleno servicio.
    carta.setData((xs) =>
      xs?.map((m) => (m.id === item.id ? { ...m, isAvailable: !m.isAvailable } : m)),
    )
    try {
      await run(() => menus.setAvailability(item.id, !item.isAvailable))
    } catch (err) {
      toast.error(err)
      carta.refetch()
    }
  }

  async function guardar(e) {
    e.preventDefault()
    const dto = {
      name: editando.name.trim(),
      price: Number(editando.price),
      quantity: Number(editando.quantity),
      stationId: editando.stationId ? Number(editando.stationId) : null,
      isAvailable: editando.isAvailable,
    }
    try {
      if (editando.id) {
        await run(() => menus.update(editando.id, dto))
        toast.ok('Plato actualizado')
      } else {
        await run(() => menus.create(dto))
        toast.ok('Plato agregado a la carta')
      }
      setEditando(null)
      carta.refetch()
    } catch (err) {
      toast.error(err)
    }
  }

  async function eliminar(item) {
    try {
      await run(() => menus.remove(item.id))
      toast.ok(`"${item.name}" eliminado de la carta`)
      carta.refetch()
    } catch (err) {
      toast.error(err)
    }
  }

  const columnas = [
    {
      key: 'name',
      title: 'Plato',
      render: (m) => (
        <div>
          <p className="font-semibold text-carbon-900">{m.name}</p>
          <p className="text-[11px] text-carbon-500">{nombreEstacion(m.stationId)}</p>
        </div>
      ),
    },
    {
      key: 'price',
      title: 'Precio',
      align: 'right',
      width: 120,
      render: (m) => <span className="font-medium tabular-nums">{money(m.price)}</span>,
    },
    {
      key: 'quantity',
      title: 'Stock',
      align: 'center',
      width: 100,
      render: (m) => (
        <span
          className={cx(
            'font-semibold tabular-nums',
            m.quantity === 0 ? 'text-rose-600' : m.quantity <= 5 ? 'text-amber-600' : 'text-carbon-700',
          )}
        >
          {m.quantity}
        </span>
      ),
    },
    {
      key: 'isAvailable',
      title: 'Disponible',
      align: 'center',
      width: 130,
      render: (m) => (
        <div className="flex justify-center">
          <Toggle checked={m.isAvailable} onChange={() => alternarDisponible(m)} />
        </div>
      ),
    },
    {
      key: 'acciones',
      title: '',
      align: 'right',
      width: 100,
      render: (m) => (
        <div className="flex justify-end gap-1">
          <button
            onClick={() => setEditando({ ...m, stationId: m.stationId ?? '' })}
            className="rounded-lg p-1.5 text-carbon-400 hover:bg-carbon-100 hover:text-carbon-700"
            aria-label="Editar"
          >
            <Icon name="lapiz" size={16} />
          </button>
          <button
            onClick={() => eliminar(m)}
            className="rounded-lg p-1.5 text-carbon-400 hover:bg-rose-50 hover:text-rose-600"
            aria-label="Eliminar"
          >
            <Icon name="basura" size={16} />
          </button>
        </div>
      ),
    },
  ]

  const agotados = (carta.data ?? []).filter((m) => !m.isAvailable).length

  return (
    <>
      <PageHeader
        title="Carta"
        subtitle="MENU — lo que el mozo puede agregar a una comanda"
        actions={
          <>
            {agotados > 0 && <Badge tone="warn">{agotados} agotado(s)</Badge>}
            <Button size="sm" onClick={() => setEditando({ ...VACIO })}>
              <Icon name="mas" size={15} />
              Nuevo plato
            </Button>
          </>
        }
      />

      <div className="mb-4">
        <Input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar en la carta…"
          className="max-w-sm"
        />
      </div>

      <Card>
        {carta.loading && !carta.data ? (
          <Loading label="Cargando carta…" />
        ) : carta.error ? (
          <ErrorState error={carta.error} onRetry={carta.refetch} className="m-5" />
        ) : (
          <Table
            columns={columnas}
            rows={visibles}
            empty={
              <EmptyState
                icon="📖"
                title="La carta está vacía"
                description="Agrega platos para que el salón pueda tomar pedidos."
                action={
                  <Button size="sm" onClick={() => setEditando({ ...VACIO })}>
                    Agregar plato
                  </Button>
                }
              />
            }
          />
        )}
      </Card>

      <Modal
        open={Boolean(editando)}
        onClose={() => setEditando(null)}
        title={editando?.id ? 'Editar plato' : 'Nuevo plato'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditando(null)}>
              Cancelar
            </Button>
            <Button form="form-carta" type="submit" loading={saving}>
              Guardar
            </Button>
          </>
        }
      >
        <form id="form-carta" onSubmit={guardar} className="space-y-4">
          <Field label="Nombre" required>
            <Input
              required
              value={editando?.name ?? ''}
              onChange={(e) => setEditando((m) => ({ ...m, name: e.target.value }))}
              placeholder="Ej. Lomo saltado"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Precio (S/)" required hint="Con IGV incluido, como va en carta">
              <Input
                type="number"
                step="0.10"
                min="0.1"
                required
                value={editando?.price ?? ''}
                onChange={(e) => setEditando((m) => ({ ...m, price: e.target.value }))}
              />
            </Field>
            <Field label="Stock del día" hint="MENU.quantity">
              <Input
                type="number"
                min="0"
                value={editando?.quantity ?? 0}
                onChange={(e) => setEditando((m) => ({ ...m, quantity: e.target.value }))}
              />
            </Field>
          </div>

          <Field label="Estación que lo prepara" hint="Define a qué columna del KDS llega el plato">
            <Select
              value={editando?.stationId ?? ''}
              onChange={(e) => setEditando((m) => ({ ...m, stationId: e.target.value }))}
            >
              <option value="">Sin asignar</option>
              {(estaciones.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>

          <div className="flex items-center justify-between rounded-lg bg-carbon-50 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-carbon-800">Disponible en carta</p>
              <p className="text-xs text-carbon-500">Si se apaga, el mozo no puede pedirlo</p>
            </div>
            <Toggle
              checked={editando?.isAvailable ?? true}
              onChange={(v) => setEditando((m) => ({ ...m, isAvailable: v }))}
            />
          </div>
        </form>
      </Modal>
    </>
  )
}
