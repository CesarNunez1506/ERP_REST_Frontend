import { createServer } from 'vite'

const root = 'c:/Users/cesar/OneDrive/Desktop/Eduardo/Proyecto_Yostin'
const vite = await createServer({ root, server: { middlewareMode: true }, appType: 'custom' })

const { mockFetch } = await vite.ssrLoadModule('/src/api/mock/server.js')
globalThis.fetch = mockFetch
const { api } = await vite.ssrLoadModule('/src/api/client.js')
const { busSocket } = await vite.ssrLoadModule('/src/api/mock/bus.js')
const { EV } = await vite.ssrLoadModule('/src/api/events.js')
const C = await vite.ssrLoadModule('/src/lib/croquis.js')

let fallos = 0
const check = (n, cond, extra = '') => {
  console.log(`${cond ? '  ok  ' : ' FALLA'} ${n}${extra ? ` — ${extra}` : ''}`)
  if (!cond) fallos++
}

const recibidos = []
busSocket.on('*', (e) => recibidos.push(e))
const vaciar = () => recibidos.splice(0)
const esperar = () => new Promise((r) => setTimeout(r, 30))
const hubo = (ev) => recibidos.filter((e) => e.evento === ev)

console.log('\n== Geometría del croquis ==')
check('croquisVacio es válido', C.croquisVacio().walls.length === 0 && C.croquisVacio().version === 1)
check('normalizarCroquis(null) no revienta', C.normalizarCroquis(null).tables.length === 0)
check('normalizarCroquis acepta JSON en string',
  C.normalizarCroquis(JSON.stringify({ tables: [{ id: 'a' }] })).tables.length === 1)
check('normalizarCroquis descarta basura', C.normalizarCroquis('{no es json').walls.length === 0)
check('normalizarCroquis filtra paredes de 1 punto',
  C.normalizarCroquis({ walls: [{ id: 'x', points: [[0, 0]] }, { id: 'y', points: [[0, 0], [10, 0]] }] }).walls.length === 1)

check('ajustarGrilla redondea a 20', C.ajustarGrilla(37) === 40 && C.ajustarGrilla(29) === 20)
check('capacidad 2 => mesa redonda', C.medidasPorCapacidad(2).shape === 'round')
check('capacidad 10 => la mesa más grande', C.medidasPorCapacidad(10).width === 220)

// Sillas alrededor de una mesa rectangular
const mesaRect = C.nuevaMesa({ tableId: 1, capacidad: 6, x: 400, y: 300 })
const s6 = C.sillasAlrededor(mesaRect, 6)
check('reparte exactamente 6 sillas', s6.length === 6, `${s6.length}`)
check('todas quedan fuera de la mesa', s6.every((s) =>
  Math.abs(s.x - mesaRect.x) > mesaRect.width / 2 || Math.abs(s.y - mesaRect.y) > mesaRect.height / 2))
check('todas quedan asignadas a la mesa', s6.every((s) => s.mesaId === mesaRect.id))

// Orientación: la silla de arriba mira hacia abajo (0°), la de abajo hacia arriba (180°)
const arriba = s6.filter((s) => s.y < mesaRect.y)
const abajo = s6.filter((s) => s.y > mesaRect.y)
check('las sillas de arriba miran a la mesa (0°)', arriba.length > 0 && arriba.every((s) => s.rotation === 0))
check('las sillas de abajo miran a la mesa (180°)', abajo.length > 0 && abajo.every((s) => s.rotation === 180))

// Cantidades raras
check('0 sillas devuelve lista vacía', C.sillasAlrededor(mesaRect, 0).length === 0)
check('cantidad se acota a 24', C.sillasAlrededor(mesaRect, 999).length === 24)
for (const n of [1, 2, 3, 4, 5, 7, 8, 10, 12]) {
  const s = C.sillasAlrededor(mesaRect, n)
  if (s.length !== n) check(`reparte ${n} sillas`, false, `dio ${s.length}`)
}
check('reparte bien cualquier cantidad de 1 a 12', true)

// Mesa redonda: las sillas miran al centro
const mesaRedonda = C.nuevaMesa({ tableId: 2, capacidad: 2, x: 300, y: 300 })
const s4 = C.sillasAlrededor(mesaRedonda, 4)
check('mesa redonda reparte 4 sillas', s4.length === 4)
const radios = s4.map((s) => Math.hypot(s.x - 300, s.y - 300))
check('todas a la misma distancia del centro', Math.max(...radios) - Math.min(...radios) < 2)
const sillaArriba = s4.find((s) => s.y < 295 && Math.abs(s.x - 300) < 5)
check('la silla de arriba mira hacia abajo', sillaArriba?.rotation === 0, `${sillaArriba?.rotation}°`)

// Mover mesa arrastra sus sillas
let doc = { ...C.croquisVacio(), tables: [mesaRect], chairs: s6 }
const movido = C.moverMesa(doc, mesaRect.id, 100, -40)
check('mover la mesa la desplaza', movido.tables[0].x === 500 && movido.tables[0].y === 260)
check('las sillas se mueven con ella',
  movido.chairs.every((s, i) => s.x === s6[i].x + 100 && s.y === s6[i].y - 40))

// Borrar mesa se lleva sus sillas
const sinMesa = C.quitarElemento(doc, 'mesa', mesaRect.id)
check('borrar la mesa borra sus sillas', sinMesa.tables.length === 0 && sinMesa.chairs.length === 0)

// Recolocar reemplaza, no acumula
const recolocado = C.recolocarSillas(doc, mesaRect, 4)
check('recolocar reemplaza las sillas', recolocado.chairs.length === 4)

// Silla suelta no se borra al quitar la mesa
const conSuelta = { ...doc, chairs: [...s6, C.nuevaSilla({ x: 900, y: 700 })] }
check('la silla suelta sobrevive',
  C.quitarElemento(conSuelta, 'mesa', mesaRect.id).chairs.length === 1)

// Distancia a pared (se usa para seleccionar con clic)
const pared = C.nuevaPared([[100, 100], [300, 100]])
check('clic sobre la pared da distancia ~0', C.distanciaAPared(200, 100, pared) < 1)
check('clic lejos da distancia grande', C.distanciaAPared(200, 260, pared) === 160)
check('la distancia se mide al segmento, no a los extremos',
  C.distanciaAPared(500, 100, pared) === 200)

console.log('\n== Endpoint /croquis-local ==')
const local = await api.get('/croquis-local')
check('GET devuelve el local con drawCroquisLocal', Boolean(local.drawCroquisLocal))
const plano = C.normalizarCroquis(local.drawCroquisLocal)
check('la semilla trae paredes', plano.walls.length >= 5, `${plano.walls.length}`)
check('la semilla ubica las 12 mesas', plano.tables.length === 12, `${plano.tables.length}`)
check('la semilla trae sillas', plano.chairs.length > 40, `${plano.chairs.length}`)

const mesasApi = await api.get('/tables')
const idsReales = new Set(mesasApi.map((m) => m.id))
check('cada mesa del croquis apunta a un TABLE real',
  plano.tables.every((m) => idsReales.has(m.tableId)))
check('no hay dos elementos para la misma mesa',
  new Set(plano.tables.map((m) => m.tableId)).size === plano.tables.length)
check('ninguna mesa queda fuera del lienzo',
  plano.tables.every((m) => m.x > 0 && m.x < plano.width && m.y > 0 && m.y < plano.height))
check('ninguna silla queda fuera del lienzo',
  plano.chairs.every((s) => s.x > 0 && s.x < plano.width && s.y > 0 && s.y < plano.height))
check('cada mesa tiene tantas sillas como capacidad', plano.tables.every((el) => {
  const mesa = mesasApi.find((m) => m.id === el.tableId)
  return plano.chairs.filter((s) => s.mesaId === el.id).length === mesa.capacityPersons
}))

vaciar()
const guardado = await api.put('/croquis-local', {
  drawCroquisLocal: { ...plano, walls: [...plano.walls, C.nuevaPared([[200, 200], [400, 200]])] },
})
await esperar()
check('PUT guarda el croquis', guardado.drawCroquisLocal.walls.length === plano.walls.length + 1)
check('PUT actualiza updatedAt', guardado.updatedAt !== local.updatedAt)
check('PUT emite croquis.updated', hubo(EV.CROQUIS_UPDATED).length === 1)
check('el evento trae el croquis completo',
  hubo(EV.CROQUIS_UPDATED)[0].payload.drawCroquisLocal.tables.length === 12)

const releido = await api.get('/croquis-local')
check('lo guardado persiste', releido.drawCroquisLocal.walls.length === plano.walls.length + 1)

const malo = await api.put('/croquis-local', { drawCroquisLocal: 'no soy un objeto' }).catch((e) => e)
check('400 si drawCroquisLocal no es objeto', malo.status === 400, malo.message)

const huerfana = await api
  .put('/croquis-local', { drawCroquisLocal: { ...plano, tables: [...plano.tables, { id: 'x', tableId: 9999 }] } })
  .catch((e) => e)
check('409 si el croquis apunta a una mesa inexistente', huerfana.status === 409, huerfana.message)

await vite.close()
console.log(fallos ? `\n❌ ${fallos} fallo(s)` : '\n✅ Todo verde')
process.exit(fallos ? 1 : 0)
