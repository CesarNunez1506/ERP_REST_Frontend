import { api } from './client.js'

/**
 * Un objeto por entidad del diagrama entidad-relación.
 * Cada método mapea 1:1 con un endpoint que el backend NestJS debe exponer
 * (ver docs/API-CONTRATO.md). Si una ruta cambia en Nest, se cambia aquí
 * y en ningún otro lugar del frontend.
 *
 * Todos los métodos de lectura aceptan `opts` como último argumento para
 * poder pasar el AbortSignal que entrega `useFetch`.
 */

// ── WORKER ────────────────────────────────────────────────────────────────
export const workers = {
  list: (query, opts) => api.get('/workers', { query, ...opts }),
  get: (id, opts) => api.get(`/workers/${id}`, opts),
  create: (dto) => api.post('/workers', dto),
  update: (id, dto) => api.patch(`/workers/${id}`, dto),
  remove: (id) => api.delete(`/workers/${id}`),
}

// ── TABLE ─────────────────────────────────────────────────────────────────
export const tables = {
  list: (query, opts) => api.get('/tables', { query, ...opts }),
  get: (id, opts) => api.get(`/tables/${id}`, opts),
  create: (dto) => api.post('/tables', dto),
  update: (id, dto) => api.patch(`/tables/${id}`, dto),
  remove: (id) => api.delete(`/tables/${id}`),
}

// ── MENU ──────────────────────────────────────────────────────────────────
export const menus = {
  list: (query, opts) => api.get('/menus', { query, ...opts }),
  get: (id, opts) => api.get(`/menus/${id}`, opts),
  create: (dto) => api.post('/menus', dto),
  update: (id, dto) => api.patch(`/menus/${id}`, dto),
  remove: (id) => api.delete(`/menus/${id}`),
  /** PATCH /menus/:id { isAvailable } — agotar / reponer carta */
  setAvailability: (id, isAvailable) => api.patch(`/menus/${id}`, { isAvailable }),
}

// ── STATION ───────────────────────────────────────────────────────────────
export const stations = {
  list: (query, opts) => api.get('/stations', { query, ...opts }),
  get: (id, opts) => api.get(`/stations/${id}`, opts),
  create: (dto) => api.post('/stations', dto),
  update: (id, dto) => api.patch(`/stations/${id}`, dto),
  remove: (id) => api.delete(`/stations/${id}`),
}

// ── ORDER ─────────────────────────────────────────────────────────────────
export const orders = {
  /** query: { status, tableId, workerId, activas } */
  list: (query, opts) => api.get('/orders', { query, ...opts }),
  /** Devuelve la orden con sus platos y su ticket embebidos. */
  get: (id, opts) => api.get(`/orders/${id}`, opts),
  create: (dto) => api.post('/orders', dto),
  update: (id, dto) => api.patch(`/orders/${id}`, dto),
  setStatus: (id, status) => api.patch(`/orders/${id}`, { status }),
  remove: (id) => api.delete(`/orders/${id}`),
  /** Sub-recurso: los platos de una orden (ORDER 1:N PLATE). */
  plates: (id, opts) => api.get(`/orders/${id}/plates`, opts),
  /** Envía a cocina los platos aún no despachados: sella send_time. */
  send: (id) => api.post(`/orders/${id}/send`),
}

// ── PLATE ─────────────────────────────────────────────────────────────────
export const plates = {
  /** query: { stationId, status (lista separada por comas), orderId, enviados } */
  list: (query, opts) => api.get('/plates', { query, ...opts }),
  get: (id, opts) => api.get(`/plates/${id}`, opts),
  create: (dto) => api.post('/plates', dto),
  update: (id, dto) => api.patch(`/plates/${id}`, dto),
  setStatus: (id, status) => api.patch(`/plates/${id}`, { status }),
  remove: (id) => api.delete(`/plates/${id}`),
}

// ── ORDER_TICKET ──────────────────────────────────────────────────────────
export const tickets = {
  list: (query, opts) => api.get('/order-tickets', { query, ...opts }),
  get: (id, opts) => api.get(`/order-tickets/${id}`, opts),
  /** POST /order-tickets { orderId } — el back calcula amount y withoutIgv. */
  create: (dto) => api.post('/order-tickets', dto),
  pay: (id) => api.patch(`/order-tickets/${id}`, { status: 'PAGADA' }),
  void: (id) => api.patch(`/order-tickets/${id}`, { status: 'ANULADA' }),
}

// ── Croquis del local ─────────────────────────────────────────────────────
/**
 * El plano del local vive en la columna `draw_croquislocal` (JSON) del local.
 * Es un documento único, no una colección: por eso no lleva `:id`.
 */
export const croquis = {
  get: (opts) => api.get('/croquis-local', opts),
  /** PUT /croquis-local { drawCroquisLocal } — se guarda el documento completo. */
  save: (drawCroquisLocal) => api.put('/croquis-local', { drawCroquisLocal }),
}

// ── Panel ─────────────────────────────────────────────────────────────────
export const dashboard = {
  /** GET /dashboard/resumen — KPIs agregados del día. */
  resumen: (opts) => api.get('/dashboard/resumen', opts),
}
