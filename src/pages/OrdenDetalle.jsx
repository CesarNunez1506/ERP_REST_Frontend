import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Icon from '../components/Icon.jsx'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Loading,
  Modal,
  PageHeader,
  Select,
  Textarea,
  useToast,
} from '../components/ui.jsx'
import { menus, orders, plates, stations, tickets } from '../api/endpoints.js'
import { EV, GRUPOS, ROOM } from '../api/events.js'
import { useAction, useFetch } from '../hooks/useApi.js'
import { useRealtime, useSalas } from '../hooks/useRealtime.js'
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TONE,
  PLATE_STATUS_LABEL,
  PLATE_STATUS_TONE,
  TICKET_STATUS_LABEL,
  TICKET_STATUS_TONE,
} from '../lib/constants.js'
import { cx, desgloseIgv, hora, money, nombreCompleto } from '../lib/format.js'

const PLATO_VACIO = { menuId: '', quantityDispend: 1, comment: '', stationId: '' }

export default function OrdenDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { saving, run } = useAction()

  const [nuevo, setNuevo] = useState(null)
  const [cobrando, setCobrando] = useState(false)

  const orden = useFetch((signal) => orders.get(id, { signal }), [id], {
    refetchInterval: 120_000,
  })
  const carta = useFetch((signal) => menus.list({ isAvailable: 'true' }, { signal }), [])
  const estaciones = useFetch((signal) => stations.list(undefined, { signal }), [])

  // Solo esta orden: el mozo no necesita el tráfico de las demás mesas.
  useSalas(ROOM.orden(id))

  const rezagado = useRef(null)

  useRealtime(GRUPOS.orden, (payload, evento) => {
    // `order.*` trae la orden (id); `plate.*` y `ticket.*` traen orderId.
    const esDeEstaOrden =
      String(payload?.id) === String(id) || String(payload?.orderId) === String(id)
    if (!esDeEstaOrden) return

    if (evento === EV.ORDER_UPDATED || evento === EV.ORDER_SENT) {
      // Llega la orden completa (con plates y ticket): se pinta directo.
      orden.setData(payload)
      clearTimeout(rezagado.current)
      return
    }
    // Un plato o el ticket cambiaron por su cuenta: se relee la orden, dando
    // margen para que las ráfagas (enviar 4 platos a la vez) colapsen en una.
    clearTimeout(rezagado.current)
    rezagado.current = setTimeout(() => orden.refetch({ silencioso: true }), 250)
  })

  useEffect(() => () => clearTimeout(rezagado.current), [])

  // La carta cambia sola cuando cocina agota un plato mientras se toma el pedido.
  useRealtime(EV.MENU_UPDATED, () => carta.refetch({ silencioso: true }))

  const o = orden.data
  const listaPlatos = o?.plates ?? []
  const sinEnviar = listaPlatos.filter((p) => !p.sendTime && p.status !== 'ANULADO')
  const cerrada = ['CERRADA', 'ANULADA'].includes(o?.status)

  const menuSeleccionado = useMemo(
    () => (carta.data ?? []).find((m) => String(m.id) === String(nuevo?.menuId)),
    [carta.data, nuevo?.menuId],
  )

  const desglose = desgloseIgv(o?.ticket?.amount ?? o?.total ?? 0)

  async function agregarPlato(e) {
    e.preventDefault()
    try {
      await run(() =>
        plates.create({
          orderId: Number(id),
          menuId: Number(nuevo.menuId),
          quantityDispend: Number(nuevo.quantityDispend),
          comment: nuevo.comment.trim(),
          stationId: nuevo.stationId ? Number(nuevo.stationId) : undefined,
        }),
      )
      toast.ok('Plato agregado a la comanda')
      setNuevo(null)
      orden.refetch()
    } catch (err) {
      toast.error(err)
    }
  }

  async function quitarPlato(plato) {
    try {
      await run(() => plates.remove(plato.id))
      toast.ok('Plato retirado de la comanda')
      orden.refetch()
    } catch (err) {
      toast.error(err)
    }
  }

  async function enviarACocina() {
    try {
      await run(() => orders.send(id))
      toast.ok(`${sinEnviar.length} plato(s) enviados a cocina`)
      orden.refetch()
    } catch (err) {
      toast.error(err)
    }
  }

  async function emitirTicket() {
    try {
      const t = await run(() => tickets.create({ orderId: Number(id) }))
      toast.ok(`Ticket #${t.id} emitido por ${money(t.amount)}`)
      orden.refetch()
    } catch (err) {
      toast.error(err)
    }
  }

  async function cobrar() {
    try {
      await run(() => tickets.pay(o.ticket.id))
      toast.ok('Ticket pagado. La mesa quedó libre.')
      setCobrando(false)
      orden.refetch()
    } catch (err) {
      toast.error(err)
    }
  }

  if (orden.loading && !o) return <Loading label="Cargando orden…" />
  if (orden.error && !o) return <ErrorState error={orden.error} onRetry={orden.refetch} />
  if (!o) return null

  return (
    <>
      <PageHeader
        title={`Orden #${o.id}`}
        subtitle={
          <>
            Mesa {o.table?.number} · {nombreCompleto(o.worker)}
          </>
        }
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={() => navigate('/ordenes')}>
              <Icon name="atras" size={15} />
              Volver
            </Button>
            {!cerrada && (
              <Button variant="outline" size="sm" onClick={() => setNuevo(PLATO_VACIO)}>
                <Icon name="mas" size={15} />
                Agregar plato
              </Button>
            )}
            {sinEnviar.length > 0 && (
              <Button size="sm" loading={saving} onClick={enviarACocina}>
                <Icon name="enviar" size={15} />
                Enviar a cocina ({sinEnviar.length})
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Comanda */}
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader
              title="Comanda"
              subtitle="PLATE — cada línea es un plato despachado a una estación"
              actions={
                <Badge tone={ORDER_STATUS_TONE[o.status]}>{ORDER_STATUS_LABEL[o.status]}</Badge>
              }
            />
            {listaPlatos.length === 0 ? (
              <EmptyState
                icon="🍽️"
                title="La comanda está vacía"
                description="Agrega platos de la carta y luego envíalos a cocina."
                action={
                  <Button size="sm" onClick={() => setNuevo(PLATO_VACIO)}>
                    Agregar el primer plato
                  </Button>
                }
              />
            ) : (
              <ul className="divide-y divide-carbon-100">
                {listaPlatos.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-carbon-100 text-sm font-bold text-carbon-700 tabular-nums">
                      {p.quantityDispend}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-carbon-900">
                        {p.menu?.name ?? `Menú #${p.menuId}`}
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-carbon-500">
                        <span>{p.station?.name ?? 'Sin estación'}</span>
                        <span>·</span>
                        <span>{money(p.unitPrice)} c/u</span>
                        {p.sendTime ? (
                          <>
                            <span>·</span>
                            <span>enviado {hora(p.sendTime)}</span>
                          </>
                        ) : (
                          <>
                            <span>·</span>
                            <span className="font-medium text-amber-600">sin enviar</span>
                          </>
                        )}
                        {p.sla != null && (
                          <>
                            <span>·</span>
                            <span
                              className={cx(
                                'font-semibold',
                                p.sla >= 15 ? 'text-rose-600' : 'text-carbon-600',
                              )}
                            >
                              SLA {p.sla} min
                            </span>
                          </>
                        )}
                      </p>
                      {p.comment && (
                        <p className="mt-1 rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
                          “{p.comment}”
                        </p>
                      )}
                    </div>
                    <Badge tone={PLATE_STATUS_TONE[p.status]}>{PLATE_STATUS_LABEL[p.status]}</Badge>
                    <span className="w-20 text-right text-sm font-semibold text-carbon-900 tabular-nums">
                      {money(p.subtotal)}
                    </span>
                    {!p.sendTime && !cerrada && (
                      <button
                        onClick={() => quitarPlato(p)}
                        disabled={saving}
                        className="rounded-lg p-1.5 text-carbon-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
                        aria-label="Quitar plato"
                      >
                        <Icon name="basura" size={16} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {/* Cuenta */}
        <div className="space-y-5">
          <Card>
            <CardHeader title="Cuenta" subtitle="ORDER_TICKET 1:1 ORDER" />
            <div className="space-y-3 p-5">
              <div className="flex justify-between text-sm">
                <span className="text-carbon-500">Subtotal (sin IGV)</span>
                <span className="font-medium tabular-nums">{money(desglose.base)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-carbon-500">IGV ({(desglose.tasa * 100).toFixed(0)}%)</span>
                <span className="font-medium tabular-nums">{money(desglose.igv)}</span>
              </div>
              <div className="flex justify-between border-t border-carbon-200 pt-3 text-base">
                <span className="font-semibold text-carbon-900">Total</span>
                <span className="text-xl font-bold text-carbon-900 tabular-nums">
                  {money(desglose.total)}
                </span>
              </div>

              {o.ticket ? (
                <div className="space-y-3 rounded-lg bg-carbon-50 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-carbon-500">Ticket #{o.ticket.id}</span>
                    <Badge tone={TICKET_STATUS_TONE[o.ticket.status]}>
                      {TICKET_STATUS_LABEL[o.ticket.status]}
                    </Badge>
                  </div>
                  {o.ticket.status === 'PENDIENTE' && (
                    <Button
                      variant="success"
                      className="w-full"
                      loading={saving}
                      onClick={() => setCobrando(true)}
                    >
                      <Icon name="billete" size={16} />
                      Cobrar {money(o.ticket.amount)}
                    </Button>
                  )}
                  {o.ticket.status === 'PAGADA' && (
                    <p className="text-center text-xs text-emerald-700">
                      Pagado a las {hora(o.ticket.paidAt)}
                    </p>
                  )}
                </div>
              ) : (
                <Button
                  variant="dark"
                  className="w-full"
                  loading={saving}
                  disabled={!listaPlatos.length || cerrada}
                  onClick={emitirTicket}
                >
                  <Icon name="caja" size={16} />
                  Emitir ticket
                </Button>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Datos de la orden" />
            <dl className="divide-y divide-carbon-100 text-sm">
              {[
                ['Mesa', `N.º ${o.table?.number} (${o.table?.capacityPersons} pers.)`],
                ['Mozo', nombreCompleto(o.worker)],
                ['Estado', ORDER_STATUS_LABEL[o.status]],
                ['Platos', `${o.plateCount}`],
                ['Apertura', hora(o.createdAt)],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between px-5 py-2.5">
                  <dt className="text-carbon-500">{k}</dt>
                  <dd className="font-medium text-carbon-900">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="border-t border-carbon-100 px-5 py-3">
              <Link
                to="/cocina"
                className="text-xs font-semibold text-brasa-600 hover:text-brasa-700"
              >
                Ver estos platos en el KDS →
              </Link>
            </div>
          </Card>
        </div>
      </div>

      {/* Agregar plato */}
      <Modal
        open={Boolean(nuevo)}
        onClose={() => setNuevo(null)}
        title="Agregar plato a la comanda"
        subtitle="Solo aparece la carta disponible (MENU.is_available)"
        footer={
          <>
            <Button variant="ghost" onClick={() => setNuevo(null)}>
              Cancelar
            </Button>
            <Button form="form-plato" type="submit" loading={saving}>
              Agregar
            </Button>
          </>
        }
      >
        <form id="form-plato" onSubmit={agregarPlato} className="space-y-4">
          <Field label="Plato de la carta" required>
            <Select
              value={nuevo?.menuId ?? ''}
              onChange={(e) => setNuevo((n) => ({ ...n, menuId: e.target.value, stationId: '' }))}
              required
            >
              <option value="" disabled>
                Selecciona…
              </option>
              {(carta.data ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} — {money(m.price)} ({m.quantity} disp.)
                </option>
              ))}
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Cantidad" required hint="PLATE.quantity_dispend">
              <Input
                type="number"
                min="1"
                required
                value={nuevo?.quantityDispend ?? 1}
                onChange={(e) => setNuevo((n) => ({ ...n, quantityDispend: e.target.value }))}
              />
            </Field>
            <Field label="Estación" hint="Por defecto, la de la carta">
              <Select
                value={nuevo?.stationId ?? ''}
                onChange={(e) => setNuevo((n) => ({ ...n, stationId: e.target.value }))}
              >
                <option value="">
                  {menuSeleccionado
                    ? (estaciones.data ?? []).find((s) => s.id === menuSeleccionado.stationId)
                        ?.name ?? 'Automática'
                    : 'Automática'}
                </option>
                {(estaciones.data ?? [])
                  .filter((s) => s.isAvailable)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </Select>
            </Field>
          </div>

          <Field label="Nota para cocina" hint="PLATE.comment — ej. sin cebolla, término medio">
            <Textarea
              rows={2}
              value={nuevo?.comment ?? ''}
              onChange={(e) => setNuevo((n) => ({ ...n, comment: e.target.value }))}
              placeholder="Opcional"
            />
          </Field>

          {menuSeleccionado && (
            <div className="flex items-center justify-between rounded-lg bg-brasa-50 px-4 py-3 text-sm">
              <span className="text-brasa-800">Subtotal de la línea</span>
              <span className="font-bold text-brasa-900 tabular-nums">
                {money(menuSeleccionado.price * Number(nuevo?.quantityDispend || 0))}
              </span>
            </div>
          )}
        </form>
      </Modal>

      {/* Confirmar cobro */}
      <Modal
        open={cobrando}
        onClose={() => setCobrando(false)}
        title="Confirmar cobro"
        subtitle={`Ticket #${o.ticket?.id} — Mesa ${o.table?.number}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCobrando(false)}>
              Cancelar
            </Button>
            <Button variant="success" loading={saving} onClick={cobrar}>
              Marcar como pagado
            </Button>
          </>
        }
      >
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-carbon-500">Base imponible</span>
            <span className="tabular-nums">{money(o.ticket?.withoutIgv ?? 0)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-carbon-500">IGV</span>
            <span className="tabular-nums">
              {money((o.ticket?.amount ?? 0) - (o.ticket?.withoutIgv ?? 0))}
            </span>
          </div>
          <div className="flex justify-between border-t border-carbon-200 pt-2 text-base font-bold">
            <span>Total a cobrar</span>
            <span className="tabular-nums">{money(o.ticket?.amount ?? 0)}</span>
          </div>
          <p className="pt-2 text-xs text-carbon-500">
            Al confirmar, la orden pasa a <strong>CERRADA</strong> y la mesa vuelve a{' '}
            <strong>LIBRE</strong>.
          </p>
        </div>
      </Modal>
    </>
  )
}
