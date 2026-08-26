import { useEffect, useRef, useState } from 'react'
import { getSocket, salirDe, unirseA } from '../api/realtime.js'

/**
 * Suscribe el componente a una lista de eventos del gateway.
 * El handler se guarda en un ref, así que puede cambiar en cada render sin
 * provocar que la suscripción se desmonte y se vuelva a montar.
 */
export function useRealtime(eventos, handler, { enabled = true } = {}) {
  const ref = useRef(handler)
  ref.current = handler
  const clave = [].concat(eventos).join('|')

  useEffect(() => {
    if (!enabled || !clave) return
    const socket = getSocket()
    const lista = clave.split('|')
    const oyentes = lista.map((evento) => {
      const cb = (payload) => ref.current?.(payload, evento)
      socket.on(evento, cb)
      return [evento, cb]
    })
    return () => oyentes.forEach(([evento, cb]) => socket.off(evento, cb))
  }, [clave, enabled])
}

/** Entra a las salas del gateway mientras el componente esté montado. */
export function useSalas(salas, { enabled = true } = {}) {
  const clave = [].concat(salas).filter(Boolean).join('|')

  useEffect(() => {
    if (!enabled || !clave) return
    const lista = clave.split('|')
    unirseA(lista)
    return () => salirDe(lista)
  }, [clave, enabled])
}

/**
 * Refresca una consulta cuando llega cualquiera de los eventos indicados.
 * Agrupa las ráfagas (varios platos avanzando a la vez) en un solo refetch.
 */
export function useRefetchEnEventos(eventos, refetch, { enabled = true, espera = 250 } = {}) {
  const timer = useRef(null)

  useRealtime(
    eventos,
    () => {
      clearTimeout(timer.current)
      timer.current = setTimeout(() => refetch({ silencioso: true }), espera)
    },
    { enabled },
  )

  useEffect(() => () => clearTimeout(timer.current), [])
}

/** Estado de la conexión, para el indicador de la barra lateral. */
export function useConexion() {
  const [conectado, setConectado] = useState(() => getSocket().connected)
  const [transporte, setTransporte] = useState(
    () => getSocket().io?.engine?.transport?.name ?? null,
  )

  useEffect(() => {
    const socket = getSocket()
    const alConectar = () => {
      setConectado(true)
      setTransporte(socket.io?.engine?.transport?.name ?? null)
    }
    const alCortar = () => setConectado(false)

    socket.on('connect', alConectar)
    socket.on('disconnect', alCortar)
    socket.on('connect_error', alCortar)

    return () => {
      socket.off('connect', alConectar)
      socket.off('disconnect', alCortar)
      socket.off('connect_error', alCortar)
    }
  }, [])

  return { conectado, transporte }
}
