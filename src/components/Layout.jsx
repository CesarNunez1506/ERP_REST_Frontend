import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import Icon from './Icon.jsx'
import { Badge, Dot } from './ui.jsx'
import { apiInfo } from '../api/client.js'
import { socketInfo } from '../api/realtime.js'
import { dashboard } from '../api/endpoints.js'
import { GRUPOS, ROOM } from '../api/events.js'
import { useFetch } from '../hooks/useApi.js'
import { useConexion, useRefetchEnEventos, useSalas } from '../hooks/useRealtime.js'
import { cx } from '../lib/format.js'

const NAV = [
  { to: '/', icon: 'panel', label: 'Panel', end: true },
  { to: '/mesas', icon: 'mesas', label: 'Salón' },
  { to: '/ordenes', icon: 'ordenes', label: 'Órdenes' },
  { to: '/cocina', icon: 'cocina', label: 'Cocina (KDS)', badge: 'platosEnCola' },
  { to: '/caja', icon: 'caja', label: 'Caja' },
  { to: '/carta', icon: 'carta', label: 'Carta' },
  { to: '/estaciones', icon: 'estaciones', label: 'Estaciones' },
  { to: '/personal', icon: 'personal', label: 'Personal' },
]

function Marca() {
  return (
    <div className="flex items-center gap-2.5 px-2">
      <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-brasa-600 text-white">
        <Icon name="fuego" size={20} />
      </div>
      <div className="leading-tight">
        <p className="text-sm font-bold text-white">Sabor &amp; Fuego</p>
        <p className="text-[11px] text-carbon-400">ERP Restaurante</p>
      </div>
    </div>
  )
}

function Nav({ contadores, onNavigate }) {
  return (
    <nav className="mt-6 flex-1 space-y-0.5 px-2">
      {NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cx(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              isActive
                ? 'bg-brasa-600/15 text-brasa-300'
                : 'text-carbon-300 hover:bg-carbon-800 hover:text-white',
            )
          }
        >
          <Icon name={item.icon} size={18} />
          <span className="flex-1">{item.label}</span>
          {item.badge && contadores?.[item.badge] > 0 && (
            <span className="rounded-full bg-brasa-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
              {contadores[item.badge]}
            </span>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

function EstadoConexion({ compacto = false }) {
  const { conectado, transporte } = useConexion()

  if (compacto) {
    return (
      <Badge tone={conectado ? 'ok' : 'danger'}>
        <Dot tone={conectado ? 'ok' : 'danger'} pulse={!conectado} />
        {conectado ? 'En vivo' : 'Sin conexión'}
      </Badge>
    )
  }

  return (
    <div className="rounded-lg bg-carbon-800/70 px-3 py-2.5">
      <p className="text-[10px] font-semibold tracking-wide text-carbon-400 uppercase">Backend</p>
      <p className="mt-1 truncate font-mono text-[11px] text-carbon-300">{apiInfo.BASE_URL}</p>
      <p className="mt-1.5 text-[10px] text-carbon-400">
        {apiInfo.USE_MOCK ? '🟡 Mock en memoria' : '🟢 NestJS'}
      </p>
      <div className="mt-2 flex items-center gap-1.5 border-t border-carbon-700/60 pt-2">
        <Dot tone={conectado ? 'ok' : 'danger'} pulse={!conectado} />
        <span className="text-[10px] text-carbon-300">
          {conectado ? 'Socket conectado' : 'Reconectando…'}
        </span>
        {transporte && <span className="ml-auto text-[10px] text-carbon-500">{transporte}</span>}
      </div>
      <p className="mt-1 truncate font-mono text-[10px] text-carbon-500">{socketInfo.URL}</p>
    </div>
  )
}

export default function Layout() {
  const [abierto, setAbierto] = useState(false)

  // El contador de la cola vive del gateway; el intervalo largo es solo la red
  // de seguridad por si se perdió algún evento durante una reconexión.
  const { data: resumen, refetch } = useFetch((signal) => dashboard.resumen({ signal }), [], {
    refetchInterval: 120_000,
  })

  useSalas([ROOM.SALON, ROOM.COCINA, ROOM.CAJA])
  useRefetchEnEventos([...GRUPOS.cocina, ...GRUPOS.salon], refetch)

  return (
    <div className="flex h-full">
      {/* Barra lateral — escritorio */}
      <aside className="hidden w-64 shrink-0 flex-col bg-carbon-900 py-5 lg:flex">
        <Marca />
        <Nav contadores={resumen} />
        <div className="px-4 pt-4">
          <EstadoConexion />
        </div>
      </aside>

      {/* Barra lateral — móvil */}
      {abierto && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-carbon-950/60"
            onClick={() => setAbierto(false)}
            aria-hidden="true"
          />
          <aside className="relative flex h-full w-64 flex-col bg-carbon-900 py-5">
            <Marca />
            <Nav contadores={resumen} onNavigate={() => setAbierto(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-carbon-200 bg-white px-4 py-3 lg:hidden">
          <button
            onClick={() => setAbierto(true)}
            className="rounded-lg p-2 text-carbon-600 hover:bg-carbon-100"
            aria-label="Abrir menú"
          >
            <Icon name="menu" size={20} />
          </button>
          <span className="text-sm font-bold text-carbon-900">Sabor &amp; Fuego</span>
          <div className="ml-auto flex items-center gap-2">
            {apiInfo.USE_MOCK && <Badge tone="warn">Mock</Badge>}
            <EstadoConexion compacto />
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
