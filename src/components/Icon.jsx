const PATHS = {
  panel: 'M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10 0h8V11h-8v10Zm0-18v6h8V3h-8Z',
  mesas:
    'M3 7h18M5 7v3a7 7 0 0 0 14 0V7M12 17v4M8.5 21h7',
  ordenes:
    'M7 3h10a2 2 0 0 1 2 2v16l-3-2-2 2-2-2-2 2-3-2V5a2 2 0 0 1 2-2Zm2 5h6M9 12h6M9 16h3',
  cocina:
    'M6 3v7a3 3 0 0 0 6 0V3M9 3v7M15 3c-1.5 0-2.5 2-2.5 4.5S13.5 12 15 12s2.5-2 2.5-4.5S16.5 3 15 3ZM9 13v8M15 12v9',
  caja: 'M3 8h18v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Zm2 0 2-5h10l2 5M9 13h6',
  carta:
    'M4 4h16v16H4V4Zm3 4h10M7 12h10M7 16h6',
  estaciones:
    'M4 6h16M4 12h16M4 18h16M8 4v4M16 10v4M10 16v4',
  personal:
    'M16 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM21 20v-1a4 4 0 0 0-3-3.87M16.5 4.13a4 4 0 0 1 0 7.75',
  mas: 'M12 5v14M5 12h14',
  refresh: 'M20 11a8 8 0 1 0-2.3 5.6M20 5v6h-6',
  reloj: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2',
  fuego:
    'M12 22a7 7 0 0 0 7-7c0-4-3-6-4-9-2 1-3 3-3 5-1-1-1.5-2.5-1.5-4C8 9 5 11 5 15a7 7 0 0 0 7 7Z',
  alerta: 'M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
  check: 'M20 6 9 17l-5-5',
  flecha: 'M5 12h14M13 6l6 6-6 6',
  atras: 'M19 12H5M11 18l-6-6 6-6',
  menu: 'M4 6h16M4 12h16M4 18h16',
  billete: 'M2 6h20v12H2V6Zm10 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
  basura: 'M4 7h16M10 11v6M14 11v6M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M9 7V4h6v3',
  lapiz: 'M4 20h4L19 9a2.8 2.8 0 1 0-4-4L4 16v4Z',
  enviar: 'M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z',
}

export default function Icon({ name, size = 18, className, strokeWidth = 1.8 }) {
  const d = PATHS[name]
  if (!d) return null
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  )
}
