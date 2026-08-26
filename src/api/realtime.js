import { io } from 'socket.io-client'
import { busSocket } from './mock/bus.js'
import { CMD } from './events.js'

const USE_MOCK = String(import.meta.env.VITE_USE_MOCK) === 'true'

/**
 * URL del gateway. Por defecto se deriva de VITE_API_URL quitándole el prefijo
 * `/api`, porque el gateway de Nest corre en el mismo servidor HTTP.
 */
function urlDelGateway() {
  if (import.meta.env.VITE_SOCKET_URL) return import.meta.env.VITE_SOCKET_URL
  const api = import.meta.env.VITE_API_URL ?? ''
  return api.replace(/\/api\/?$/, '') || window.location.origin
}

let socket = null

/** Singleton: una sola conexión para toda la app. */
export function getSocket() {
  if (socket) return socket

  if (USE_MOCK) {
    socket = busSocket
    return socket
  }

  socket = io(urlDelGateway(), {
    path: import.meta.env.VITE_SOCKET_PATH ?? '/socket.io',
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 8000,
    // withCredentials: true, // actívalo si el gateway usa cookies de sesión
  })

  if (import.meta.env.DEV) {
    socket.on('connect', () => console.info('[socket] conectado', socket.id))
    socket.on('disconnect', (motivo) => console.warn('[socket] desconectado:', motivo))
    socket.on('connect_error', (e) => console.warn('[socket] error:', e.message))
  }

  return socket
}

export function unirseA(salas) {
  const s = getSocket()
  const lista = [].concat(salas).filter(Boolean)
  if (lista.length) s.emit(CMD.JOIN, lista)
}

export function salirDe(salas) {
  const s = getSocket()
  const lista = [].concat(salas).filter(Boolean)
  if (lista.length) s.emit(CMD.LEAVE, lista)
}

export const socketInfo = {
  USE_MOCK,
  get URL() {
    return USE_MOCK ? 'bus en memoria' : urlDelGateway()
  },
}
