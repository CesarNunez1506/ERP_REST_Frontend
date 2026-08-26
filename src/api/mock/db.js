/**
 * Semilla en memoria del mock. Los nombres de campo son los mismos que
 * expondrá el backend NestJS (camelCase en JSON, snake_case en Postgres).
 *
 * Nota sobre el DER: MENU no tiene precio en el diagrama, pero ORDER_TICKET.amount
 * tiene que salir de algún lado. Aquí MENU lleva `price` (precio unitario, con IGV
 * incluido, como se muestra en carta en Perú). Si el backend lo modela distinto,
 * es el único campo extra que habría que reubicar.
 */

import { nuevaPared, nuevaMesa, sillasAlrededor } from '../../lib/croquis.js'

const min = (n) => n * 60_000
const haceMin = (n) => new Date(Date.now() - min(n)).toISOString()

/**
 * Croquis de ejemplo del local (columna `draw_croquislocal`).
 * Salón a la izquierda, cocina arriba a la derecha, barra abajo a la derecha,
 * y un vano de 100 unidades en la pared inferior que hace de entrada.
 */
function crearCroquis(tables) {
  const walls = [
    nuevaPared([[40, 40], [1160, 40]]), // fachada
    nuevaPared([[1160, 40], [1160, 760]]),
    nuevaPared([[40, 40], [40, 760]]),
    nuevaPared([[40, 760], [520, 760]]), // pared inferior, izquierda del vano
    nuevaPared([[620, 760], [1160, 760]]), // pared inferior, derecha del vano
    nuevaPared([[840, 40], [840, 320], [1160, 320]]), // cocina
    nuevaPared([[880, 480], [1120, 480], [1120, 600]], 14), // barra
  ]

  // [numeroDeMesa, x, y] — el resto (forma y medidas) sale de la capacidad.
  const posiciones = [
    [1, 140, 150], [2, 300, 150], [9, 460, 150], [3, 640, 150],
    [4, 140, 330], [5, 320, 330], [10, 500, 330], [6, 700, 330],
    [11, 140, 520], [7, 360, 520], [8, 620, 520],
    [12, 300, 660],
  ]

  const mesas = []
  const sillas = []
  for (const [numero, x, y] of posiciones) {
    const mesa = tables.find((t) => t.number === numero)
    if (!mesa) continue
    const elemento = nuevaMesa({ tableId: mesa.id, capacidad: mesa.capacityPersons, x, y })
    mesas.push(elemento)
    sillas.push(...sillasAlrededor(elemento, mesa.capacityPersons))
  }

  return {
    version: 1,
    width: 1200,
    height: 800,
    grid: 20,
    walls,
    tables: mesas,
    chairs: sillas,
  }
}

export function crearSemilla() {
  const workers = [
    { id: 1, name: 'Yostin', lastname: 'Ramírez', startWork: '08:00', endWork: '17:00', role: 'ADMIN' },
    { id: 2, name: 'Lucía', lastname: 'Fernández', startWork: '11:00', endWork: '20:00', role: 'MOZO' },
    { id: 3, name: 'Marco', lastname: 'Quispe', startWork: '11:00', endWork: '20:00', role: 'MOZO' },
    { id: 4, name: 'Aldo', lastname: 'Chávez', startWork: '10:00', endWork: '19:00', role: 'COCINERO' },
    { id: 5, name: 'Rosa', lastname: 'Palomino', startWork: '10:00', endWork: '19:00', role: 'COCINERO' },
    { id: 6, name: 'Diego', lastname: 'Salas', startWork: '12:00', endWork: '21:00', role: 'COCINERO' },
    { id: 7, name: 'Karen', lastname: 'Ttito', startWork: '12:00', endWork: '21:00', role: 'CAJERO' },
  ]

  const tables = [
    { id: 1, number: 1, capacityPersons: 2 },
    { id: 2, number: 2, capacityPersons: 2 },
    { id: 3, number: 3, capacityPersons: 4 },
    { id: 4, number: 4, capacityPersons: 4 },
    { id: 5, number: 5, capacityPersons: 4 },
    { id: 6, number: 6, capacityPersons: 6 },
    { id: 7, number: 7, capacityPersons: 6 },
    { id: 8, number: 8, capacityPersons: 8 },
    { id: 9, number: 9, capacityPersons: 2 },
    { id: 10, number: 10, capacityPersons: 4 },
    { id: 11, number: 11, capacityPersons: 4 },
    { id: 12, number: 12, capacityPersons: 10 },
  ]

  const stations = [
    { id: 1, name: 'Cocina caliente', isAvailable: true, workerId: 4 },
    { id: 2, name: 'Parrilla', isAvailable: true, workerId: 6 },
    { id: 3, name: 'Frío / Entradas', isAvailable: true, workerId: 5 },
    { id: 4, name: 'Barra', isAvailable: true, workerId: 2 },
    { id: 5, name: 'Postres', isAvailable: false, workerId: null },
  ]

  const menus = [
    { id: 1, name: 'Lomo saltado', quantity: 24, isAvailable: true, price: 38, stationId: 1 },
    { id: 2, name: 'Ají de gallina', quantity: 18, isAvailable: true, price: 32, stationId: 1 },
    { id: 3, name: 'Arroz con mariscos', quantity: 12, isAvailable: true, price: 42, stationId: 1 },
    { id: 4, name: 'Anticuchos (4u)', quantity: 30, isAvailable: true, price: 28, stationId: 2 },
    { id: 5, name: 'Parrilla mixta', quantity: 8, isAvailable: true, price: 65, stationId: 2 },
    { id: 6, name: 'Pollo a la brasa 1/4', quantity: 40, isAvailable: true, price: 26, stationId: 2 },
    { id: 7, name: 'Ceviche clásico', quantity: 15, isAvailable: true, price: 36, stationId: 3 },
    { id: 8, name: 'Causa limeña', quantity: 20, isAvailable: true, price: 22, stationId: 3 },
    { id: 9, name: 'Ensalada de quinua', quantity: 0, isAvailable: false, price: 24, stationId: 3 },
    { id: 10, name: 'Chicha morada (jarra)', quantity: 25, isAvailable: true, price: 18, stationId: 4 },
    { id: 11, name: 'Limonada frozen', quantity: 30, isAvailable: true, price: 12, stationId: 4 },
    { id: 12, name: 'Pisco sour', quantity: 22, isAvailable: true, price: 25, stationId: 4 },
    { id: 13, name: 'Suspiro a la limeña', quantity: 10, isAvailable: true, price: 16, stationId: 5 },
    { id: 14, name: 'Picarones', quantity: 14, isAvailable: true, price: 15, stationId: 5 },
  ]

  const orders = [
    { id: 1001, status: 'EN_PREPARACION', tableId: 3, workerId: 2, createdAt: haceMin(22) },
    { id: 1002, status: 'EN_PREPARACION', tableId: 6, workerId: 3, createdAt: haceMin(14) },
    { id: 1003, status: 'ABIERTA', tableId: 9, workerId: 2, createdAt: haceMin(4) },
    { id: 1004, status: 'SERVIDA', tableId: 1, workerId: 3, createdAt: haceMin(52) },
    { id: 1005, status: 'CERRADA', tableId: 5, workerId: 2, createdAt: haceMin(95) },
    { id: 1006, status: 'CERRADA', tableId: 8, workerId: 3, createdAt: haceMin(140) },
  ]

  const plates = [
    // Orden 1001 — mesa 3, ya en cocina
    { id: 1, orderId: 1001, menuId: 1, stationId: 1, quantityDispend: 2, comment: 'Uno sin cebolla', status: 'EN_PREPARACION', sendTime: haceMin(18), readyAt: null },
    { id: 2, orderId: 1001, menuId: 7, stationId: 3, quantityDispend: 1, comment: '', status: 'ENTREGADO', sendTime: haceMin(20), readyAt: haceMin(13) },
    { id: 3, orderId: 1001, menuId: 10, stationId: 4, quantityDispend: 1, comment: 'Con poco hielo', status: 'ENTREGADO', sendTime: haceMin(20), readyAt: haceMin(18) },
    // Orden 1002 — mesa 6, recién despachada
    { id: 4, orderId: 1002, menuId: 5, stationId: 2, quantityDispend: 1, comment: 'Término medio', status: 'EN_PREPARACION', sendTime: haceMin(11), readyAt: null },
    { id: 5, orderId: 1002, menuId: 4, stationId: 2, quantityDispend: 2, comment: '', status: 'PENDIENTE', sendTime: haceMin(11), readyAt: null },
    { id: 6, orderId: 1002, menuId: 8, stationId: 3, quantityDispend: 2, comment: 'Sin ají', status: 'LISTO', sendTime: haceMin(11), readyAt: haceMin(3) },
    { id: 7, orderId: 1002, menuId: 12, stationId: 4, quantityDispend: 4, comment: '', status: 'LISTO', sendTime: haceMin(10), readyAt: haceMin(6) },
    // Orden 1003 — mesa 9, aún no enviada a cocina (sendTime null)
    { id: 8, orderId: 1003, menuId: 6, stationId: 2, quantityDispend: 2, comment: '', status: 'PENDIENTE', sendTime: null, readyAt: null },
    { id: 9, orderId: 1003, menuId: 11, stationId: 4, quantityDispend: 2, comment: '', status: 'PENDIENTE', sendTime: null, readyAt: null },
    // Orden 1004 — mesa 1, servida, esperando cobro
    { id: 10, orderId: 1004, menuId: 2, stationId: 1, quantityDispend: 2, comment: '', status: 'ENTREGADO', sendTime: haceMin(48), readyAt: haceMin(36) },
    { id: 11, orderId: 1004, menuId: 13, stationId: 5, quantityDispend: 2, comment: '', status: 'ENTREGADO', sendTime: haceMin(30), readyAt: haceMin(24) },
    // Orden 1005 — cerrada y pagada
    { id: 12, orderId: 1005, menuId: 3, stationId: 1, quantityDispend: 3, comment: '', status: 'ENTREGADO', sendTime: haceMin(90), readyAt: haceMin(75) },
    { id: 13, orderId: 1005, menuId: 10, stationId: 4, quantityDispend: 2, comment: '', status: 'ENTREGADO', sendTime: haceMin(90), readyAt: haceMin(87) },
    // Orden 1006 — cerrada y pagada
    { id: 14, orderId: 1006, menuId: 5, stationId: 2, quantityDispend: 2, comment: '', status: 'ENTREGADO', sendTime: haceMin(136), readyAt: haceMin(118) },
    { id: 15, orderId: 1006, menuId: 14, stationId: 5, quantityDispend: 3, comment: '', status: 'ENTREGADO', sendTime: haceMin(120), readyAt: haceMin(112) },
    { id: 16, orderId: 1006, menuId: 12, stationId: 4, quantityDispend: 6, comment: '', status: 'ENTREGADO', sendTime: haceMin(135), readyAt: haceMin(130) },
  ]

  const tickets = [
    { id: 5001, orderId: 1004, status: 'PENDIENTE', amount: 96, withoutIgv: 81.36, createdAt: haceMin(6), paidAt: null },
    { id: 5002, orderId: 1005, status: 'PAGADA', amount: 162, withoutIgv: 137.29, createdAt: haceMin(70), paidAt: haceMin(68) },
    { id: 5003, orderId: 1006, status: 'PAGADA', amount: 325, withoutIgv: 275.42, createdAt: haceMin(105), paidAt: haceMin(103) },
  ]

  return {
    workers,
    tables,
    stations,
    menus,
    orders,
    plates,
    tickets,
    local: {
      id: 1,
      name: 'Sabor & Fuego — Local Miraflores',
      drawCroquisLocal: crearCroquis(tables),
      updatedAt: haceMin(600),
    },
    secuencias: { worker: 8, table: 13, station: 6, menu: 15, order: 1007, plate: 17, ticket: 5004 },
  }
}
