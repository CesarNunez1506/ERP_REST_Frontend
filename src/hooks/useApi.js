import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Ejecuta una llamada a la API y expone { data, loading, error, refetch }.
 *
 * @param fn      función que recibe un AbortSignal y devuelve una promesa
 * @param deps    dependencias que disparan un refetch
 * @param options { enabled, refetchInterval }
 */
export function useFetch(fn, deps = [], { enabled = true, refetchInterval = 0 } = {}) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState(null)
  const fnRef = useRef(fn)
  fnRef.current = fn

  const ejecutar = useCallback(
    async ({ silencioso = false } = {}) => {
      if (!enabled) return
      const ctrl = new AbortController()
      if (!silencioso) setLoading(true)
      try {
        const res = await fnRef.current(ctrl.signal)
        setData(res)
        setError(null)
      } catch (e) {
        if (e.name !== 'AbortError') setError(e)
      } finally {
        setLoading(false)
      }
      return () => ctrl.abort()
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [enabled],
  )

  useEffect(() => {
    ejecutar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled])

  useEffect(() => {
    if (!refetchInterval || !enabled) return
    const t = setInterval(() => ejecutar({ silencioso: true }), refetchInterval)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refetchInterval, enabled, ...deps])

  return {
    data,
    loading,
    error,
    setData,
    refetch: useCallback((o) => ejecutar(o), [ejecutar]),
  }
}

/**
 * Envuelve una acción de escritura: expone `run` y el estado `saving`.
 * Los errores se propagan hacia arriba para que la pantalla decida qué mostrar.
 */
export function useAction() {
  const [saving, setSaving] = useState(false)
  const run = useCallback(async (fn) => {
    setSaving(true)
    try {
      return await fn()
    } finally {
      setSaving(false)
    }
  }, [])
  return { saving, run }
}

/** Reloj compartido: fuerza re-render cada `ms` para los cronómetros del KDS. */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}
