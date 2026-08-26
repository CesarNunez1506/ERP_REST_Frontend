/**
 * Bus de eventos del mock: hace de gateway de Socket.IO mientras el backend
 * NestJS no está. Misma superficie mínima (`on` / `off` / `emit`) que el socket
 * real, para que `realtime.js` no tenga que ramificar en cada llamada.
 *
 * Diferencia esperable: el bus vive dentro de una pestaña, así que no propaga
 * entre navegadores. Sirve para ver el KDS reaccionar al instante, no para
 * probar concurrencia real — eso llega con el gateway.
 */
const oyentes = new Map()

function alta(evento, cb) {
  if (!oyentes.has(evento)) oyentes.set(evento, new Set())
  oyentes.get(evento).add(cb)
}

function baja(evento, cb) {
  oyentes.get(evento)?.delete(cb)
}

/** Lo llama el mock server después de cada mutación. */
export function publicar(evento, payload) {
  // `queueMicrotask` imita que el evento llega después de la respuesta HTTP,
  // igual que haría el gateway al emitir tras responder el controller.
  queueMicrotask(() => {
    oyentes.get(evento)?.forEach((cb) => cb(payload))
    oyentes.get('*')?.forEach((cb) => cb({ evento, payload }))
  })
}

/** Adaptador con la forma de un socket de socket.io-client. */
export const busSocket = {
  connected: true,
  io: { engine: { transport: { name: 'mock' } } },
  on(evento, cb) {
    // `connect` se resuelve al toque: el bus siempre está "conectado".
    if (evento === 'connect') queueMicrotask(cb)
    else alta(evento, cb)
    return this
  },
  off(evento, cb) {
    baja(evento, cb)
    return this
  },
  emit() {
    // join / leave no aplican: el bus no tiene salas, entrega todo.
    return this
  },
  connect() {
    return this
  },
  disconnect() {
    return this
  },
}
