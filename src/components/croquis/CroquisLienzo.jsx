import { cx } from '../../lib/format.js'

/**
 * Dibujo del croquis. Es solo pintura: no guarda estado ni decide nada.
 * Lo usan tanto el plano en vivo del salón (modo "vista") como el editor
 * (modo "edicion"), así que lo que se ve en uno es exactamente lo que se
 * dibujó en el otro.
 */

const COLOR_MESA = {
  LIBRE: { relleno: '#d1fae5', borde: '#10b981', texto: '#065f46' },
  OCUPADA: { relleno: '#fef3c7', borde: '#f59e0b', texto: '#78350f' },
  POR_COBRAR: { relleno: '#e0f2fe', borde: '#0ea5e9', texto: '#075985' },
  SIN_VINCULO: { relleno: '#e7e7e5', borde: '#88887f', texto: '#474743' },
}

const PISO = '#fbfbfa'
const PARED = '#2b2b28'
const SILLA_ASIENTO = '#d1d1cd'
const SILLA_BORDE = '#88887f'
const SELECCION = '#ef6007'

function Pared({ pared, seleccionada, onPointerDown, interactivo }) {
  const d = pared.points.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ')
  return (
    <g>
      {/* Trazo ancho e invisible: da un área de clic cómoda sobre una línea fina. */}
      {interactivo && (
        <path
          d={d}
          stroke="transparent"
          strokeWidth={Math.max(pared.thickness ?? 10, 24)}
          fill="none"
          strokeLinecap="round"
          style={{ cursor: 'pointer' }}
          onPointerDown={onPointerDown}
        />
      )}
      <path
        d={d}
        stroke={seleccionada ? SELECCION : PARED}
        strokeWidth={pared.thickness ?? 10}
        strokeLinecap="square"
        strokeLinejoin="round"
        fill="none"
        pointerEvents="none"
      />
    </g>
  )
}

function Silla({ silla, seleccionada, onPointerDown, interactivo }) {
  return (
    <g
      transform={`translate(${silla.x} ${silla.y}) rotate(${silla.rotation ?? 0})`}
      style={interactivo ? { cursor: 'pointer' } : undefined}
      onPointerDown={onPointerDown}
    >
      {interactivo && <rect x={-18} y={-20} width={36} height={36} fill="transparent" />}
      {/* Respaldo arriba y asiento abajo: con rotation 0 la silla mira hacia +y. */}
      <rect
        x={-14}
        y={-16}
        width={28}
        height={7}
        rx={3}
        fill={seleccionada ? SELECCION : SILLA_BORDE}
      />
      <rect
        x={-13}
        y={-8}
        width={26}
        height={20}
        rx={6}
        fill={seleccionada ? '#ffdaa8' : SILLA_ASIENTO}
        stroke={seleccionada ? SELECCION : SILLA_BORDE}
        strokeWidth={2}
      />
    </g>
  )
}

function Mesa({ elemento, mesa, seleccionada, onPointerDown, onClick, interactivo, mostrarEstado }) {
  const color =
    (mostrarEstado && mesa?.status && COLOR_MESA[mesa.status]) || COLOR_MESA.SIN_VINCULO
  const { width: w, height: h } = elemento
  const etiqueta = mesa ? mesa.number : '?'

  return (
    <g
      transform={`translate(${elemento.x} ${elemento.y}) rotate(${elemento.rotation ?? 0})`}
      style={interactivo ? { cursor: 'pointer' } : undefined}
      onPointerDown={onPointerDown}
      onClick={onClick}
    >
      {elemento.shape === 'round' ? (
        <circle
          r={w / 2}
          fill={color.relleno}
          stroke={seleccionada ? SELECCION : color.borde}
          strokeWidth={seleccionada ? 5 : 3}
        />
      ) : (
        <rect
          x={-w / 2}
          y={-h / 2}
          width={w}
          height={h}
          rx={10}
          fill={color.relleno}
          stroke={seleccionada ? SELECCION : color.borde}
          strokeWidth={seleccionada ? 5 : 3}
        />
      )}
      <text
        y={mesa?.capacityPersons ? -2 : 8}
        textAnchor="middle"
        fontSize={26}
        fontWeight="700"
        fill={color.texto}
        pointerEvents="none"
      >
        {etiqueta}
      </text>
      {mesa?.capacityPersons ? (
        <text
          y={18}
          textAnchor="middle"
          fontSize={13}
          fill={color.texto}
          opacity={0.75}
          pointerEvents="none"
        >
          {mesa.capacityPersons} pers.
        </text>
      ) : null}
    </g>
  )
}

export default function CroquisLienzo({
  croquis,
  mesasPorId = {},
  modo = 'vista',
  seleccion = null,
  trazoEnCurso = null,
  cursor,
  svgRef,
  onFondoPointerDown,
  onElementoPointerDown,
  onPointerMove,
  onPointerUp,
  onMesaClick,
  className,
}) {
  const edicion = modo === 'edicion'
  const esSeleccion = (tipo, id) => seleccion?.tipo === tipo && seleccion?.id === id

  const pd = (tipo, id) => (evento) => onElementoPointerDown?.(evento, tipo, id)

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${croquis.width} ${croquis.height}`}
      className={cx('block h-auto w-full touch-none select-none', className)}
      style={cursor ? { cursor } : undefined}
      onPointerDown={onFondoPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      role="img"
      aria-label="Croquis del local"
    >
      <defs>
        <pattern id="cuadricula" width={croquis.grid} height={croquis.grid} patternUnits="userSpaceOnUse">
          <path
            d={`M ${croquis.grid} 0 L 0 0 0 ${croquis.grid}`}
            fill="none"
            stroke="#e7e7e5"
            strokeWidth={1}
          />
        </pattern>
      </defs>

      <rect width={croquis.width} height={croquis.height} fill={PISO} />
      {edicion && <rect width={croquis.width} height={croquis.height} fill="url(#cuadricula)" />}

      {croquis.walls.map((p) => (
        <Pared
          key={p.id}
          pared={p}
          interactivo={edicion}
          seleccionada={esSeleccion('pared', p.id)}
          onPointerDown={pd('pared', p.id)}
        />
      ))}

      {croquis.chairs.map((s) => (
        <Silla
          key={s.id}
          silla={s}
          interactivo={edicion}
          seleccionada={esSeleccion('silla', s.id)}
          onPointerDown={pd('silla', s.id)}
        />
      ))}

      {croquis.tables.map((m) => {
        const mesa = m.tableId ? mesasPorId[m.tableId] : null
        return (
          <Mesa
            key={m.id}
            elemento={m}
            mesa={mesa}
            mostrarEstado={!edicion}
            interactivo={edicion || Boolean(onMesaClick)}
            seleccionada={esSeleccion('mesa', m.id)}
            onPointerDown={edicion ? pd('mesa', m.id) : undefined}
            onClick={!edicion && onMesaClick && mesa ? () => onMesaClick(mesa) : undefined}
          />
        )
      })}

      {/* Pared que se está trazando en este momento */}
      {trazoEnCurso?.puntos?.length > 0 && (
        <g pointerEvents="none">
          <path
            d={[...trazoEnCurso.puntos, trazoEnCurso.cursor]
              .filter(Boolean)
              .map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`)
              .join(' ')}
            stroke={SELECCION}
            strokeWidth={trazoEnCurso.thickness ?? 10}
            strokeLinecap="square"
            strokeLinejoin="round"
            fill="none"
            opacity={0.7}
          />
          {trazoEnCurso.puntos.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={5} fill={SELECCION} />
          ))}
        </g>
      )}
    </svg>
  )
}

export { COLOR_MESA }
