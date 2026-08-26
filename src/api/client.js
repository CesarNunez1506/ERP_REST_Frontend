import { mockFetch } from './mock/server.js'

const BASE_URL = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/$/, '')
const USE_MOCK = String(import.meta.env.VITE_USE_MOCK) === 'true'

/** Error normalizado: siempre trae `status` y `message` legible. */
export class ApiError extends Error {
  constructor(message, { status, body } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status ?? 0
    this.body = body
  }
}

/**
 * NestJS responde los errores como { statusCode, message, error }.
 * Con ValidationPipe, `message` es un array de strings (uno por campo inválido).
 */
function mensajeDeNest(body, status) {
  if (!body) return `Error ${status}`
  if (Array.isArray(body.message)) return body.message.join(' · ')
  if (typeof body.message === 'string') return body.message
  if (typeof body.error === 'string') return body.error
  return `Error ${status}`
}

function url(path, query) {
  const base = `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
  if (!query) return base
  const limpio = Object.entries(query).filter(
    ([, v]) => v !== undefined && v !== null && v !== '',
  )
  if (!limpio.length) return base
  return `${base}?${new URLSearchParams(limpio)}`
}

async function request(method, path, { body, query, signal } = {}) {
  const target = url(path, query)

  const init = {
    method,
    signal,
    headers: { Accept: 'application/json' },
  }
  if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json'
    init.body = JSON.stringify(body)
  }

  // Mientras el backend NestJS no esté arriba, el mock responde el mismo contrato.
  const doFetch = USE_MOCK ? mockFetch : fetch

  let res
  try {
    res = await doFetch(target, init)
  } catch (e) {
    if (e.name === 'AbortError') throw e
    throw new ApiError(
      `No se pudo contactar al servidor (${BASE_URL}). ¿Está corriendo el backend?`,
      { status: 0 },
    )
  }

  if (res.status === 204) return null

  const texto = await res.text()
  let data = null
  if (texto) {
    try {
      data = JSON.parse(texto)
    } catch {
      data = texto
    }
  }

  if (!res.ok) throw new ApiError(mensajeDeNest(data, res.status), { status: res.status, body: data })

  return data
}

export const api = {
  get: (path, opts) => request('GET', path, opts),
  post: (path, body, opts) => request('POST', path, { ...opts, body }),
  patch: (path, body, opts) => request('PATCH', path, { ...opts, body }),
  put: (path, body, opts) => request('PUT', path, { ...opts, body }),
  delete: (path, opts) => request('DELETE', path, opts),
}

export const apiInfo = { BASE_URL, USE_MOCK }
