/**
 * Modelo del croquis del local.
 *
 * El backend lo guarda entero en la columna `draw_croquislocal` (JSON), así que
 * el frontend es el dueño del formato: acá viven la forma del documento, los
 * valores por defecto y la geometría (grilla, sillas alrededor de una mesa).
 *
 * Coordenadas en unidades del lienzo (no píxeles): el SVG escala solo.
 * Referencia práctica: 20 unidades ≈ 25 cm de local.
 */

export const CROQUIS_VERSION = 1
export const GRID = 20
export const LIENZO = { width: 1200, height: 800 }

/** Grosor por defecto de una pared, en unidades del lienzo. */
export const PARED_GROSOR = 10

export function croquisVacio() {
  return {
    version: CROQUIS_VERSION,
    width: LIENZO.width,
    height: LIENZO.height,
    grid: GRID,
    walls: [],
    tables: [],
    chairs: [],
  }
}

/**
 * Acepta lo que venga del backend (o un `null` la primera vez) y devuelve
 * siempre un documento válido. Si `draw_croquislocal` llega como string JSON
 * —cosa habitual si la columna es TEXT y no JSONB— también lo entiende.
 */
export function normalizarCroquis(bruto) {
  let doc = bruto
  if (typeof doc === 'string') {
    try {
      doc = JSON.parse(doc)
    } catch {
      doc = null
    }
  }
  if (!doc || typeof doc !== 'object') return croquisVacio()

  const base = croquisVacio()
  return {
    ...base,
    ...doc,
    width: Number(doc.width) || base.width,
    height: Number(doc.height) || base.height,
    grid: Number(doc.grid) || base.grid,
    walls: Array.isArray(doc.walls) ? doc.walls.filter((w) => w?.points?.length >= 2) : [],
    tables: Array.isArray(doc.tables) ? doc.tables : [],
    chairs: Array.isArray(doc.chairs) ? doc.chairs : [],
  }
}

let contador = 0
export const nuevoId = (prefijo) =>
  `${prefijo}_${Date.now().toString(36)}${(contador++).toString(36)}`

export const ajustarGrilla = (v, g = GRID) => Math.round(v / g) * g

export const acotar = (v, min, max) => Math.min(max, Math.max(min, v))

/** Medidas sugeridas de una mesa según su capacidad (TABLE.capacity_persons). */
export function medidasPorCapacidad(capacidad = 4) {
  if (capacidad <= 2) return { shape: 'round', width: 80, height: 80 }
  if (capacidad <= 4) return { shape: 'rect', width: 100, height: 80 }
  if (capacidad <= 6) return { shape: 'rect', width: 140, height: 80 }
  if (capacidad <= 8) return { shape: 'rect', width: 180, height: 100 }
  return { shape: 'rect', width: 220, height: 100 }
}

export function nuevaMesa({ tableId, capacidad, x, y }) {
  return {
    id: nuevoId('mesa'),
    tableId: tableId ?? null,
    x: ajustarGrilla(x),
    y: ajustarGrilla(y),
    rotation: 0,
    ...medidasPorCapacidad(capacidad),
  }
}

export function nuevaSilla({ x, y, rotation = 0, mesaId = null }) {
  return {
    id: nuevoId('silla'),
    mesaId,
    x: ajustarGrilla(x),
    y: ajustarGrilla(y),
    rotation,
  }
}

export function nuevaPared(points, thickness = PARED_GROSOR) {
  return { id: nuevoId('pared'), points, thickness }
}

/**
 * Reparte `cantidad` sillas alrededor de una mesa, mirando hacia ella.
 *
 * Convención de giro: una silla con `rotation: 0` mira hacia abajo (+y), que es
 * como debe quedar la que está por encima de la mesa. En SVG el giro es horario,
 * así que 90 = mira a la izquierda, 180 = mira arriba, 270 = mira a la derecha.
 */
export function sillasAlrededor(mesa, cantidad, separacion = 30) {
  const n = acotar(Math.round(cantidad ?? 0), 0, 24)
  if (!n || !mesa) return []

  if (mesa.shape === 'round') {
    const radio = mesa.width / 2 + separacion
    return Array.from({ length: n }, (_, i) => {
      const ang = (i / n) * 360 - 90 // se arranca por arriba
      const rad = (ang * Math.PI) / 180
      return nuevaSillaLibre({
        mesaId: mesa.id,
        x: mesa.x + Math.cos(rad) * radio,
        y: mesa.y + Math.sin(rad) * radio,
        rotation: Math.round(ang + 90),
      })
    })
  }

  // Rectangular: se reparte por lado, proporcional al largo de cada uno.
  const { width: w, height: h } = mesa
  const proporcion = w / (w + h)
  const arriba = Math.max(1, Math.round((n * proporcion) / 2))
  const abajo = Math.min(n - arriba, Math.max(1, Math.round((n * proporcion) / 2)))
  const sobran = Math.max(0, n - arriba - abajo)
  const izquierda = Math.floor(sobran / 2)
  const derecha = sobran - izquierda

  const sillas = []
  const repartir = (cantidadLado, fn) => {
    for (let i = 0; i < cantidadLado; i++) sillas.push(fn((i + 1) / (cantidadLado + 1)))
  }

  // rotation 0 mira abajo → la fila de arriba encara la mesa
  repartir(arriba, (t) =>
    nuevaSillaLibre({
      mesaId: mesa.id,
      x: mesa.x - w / 2 + w * t,
      y: mesa.y - h / 2 - separacion,
      rotation: 0,
    }),
  )
  repartir(abajo, (t) =>
    nuevaSillaLibre({
      mesaId: mesa.id,
      x: mesa.x - w / 2 + w * t,
      y: mesa.y + h / 2 + separacion,
      rotation: 180,
    }),
  )
  repartir(izquierda, (t) =>
    nuevaSillaLibre({
      mesaId: mesa.id,
      x: mesa.x - w / 2 - separacion,
      y: mesa.y - h / 2 + h * t,
      rotation: 270,
    }),
  )
  repartir(derecha, (t) =>
    nuevaSillaLibre({
      mesaId: mesa.id,
      x: mesa.x + w / 2 + separacion,
      y: mesa.y - h / 2 + h * t,
      rotation: 90,
    }),
  )

  return sillas
}

/** Igual que `nuevaSilla` pero sin ajustar a la grilla (las sillas van al ras de la mesa). */
function nuevaSillaLibre({ x, y, rotation, mesaId }) {
  return {
    id: nuevoId('silla'),
    mesaId: mesaId ?? null,
    x: Math.round(x),
    y: Math.round(y),
    rotation: Math.round(rotation),
  }
}

/** Vuelve a colocar las sillas de una mesa (borra las suyas y las regenera). */
export function recolocarSillas(croquis, mesa, cantidad) {
  const otras = croquis.chairs.filter((s) => s.mesaId !== mesa.id)
  return { ...croquis, chairs: [...otras, ...sillasAlrededor(mesa, cantidad)] }
}

/** Mueve una mesa y arrastra con ella las sillas que tenga asignadas. */
export function moverMesa(croquis, mesaId, dx, dy) {
  return {
    ...croquis,
    tables: croquis.tables.map((m) => (m.id === mesaId ? { ...m, x: m.x + dx, y: m.y + dy } : m)),
    chairs: croquis.chairs.map((s) =>
      s.mesaId === mesaId ? { ...s, x: s.x + dx, y: s.y + dy } : s,
    ),
  }
}

export function quitarElemento(croquis, tipo, id) {
  if (tipo === 'mesa') {
    return {
      ...croquis,
      tables: croquis.tables.filter((m) => m.id !== id),
      // Las sillas de esa mesa se van con ella.
      chairs: croquis.chairs.filter((s) => s.mesaId !== id),
    }
  }
  if (tipo === 'silla') return { ...croquis, chairs: croquis.chairs.filter((s) => s.id !== id) }
  if (tipo === 'pared') return { ...croquis, walls: croquis.walls.filter((p) => p.id !== id) }
  return croquis
}

/** Cuenta cuántos elementos tiene el croquis, para el resumen del editor. */
export function resumen(croquis) {
  return {
    paredes: croquis.walls.length,
    mesas: croquis.tables.length,
    sillas: croquis.chairs.length,
    sinUbicar: 0,
  }
}

/** Distancia de un punto a un segmento — se usa para seleccionar paredes. */
export function distanciaASegmento(px, py, [x1, y1], [x2, y2]) {
  const dx = x2 - x1
  const dy = y2 - y1
  const largo2 = dx * dx + dy * dy
  if (!largo2) return Math.hypot(px - x1, py - y1)
  let t = ((px - x1) * dx + (py - y1) * dy) / largo2
  t = acotar(t, 0, 1)
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}

export function distanciaAPared(px, py, pared) {
  let min = Infinity
  for (let i = 0; i < pared.points.length - 1; i++) {
    min = Math.min(min, distanciaASegmento(px, py, pared.points[i], pared.points[i + 1]))
  }
  return min
}
