/**
 * Servidor simulado en memoria.
 *
 * Existe solo porque el backend NestJS todavía se está construyendo: responde
 * exactamente el mismo contrato REST (mismas rutas, mismos DTOs, mismos códigos
 * y el mismo formato de error de Nest). Cuando el back esté listo se pone
 * VITE_USE_MOCK=false en .env y no hay que tocar una línea de las pantallas.
 *
 * También publica en el bus (`bus.js`) los mismos eventos que emitirá el
 * gateway de Socket.IO, para que el tiempo real funcione desde ya.
 *
 * Contrato documentado en docs/API-CONTRATO.md
 */
import { crearSemilla } from './db.js'
import { publicar } from './bus.js'
import { EV } from '../events.js'

const BASE_URL = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/$/, '')
const IGV = Number(import.meta.env.VITE_IGV ?? 0.18)
const SLA_OBJETIVO_MIN = 15

const db = crearSemilla()

// ── Utilidades HTTP ───────────────────────────────────────────────────────
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

const noContent = () => new Response(null, { status: 204 })

/** Mismo shape que lanza Nest: { statusCode, message, error }. */
const fail = (status, message, error = 'Bad Request') =>
  json({ statusCode: status, message, error }, status)

const noEncontrado = (que) => fail(404, `${que} no encontrado`, 'Not Found')

const espera = (ms) => new Promise((r) => setTimeout(r, ms))

const redondear = (n) => Math.round(n * 100) / 100
const ahora = () => new Date().toISOString()

// ── Campos calculados ─────────────────────────────────────────────────────

/** PLATE.sla — minutos entre send_time y la marca de LISTO (o ahora). */
function slaDe(plate) {
  if (!plate.sendTime) return null
  const fin = plate.readyAt ? new Date(plate.readyAt).getTime() : Date.now()
  return Math.max(0, Math.round((fin - new Date(plate.sendTime).getTime()) / 60000))
}

/** TABLE.status — calculado a partir de las órdenes vivas de la mesa. */
function estadoMesa(tableId) {
  const vivas = db.orders.filter(
    (o) => o.tableId === tableId && !['CERRADA', 'ANULADA'].includes(o.status),
  )
  if (!vivas.length) return 'LIBRE'
  const porCobrar = vivas.some(
    (o) =>
      o.status === 'SERVIDA' ||
      db.tickets.some((t) => t.orderId === o.id && t.status === 'PENDIENTE'),
  )
  return porCobrar ? 'POR_COBRAR' : 'OCUPADA'
}

function expandirMesa(t) {
  const orden = db.orders.find(
    (o) => o.tableId === t.id && !['CERRADA', 'ANULADA'].includes(o.status),
  )
  return {
    ...t,
    status: estadoMesa(t.id),
    currentOrderId: orden?.id ?? null,
    currentOrderStatus: orden?.status ?? null,
  }
}

function expandirEstacion(s) {
  const worker = db.workers.find((w) => w.id === s.workerId) ?? null
  const enCola = db.plates.filter(
    (p) => p.stationId === s.id && p.sendTime && ['PENDIENTE', 'EN_PREPARACION'].includes(p.status),
  ).length
  return { ...s, worker, platesInQueue: enCola }
}

function expandirPlato(p) {
  const menu = db.menus.find((m) => m.id === p.menuId) ?? null
  const station = db.stations.find((s) => s.id === p.stationId) ?? null
  const order = db.orders.find((o) => o.id === p.orderId) ?? null
  const table = order ? db.tables.find((t) => t.id === order.tableId) : null
  const unitPrice = menu?.price ?? 0
  return {
    ...p,
    sla: slaDe(p),
    menu: menu && { id: menu.id, name: menu.name, price: menu.price },
    station: station && { id: station.id, name: station.name },
    tableNumber: table?.number ?? null,
    unitPrice,
    subtotal: redondear(unitPrice * p.quantityDispend),
  }
}

function totalDeOrden(orderId) {
  return redondear(
    db.plates
      .filter((p) => p.orderId === orderId && p.status !== 'ANULADO')
      .reduce((acc, p) => acc + (db.menus.find((m) => m.id === p.menuId)?.price ?? 0) * p.quantityDispend, 0),
  )
}

function expandirOrden(o, { conPlatos = false } = {}) {
  const table = db.tables.find((t) => t.id === o.tableId) ?? null
  const worker = db.workers.find((w) => w.id === o.workerId) ?? null
  const misPlatos = db.plates.filter((p) => p.orderId === o.id)
  const ticket = db.tickets.find((t) => t.orderId === o.id) ?? null
  return {
    ...o,
    table: table && { id: table.id, number: table.number, capacityPersons: table.capacityPersons },
    worker: worker && { id: worker.id, name: worker.name, lastname: worker.lastname, role: worker.role },
    ticket,
    plateCount: misPlatos.length,
    total: totalDeOrden(o.id),
    ...(conPlatos ? { plates: misPlatos.map(expandirPlato) } : {}),
  }
}

function expandirTicket(t) {
  const order = db.orders.find((o) => o.id === t.orderId) ?? null
  const table = order ? db.tables.find((tb) => tb.id === order.tableId) : null
  const worker = order ? db.workers.find((w) => w.id === order.workerId) : null
  return {
    ...t,
    igv: redondear(t.amount - t.withoutIgv),
    order: order && { id: order.id, status: order.status },
    tableNumber: table?.number ?? null,
    workerName: worker ? `${worker.name} ${worker.lastname}` : null,
  }
}

/** Recalcula ORDER.status según en qué van sus platos. */
function recalcularOrden(orderId) {
  const orden = db.orders.find((o) => o.id === orderId)
  if (!orden || ['CERRADA', 'ANULADA'].includes(orden.status)) return
  const vivos = db.plates.filter((p) => p.orderId === orderId && p.status !== 'ANULADO')
  if (!vivos.length) return
  if (vivos.every((p) => p.status === 'ENTREGADO')) orden.status = 'SERVIDA'
  else if (vivos.some((p) => p.sendTime)) orden.status = 'EN_PREPARACION'
  else orden.status = 'ABIERTA'
}

// ── Emisión de eventos (lo que hará el gateway tras cada mutación) ────────

function emitirMesa(tableId) {
  const mesa = db.tables.find((t) => t.id === tableId)
  if (mesa) publicar(EV.TABLE_UPDATED, expandirMesa(mesa))
}

/** Publica la orden y, de paso, el nuevo estado de su mesa. */
function emitirOrden(orderId, evento = EV.ORDER_UPDATED) {
  const orden = db.orders.find((o) => o.id === orderId)
  if (!orden) return
  publicar(evento, expandirOrden(orden, { conPlatos: true }))
  emitirMesa(orden.tableId)
}

// ── CRUD genérico para los catálogos ──────────────────────────────────────
function crud(coleccion, claveSecuencia, etiqueta, { validar, expandir } = {}) {
  const salida = (registro) => (expandir ? expandir(registro) : registro)
  return {
    list: (query) => {
      let items = [...coleccion]
      for (const [k, v] of Object.entries(query)) {
        if (k === 'q') {
          items = items.filter((i) =>
            String(i.name ?? '').toLowerCase().includes(v.toLowerCase()),
          )
        } else if (k in (items[0] ?? {})) {
          items = items.filter((i) => String(i[k]) === v)
        }
      }
      return json(items.map(salida))
    },
    get: (id) => {
      const item = coleccion.find((i) => i.id === id)
      return item ? json(salida(item)) : noEncontrado(etiqueta)
    },
    create: (dto) => {
      const errores = validar?.(dto, { creando: true }) ?? []
      if (errores.length) return fail(400, errores)
      const nuevo = { ...dto, id: db.secuencias[claveSecuencia]++ }
      coleccion.push(nuevo)
      return json(salida(nuevo), 201)
    },
    update: (id, dto) => {
      const item = coleccion.find((i) => i.id === id)
      if (!item) return noEncontrado(etiqueta)
      const errores = validar?.({ ...item, ...dto }, { creando: false }) ?? []
      if (errores.length) return fail(400, errores)
      Object.assign(item, dto)
      return json(salida(item))
    },
    remove: (id) => {
      const i = coleccion.findIndex((x) => x.id === id)
      if (i === -1) return noEncontrado(etiqueta)
      coleccion.splice(i, 1)
      return noContent()
    },
  }
}

const recursoWorkers = crud(db.workers, 'worker', 'Trabajador', {
  validar: (d) => {
    const e = []
    if (!d.name?.trim()) e.push('name no debe estar vacío')
    if (!d.lastname?.trim()) e.push('lastname no debe estar vacío')
    if (!['ADMIN', 'MOZO', 'COCINERO', 'CAJERO'].includes(d.role))
      e.push('role debe ser ADMIN, MOZO, COCINERO o CAJERO')
    return e
  },
})

const recursoTables = crud(db.tables, 'table', 'Mesa', {
  expandir: expandirMesa,
  validar: (d) => {
    const e = []
    if (!Number.isInteger(Number(d.number)) || Number(d.number) <= 0)
      e.push('number debe ser un entero positivo')
    if (!Number.isInteger(Number(d.capacityPersons)) || Number(d.capacityPersons) <= 0)
      e.push('capacityPersons debe ser un entero positivo')
    return e
  },
})

const recursoStations = crud(db.stations, 'station', 'Estación', {
  expandir: expandirEstacion,
  validar: (d) => (d.name?.trim() ? [] : ['name no debe estar vacío']),
})

const recursoMenus = crud(db.menus, 'menu', 'Plato de carta', {
  validar: (d) => {
    const e = []
    if (!d.name?.trim()) e.push('name no debe estar vacío')
    if (Number(d.price) <= 0) e.push('price debe ser mayor a 0')
    if (Number(d.quantity) < 0) e.push('quantity no puede ser negativo')
    return e
  },
})

// ── Enrutador ─────────────────────────────────────────────────────────────
async function resolver(path, query, method, body) {
  const seg = path.split('/').filter(Boolean)
  const [recurso, idCrudo, sub] = seg
  const id = Number(idCrudo)

  // /dashboard/resumen
  if (recurso === 'dashboard' && idCrudo === 'resumen' && method === 'GET') {
    const mesas = db.tables.map(expandirMesa)
    const platosVivos = db.plates.filter(
      (p) => p.sendTime && ['PENDIENTE', 'EN_PREPARACION'].includes(p.status),
    )
    const entregados = db.plates.filter((p) => p.readyAt && p.sendTime)
    const pagados = db.tickets.filter((t) => t.status === 'PAGADA')
    const pendientes = db.tickets.filter((t) => t.status === 'PENDIENTE')

    const ventaPorMenu = new Map()
    for (const p of db.plates) {
      if (p.status === 'ANULADO') continue
      const m = db.menus.find((x) => x.id === p.menuId)
      if (!m) continue
      const prev = ventaPorMenu.get(m.id) ?? { name: m.name, cantidad: 0, monto: 0 }
      prev.cantidad += p.quantityDispend
      prev.monto += m.price * p.quantityDispend
      ventaPorMenu.set(m.id, prev)
    }

    return json({
      mesas: {
        total: mesas.length,
        libres: mesas.filter((m) => m.status === 'LIBRE').length,
        ocupadas: mesas.filter((m) => m.status === 'OCUPADA').length,
        porCobrar: mesas.filter((m) => m.status === 'POR_COBRAR').length,
      },
      ordenesActivas: db.orders.filter((o) => !['CERRADA', 'ANULADA'].includes(o.status)).length,
      platosEnCola: platosVivos.length,
      platosVencidos: platosVivos.filter((p) => (slaDe(p) ?? 0) >= SLA_OBJETIVO_MIN).length,
      slaPromedioMin: entregados.length
        ? redondear(entregados.reduce((a, p) => a + slaDe(p), 0) / entregados.length)
        : 0,
      ventasDia: redondear(pagados.reduce((a, t) => a + t.amount, 0)),
      ticketsPendientes: {
        cantidad: pendientes.length,
        monto: redondear(pendientes.reduce((a, t) => a + t.amount, 0)),
      },
      ticketPromedio: pagados.length
        ? redondear(pagados.reduce((a, t) => a + t.amount, 0) / pagados.length)
        : 0,
      topPlatos: [...ventaPorMenu.values()]
        .map((v) => ({ ...v, monto: redondear(v.monto) }))
        .sort((a, b) => b.monto - a.monto)
        .slice(0, 6),
      cargaEstaciones: db.stations.map((s) => ({
        id: s.id,
        name: s.name,
        isAvailable: s.isAvailable,
        enCola: platosVivos.filter((p) => p.stationId === s.id).length,
      })),
    })
  }

  // ── /croquis-local ──────────────────────────────────────────────────────
  if (recurso === 'croquis-local') {
    if (method === 'GET') return json(db.local)
    if (method === 'PUT') {
      const doc = body?.drawCroquisLocal
      if (!doc || typeof doc !== 'object')
        return fail(400, ['drawCroquisLocal debe ser un objeto con el croquis'])
      const idsMesa = new Set(db.tables.map((t) => t.id))
      const huerfanas = (doc.tables ?? []).filter((m) => m.tableId && !idsMesa.has(m.tableId))
      if (huerfanas.length)
        return fail(409, `El croquis referencia ${huerfanas.length} mesa(s) que ya no existen`, 'Conflict')

      db.local = { ...db.local, drawCroquisLocal: doc, updatedAt: ahora() }
      publicar(EV.CROQUIS_UPDATED, db.local)
      return json(db.local)
    }
  }

  // ── /workers ────────────────────────────────────────────────────────────
  if (recurso === 'workers') {
    if (method === 'GET' && !idCrudo) return recursoWorkers.list(query)
    if (method === 'GET') return recursoWorkers.get(id)
    if (method === 'POST') return recursoWorkers.create(body)
    if (method === 'PATCH') return recursoWorkers.update(id, body)
    if (method === 'DELETE') {
      if (db.orders.some((o) => o.workerId === id))
        return fail(409, 'No se puede eliminar: el trabajador tiene órdenes asociadas', 'Conflict')
      return recursoWorkers.remove(id)
    }
  }

  // ── /tables ─────────────────────────────────────────────────────────────
  if (recurso === 'tables') {
    if (method === 'GET' && !idCrudo) {
      const mesas = db.tables.map(expandirMesa)
      const filtradas = query.status ? mesas.filter((m) => m.status === query.status) : mesas
      return json(filtradas.sort((a, b) => a.number - b.number))
    }
    if (method === 'GET') return recursoTables.get(id)
    if (method === 'POST') {
      if (db.tables.some((t) => t.number === Number(body?.number)))
        return fail(409, `Ya existe la mesa ${body.number}`, 'Conflict')
      const res = recursoTables.create({
        ...body,
        number: Number(body.number),
        capacityPersons: Number(body.capacityPersons),
      })
      if (res.status === 201) emitirMesa(db.tables.at(-1).id)
      return res
    }
    if (method === 'PATCH') {
      const res = recursoTables.update(id, body)
      if (res.ok) emitirMesa(id)
      return res
    }
    if (method === 'DELETE') {
      if (estadoMesa(id) !== 'LIBRE')
        return fail(409, 'No se puede eliminar una mesa ocupada', 'Conflict')
      return recursoTables.remove(id)
    }
  }

  // ── /stations ───────────────────────────────────────────────────────────
  if (recurso === 'stations') {
    if (method === 'GET' && !idCrudo) return json(db.stations.map(expandirEstacion))
    if (method === 'GET') return recursoStations.get(id)
    if (method === 'POST') {
      const res = recursoStations.create({
        name: body?.name,
        isAvailable: body?.isAvailable ?? true,
        workerId: body?.workerId ?? null,
      })
      if (res.status === 201) publicar(EV.STATION_UPDATED, expandirEstacion(db.stations.at(-1)))
      return res
    }
    if (method === 'PATCH') {
      const res = recursoStations.update(id, body)
      const est = db.stations.find((s) => s.id === id)
      if (res.ok && est) publicar(EV.STATION_UPDATED, expandirEstacion(est))
      return res
    }
    if (method === 'DELETE') {
      if (db.plates.some((p) => p.stationId === id))
        return fail(409, 'No se puede eliminar: la estación tiene platos asociados', 'Conflict')
      return recursoStations.remove(id)
    }
  }

  // ── /menus ──────────────────────────────────────────────────────────────
  if (recurso === 'menus') {
    if (method === 'GET' && !idCrudo) {
      let items = [...db.menus]
      if (query.q) items = items.filter((m) => m.name.toLowerCase().includes(query.q.toLowerCase()))
      if (query.isAvailable) items = items.filter((m) => String(m.isAvailable) === query.isAvailable)
      if (query.stationId) items = items.filter((m) => String(m.stationId) === query.stationId)
      return json(items)
    }
    if (method === 'GET') return recursoMenus.get(id)
    if (method === 'POST') {
      const res = recursoMenus.create({
        name: body?.name,
        price: Number(body?.price),
        quantity: Number(body?.quantity ?? 0),
        isAvailable: body?.isAvailable ?? true,
        stationId: body?.stationId ? Number(body.stationId) : null,
      })
      if (res.status === 201) publicar(EV.MENU_UPDATED, db.menus.at(-1))
      return res
    }
    if (method === 'PATCH') {
      const res = recursoMenus.update(id, body)
      const menu = db.menus.find((m) => m.id === id)
      if (res.ok && menu) publicar(EV.MENU_UPDATED, menu)
      return res
    }
    if (method === 'DELETE') return recursoMenus.remove(id)
  }

  // ── /orders ─────────────────────────────────────────────────────────────
  if (recurso === 'orders') {
    if (method === 'GET' && !idCrudo) {
      let items = [...db.orders]
      if (query.status) items = items.filter((o) => o.status === query.status)
      if (query.tableId) items = items.filter((o) => String(o.tableId) === query.tableId)
      if (query.workerId) items = items.filter((o) => String(o.workerId) === query.workerId)
      if (query.activas === 'true')
        items = items.filter((o) => !['CERRADA', 'ANULADA'].includes(o.status))
      return json(
        items
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .map((o) => expandirOrden(o)),
      )
    }

    if (method === 'GET' && idCrudo && !sub) {
      const o = db.orders.find((x) => x.id === id)
      return o ? json(expandirOrden(o, { conPlatos: true })) : noEncontrado('Orden')
    }

    if (method === 'GET' && sub === 'plates') {
      return json(db.plates.filter((p) => p.orderId === id).map(expandirPlato))
    }

    if (method === 'POST' && !idCrudo) {
      const errores = []
      const tableId = Number(body?.tableId)
      const workerId = Number(body?.workerId)
      if (!db.tables.some((t) => t.id === tableId)) errores.push('tableId debe existir')
      if (!db.workers.some((w) => w.id === workerId)) errores.push('workerId debe existir')
      if (errores.length) return fail(400, errores)
      if (estadoMesa(tableId) !== 'LIBRE')
        return fail(409, 'La mesa ya tiene una orden abierta', 'Conflict')

      const orden = {
        id: db.secuencias.order++,
        status: 'ABIERTA',
        tableId,
        workerId,
        createdAt: ahora(),
      }
      db.orders.push(orden)
      emitirOrden(orden.id, EV.ORDER_CREATED)
      return json(expandirOrden(orden, { conPlatos: true }), 201)
    }

    // POST /orders/:id/send — sella send_time y descuenta stock de carta
    if (method === 'POST' && sub === 'send') {
      const orden = db.orders.find((o) => o.id === id)
      if (!orden) return noEncontrado('Orden')
      const porEnviar = db.plates.filter((p) => p.orderId === id && !p.sendTime && p.status !== 'ANULADO')
      if (!porEnviar.length) return fail(409, 'No hay platos nuevos para enviar a cocina', 'Conflict')
      const t = ahora()
      for (const p of porEnviar) {
        p.sendTime = t
        p.status = 'PENDIENTE'
        const menu = db.menus.find((m) => m.id === p.menuId)
        if (menu) {
          menu.quantity = Math.max(0, menu.quantity - p.quantityDispend)
          if (menu.quantity === 0) menu.isAvailable = false
          publicar(EV.MENU_UPDATED, menu)
        }
        // El KDS necesita el alta de cada plato, no solo el evento de la orden.
        publicar(EV.PLATE_CREATED, expandirPlato(p))
      }
      orden.status = 'EN_PREPARACION'
      emitirOrden(orden.id, EV.ORDER_SENT)
      return json(expandirOrden(orden, { conPlatos: true }))
    }

    if (method === 'PATCH') {
      const orden = db.orders.find((o) => o.id === id)
      if (!orden) return noEncontrado('Orden')
      Object.assign(orden, body)
      emitirOrden(orden.id)
      return json(expandirOrden(orden, { conPlatos: true }))
    }

    if (method === 'DELETE') {
      const orden = db.orders.find((o) => o.id === id)
      if (!orden) return noEncontrado('Orden')
      if (db.plates.some((p) => p.orderId === id && p.sendTime))
        return fail(409, 'No se puede eliminar una orden ya enviada a cocina', 'Conflict')
      const { tableId } = orden
      db.plates = db.plates.filter((p) => p.orderId !== id)
      db.orders = db.orders.filter((o) => o.id !== id)
      publicar(EV.ORDER_DELETED, { orderId: id, tableId })
      emitirMesa(tableId)
      return noContent()
    }
  }

  // ── /plates ─────────────────────────────────────────────────────────────
  if (recurso === 'plates') {
    if (method === 'GET' && !idCrudo) {
      let items = [...db.plates]
      if (query.stationId) items = items.filter((p) => String(p.stationId) === query.stationId)
      if (query.orderId) items = items.filter((p) => String(p.orderId) === query.orderId)
      if (query.status) items = items.filter((p) => query.status.split(',').includes(p.status))
      if (query.enviados === 'true') items = items.filter((p) => Boolean(p.sendTime))
      return json(
        items
          .map(expandirPlato)
          .sort((a, b) => new Date(a.sendTime ?? 0) - new Date(b.sendTime ?? 0)),
      )
    }

    if (method === 'GET') {
      const p = db.plates.find((x) => x.id === id)
      return p ? json(expandirPlato(p)) : noEncontrado('Plato')
    }

    if (method === 'POST') {
      const errores = []
      const orderId = Number(body?.orderId)
      const menuId = Number(body?.menuId)
      const cantidad = Number(body?.quantityDispend)
      const orden = db.orders.find((o) => o.id === orderId)
      const menu = db.menus.find((m) => m.id === menuId)
      if (!orden) errores.push('orderId debe existir')
      if (!menu) errores.push('menuId debe existir')
      if (!Number.isInteger(cantidad) || cantidad <= 0)
        errores.push('quantityDispend debe ser un entero positivo')
      if (errores.length) return fail(400, errores)
      if (['CERRADA', 'ANULADA'].includes(orden.status))
        return fail(409, 'La orden ya está cerrada', 'Conflict')
      if (!menu.isAvailable) return fail(409, `"${menu.name}" no está disponible`, 'Conflict')

      const plato = {
        id: db.secuencias.plate++,
        orderId,
        menuId,
        stationId: Number(body?.stationId ?? menu.stationId),
        quantityDispend: cantidad,
        comment: body?.comment ?? '',
        status: 'PENDIENTE',
        sendTime: null,
        readyAt: null,
      }
      db.plates.push(plato)
      // Sin sendTime todavía no entra al KDS, pero la comanda abierta sí se entera.
      publicar(EV.PLATE_CREATED, expandirPlato(plato))
      emitirOrden(orderId)
      return json(expandirPlato(plato), 201)
    }

    if (method === 'PATCH') {
      const plato = db.plates.find((p) => p.id === id)
      if (!plato) return noEncontrado('Plato')
      if (body?.status) {
        const validos = ['PENDIENTE', 'EN_PREPARACION', 'LISTO', 'ENTREGADO', 'ANULADO']
        if (!validos.includes(body.status))
          return fail(400, [`status debe ser uno de: ${validos.join(', ')}`])
        if (body.status === 'LISTO' && !plato.readyAt) plato.readyAt = ahora()
      }
      Object.assign(plato, body)
      recalcularOrden(plato.orderId)
      publicar(EV.PLATE_UPDATED, expandirPlato(plato))
      emitirOrden(plato.orderId)
      return json(expandirPlato(plato))
    }

    if (method === 'DELETE') {
      const plato = db.plates.find((p) => p.id === id)
      if (!plato) return noEncontrado('Plato')
      if (plato.sendTime) return fail(409, 'No se puede quitar un plato ya enviado a cocina', 'Conflict')
      const { orderId, stationId } = plato
      db.plates = db.plates.filter((p) => p.id !== id)
      publicar(EV.PLATE_DELETED, { plateId: id, orderId, stationId })
      emitirOrden(orderId)
      return noContent()
    }
  }

  // ── /order-tickets ──────────────────────────────────────────────────────
  if (recurso === 'order-tickets') {
    if (method === 'GET' && !idCrudo) {
      let items = [...db.tickets]
      if (query.status) items = items.filter((t) => t.status === query.status)
      return json(
        items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(expandirTicket),
      )
    }

    if (method === 'GET') {
      const t = db.tickets.find((x) => x.id === id)
      return t ? json(expandirTicket(t)) : noEncontrado('Ticket')
    }

    if (method === 'POST') {
      const orderId = Number(body?.orderId)
      const orden = db.orders.find((o) => o.id === orderId)
      if (!orden) return fail(400, ['orderId debe existir'])
      if (db.tickets.some((t) => t.orderId === orderId && t.status !== 'ANULADA'))
        return fail(409, 'La orden ya tiene un ticket emitido', 'Conflict')
      const amount = totalDeOrden(orderId)
      if (!amount) return fail(409, 'La orden no tiene platos que cobrar', 'Conflict')

      const ticket = {
        id: db.secuencias.ticket++,
        orderId,
        status: 'PENDIENTE',
        amount,
        withoutIgv: redondear(amount / (1 + IGV)),
        createdAt: ahora(),
        paidAt: null,
      }
      db.tickets.push(ticket)
      if (orden.status !== 'SERVIDA') orden.status = 'SERVIDA'
      publicar(EV.TICKET_CREATED, expandirTicket(ticket))
      emitirOrden(orderId)
      return json(expandirTicket(ticket), 201)
    }

    if (method === 'PATCH') {
      const ticket = db.tickets.find((t) => t.id === id)
      if (!ticket) return noEncontrado('Ticket')
      if (body?.status === 'PAGADA') {
        if (ticket.status === 'PAGADA') return fail(409, 'El ticket ya fue pagado', 'Conflict')
        ticket.status = 'PAGADA'
        ticket.paidAt = ahora()
        const orden = db.orders.find((o) => o.id === ticket.orderId)
        if (orden) orden.status = 'CERRADA'
      } else if (body?.status === 'ANULADA') {
        ticket.status = 'ANULADA'
        const orden = db.orders.find((o) => o.id === ticket.orderId)
        if (orden && orden.status === 'SERVIDA') orden.status = 'EN_PREPARACION'
      } else {
        Object.assign(ticket, body)
      }
      publicar(EV.TICKET_UPDATED, expandirTicket(ticket))
      emitirOrden(ticket.orderId)
      return json(expandirTicket(ticket))
    }
  }

  return fail(404, `Cannot ${method} ${path}`, 'Not Found')
}

/** Reemplazo de `fetch` con la misma firma. */
export async function mockFetch(target, init = {}) {
  const sinBase = target.startsWith(BASE_URL) ? target.slice(BASE_URL.length) : target
  const [path, qs] = sinBase.split('?')
  const query = Object.fromEntries(new URLSearchParams(qs ?? ''))
  const body = init.body ? JSON.parse(init.body) : undefined

  await espera(90 + Math.random() * 180) // latencia de red simulada

  try {
    return await resolver(path, query, init.method ?? 'GET', body)
  } catch (e) {
    return fail(500, e.message ?? 'Error interno del mock', 'Internal Server Error')
  }
}
