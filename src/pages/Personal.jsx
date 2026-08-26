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
  useToast,
} from '../components/ui.jsx'
import { workers } from '../api/endpoints.js'
import { useAction, useFetch } from '../hooks/useApi.js'
import { ROLES, ROLE_LABEL } from '../lib/constants.js'
import { cx, iniciales, nombreCompleto } from '../lib/format.js'

const VACIO = { name: '', lastname: '', role: ROLES.MOZO, startWork: '11:00', endWork: '20:00' }

const TONO_ROL = {
  ADMIN: 'brand',
  MOZO: 'info',
  COCINERO: 'warn',
  CAJERO: 'ok',
}

export default function Personal() {
  const toast = useToast()
  const { saving, run } = useAction()
  const [rol, setRol] = useState('')
  const [editando, setEditando] = useState(null)

  const lista = useFetch(
    (signal) => workers.list(rol ? { role: rol } : undefined, { signal }),
    [rol],
  )

  async function guardar(e) {
    e.preventDefault()
    const dto = {
      name: editando.name.trim(),
      lastname: editando.lastname.trim(),
      role: editando.role,
      startWork: editando.startWork,
      endWork: editando.endWork,
    }
    try {
      if (editando.id) {
        await run(() => workers.update(editando.id, dto))
        toast.ok('Trabajador actualizado')
      } else {
        await run(() => workers.create(dto))
        toast.ok('Trabajador registrado')
      }
      setEditando(null)
      lista.refetch()
    } catch (err) {
      toast.error(err)
    }
  }

  async function eliminar(w) {
    try {
      await run(() => workers.remove(w.id))
      toast.ok(`${nombreCompleto(w)} dado de baja`)
      lista.refetch()
    } catch (err) {
      toast.error(err)
    }
  }

  const columnas = [
    {
      key: 'name',
      title: 'Trabajador',
      render: (w) => (
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-carbon-800 text-xs font-bold text-white">
            {iniciales(w)}
          </span>
          <div>
            <p className="font-semibold text-carbon-900">{nombreCompleto(w)}</p>
            <p className="text-[11px] text-carbon-500">ID {w.id}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      title: 'Rol',
      width: 150,
      render: (w) => <Badge tone={TONO_ROL[w.role]}>{ROLE_LABEL[w.role] ?? w.role}</Badge>,
    },
    {
      key: 'turno',
      title: 'Turno',
      width: 180,
      render: (w) => (
        <span className="inline-flex items-center gap-1.5 text-carbon-600 tabular-nums">
          <Icon name="reloj" size={14} className="text-carbon-400" />
          {w.startWork} — {w.endWork}
        </span>
      ),
    },
    {
      key: 'acciones',
      title: '',
      align: 'right',
      width: 100,
      render: (w) => (
        <div className="flex justify-end gap-1">
          <button
            onClick={() => setEditando({ ...w })}
            className="rounded-lg p-1.5 text-carbon-400 hover:bg-carbon-100 hover:text-carbon-700"
            aria-label="Editar"
          >
            <Icon name="lapiz" size={16} />
          </button>
          <button
            onClick={() => eliminar(w)}
            className="rounded-lg p-1.5 text-carbon-400 hover:bg-rose-50 hover:text-rose-600"
            aria-label="Dar de baja"
          >
            <Icon name="basura" size={16} />
          </button>
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Personal"
        subtitle="WORKER — mozos, cocineros, cajeros y administración"
        actions={
          <Button size="sm" onClick={() => setEditando({ ...VACIO })}>
            <Icon name="mas" size={15} />
            Nuevo trabajador
          </Button>
        }
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {[['', 'Todos'], ...Object.values(ROLES).map((r) => [r, ROLE_LABEL[r]])].map(([v, l]) => (
          <button
            key={l}
            onClick={() => setRol(v)}
            className={cx(
              'rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors',
              rol === v
                ? 'border-carbon-800 bg-carbon-800 text-white'
                : 'border-carbon-200 bg-white text-carbon-600 hover:border-carbon-300',
            )}
          >
            {l}
          </button>
        ))}
      </div>

      <Card>
        {lista.loading && !lista.data ? (
          <Loading label="Cargando personal…" />
        ) : lista.error ? (
          <ErrorState error={lista.error} onRetry={lista.refetch} className="m-5" />
        ) : (
          <Table
            columns={columnas}
            rows={lista.data ?? []}
            empty={<EmptyState icon="👥" title="Sin trabajadores con este rol" />}
          />
        )}
      </Card>

      <Modal
        open={Boolean(editando)}
        onClose={() => setEditando(null)}
        title={editando?.id ? 'Editar trabajador' : 'Nuevo trabajador'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditando(null)}>
              Cancelar
            </Button>
            <Button form="form-worker" type="submit" loading={saving}>
              Guardar
            </Button>
          </>
        }
      >
        <form id="form-worker" onSubmit={guardar} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Nombres" required>
              <Input
                required
                value={editando?.name ?? ''}
                onChange={(e) => setEditando((w) => ({ ...w, name: e.target.value }))}
              />
            </Field>
            <Field label="Apellidos" required>
              <Input
                required
                value={editando?.lastname ?? ''}
                onChange={(e) => setEditando((w) => ({ ...w, lastname: e.target.value }))}
              />
            </Field>
          </div>

          <Field label="Rol" required hint="WORKER.role (enum)">
            <Select
              value={editando?.role ?? ROLES.MOZO}
              onChange={(e) => setEditando((w) => ({ ...w, role: e.target.value }))}
            >
              {Object.values(ROLES).map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Inicio de turno" required hint="WORKER.start_work">
              <Input
                type="time"
                required
                value={editando?.startWork ?? ''}
                onChange={(e) => setEditando((w) => ({ ...w, startWork: e.target.value }))}
              />
            </Field>
            <Field label="Fin de turno" required hint="WORKER.end_work">
              <Input
                type="time"
                required
                value={editando?.endWork ?? ''}
                onChange={(e) => setEditando((w) => ({ ...w, endWork: e.target.value }))}
              />
            </Field>
          </div>
        </form>
      </Modal>
    </>
  )
}
