import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../components/Icon.jsx'
import CroquisLienzo from '../components/croquis/CroquisLienzo.jsx'
import {
  Badge,
  Button,
  Card,
  ErrorState,
  Field,
  Input,
  Loading,
  PageHeader,
  Select,
  useToast,
} from '../components/ui.jsx'
import { croquis as croquisApi, tables } from '../api/endpoints.js'
import { useAction, useFetch } from '../hooks/useApi.js'
import {
  ajustarGrilla,
  acotar,
  medidasPorCapacidad,
  moverMesa,
  normalizarCroquis,
  nuevaMesa,
  nuevaPared,
  nuevaSilla,
  quitarElemento,
  recolocarSillas,
  distanciaAPared,
} from '../lib/croquis.js'
import { cx } from '../lib/format.js'

const HERRAMIENTAS = [
  { id: 'sel', label: 'Seleccionar', icono: 'flecha', tecla: 'V', ayuda: 'Arrastra para mover. Supr borra. Flechas mueven de a poco.' },
  { id: 'pared', label: 'Pared', icono: 'estaciones', tecla: 'P', ayuda: 'Clic por cada esquina. Enter termina, Esc cancela. Shift fuerza recta.' },
  { id: 'mesa', label: 'Mesa', icono: 'mesas', tecla: 'M', ayuda: 'Elige la mesa de la lista y haz clic donde va.' },
  { id: 'silla', label: 'Silla', icono: 'personal', tecla: 'S', ayuda: 'Clic para poner una silla suelta. Gírala en el panel derecho.' },
  { id: 'borrar', label: 'Borrar', icono: 'basura', tecla: 'B', ayuda: 'Clic sobre lo que quieras eliminar.' },
]

const CURSOR = { sel: 'default', pared: 'crosshair', mesa: 'copy', silla: 'copy', borrar: 'not-allowed' }

export default function CroquisEditor() {
  const navigate = useNavigate()
  const toast = useToast()
  const { saving, run } = useAction()
  const svgRef = useRef(null)

  const [doc, setDoc] = useState(null)
  const [historial, setHistorial] = useState([])
  const [futuro, setFuturo] = useState([])
  const [sucio, setSucio] = useState(false)

  const [herramienta, setHerramienta] = useState('sel')
  const [seleccion, setSeleccion] = useState(null)
  const [trazo, setTrazo] = useState(null)
  const [conSillas, setConSillas] = useState(true)
  const [mesaAColocar, setMesaAColocar] = useState('')

  const arrastre = useRef(null)

  const local = useFetch((signal) => croquisApi.get({ signal }), [])
  const salon = useFetch((signal) => tables.list(undefined, { signal }), [])

  // Se carga el documento una sola vez; a partir de ahí manda el editor.
  useEffect(() => {
    if (local.data && !doc) setDoc(normalizarCroquis(local.data.drawCroquisLocal))
  }, [local.data, doc])

  const mesasPorId = useMemo(
    () => Object.fromEntries((salon.data ?? []).map((m) => [m.id, m])),
    [salon.data],
  )

  const ubicadas = useMemo(
    () => new Set((doc?.tables ?? []).map((m) => m.tableId).filter(Boolean)),
    [doc],
  )

  const sinUbicar = useMemo(
    () => (salon.data ?? []).filter((m) => !ubicadas.has(m.id)),
    [salon.data, ubicadas],
  )

  // La mesa a colocar sigue a la lista de pendientes sin que haya que elegirla.
  useEffect(() => {
    if (!mesaAColocar || ubicadas.has(Number(mesaAColocar))) {
      setMesaAColocar(sinUbicar[0] ? String(sinUbicar[0].id) : '')
    }
  }, [sinUbicar, mesaAColocar, ubicadas])

  // ── Historial ───────────────────────────────────────────────────────────
  // Cada `aplicar` apila una entrada. Se guardan documentos completos: el
  // croquis es chico (unas decenas de elementos) y así deshacer es trivial.
  const aplicar = useCallback(
    (siguiente) => {
      if (!doc) return
      const nuevo = typeof siguiente === 'function' ? siguiente(doc) : siguiente
      if (!nuevo || nuevo === doc) return
      setHistorial((h) => [...h.slice(-49), doc])
      setFuturo([])
      setDoc(nuevo)
      setSucio(true)
    },
    [doc],
  )

  const deshacer = useCallback(() => {
    if (!historial.length) return
    setDoc(historial[historial.length - 1])
    setHistorial(historial.slice(0, -1))
    setFuturo((f) => [doc, ...f])
    setSucio(true)
    setSeleccion(null)
  }, [historial, doc])

  const rehacer = useCallback(() => {
    if (!futuro.length) return
    setDoc(futuro[0])
    setFuturo(futuro.slice(1))
    setHistorial((h) => [...h, doc])
    setSucio(true)
    setSeleccion(null)
  }, [futuro, doc])

  // ── Coordenadas ─────────────────────────────────────────────────────────
  const puntoSvg = useCallback((evento) => {
    const svg = svgRef.current
    const m = svg?.getScreenCTM()
    if (!m) return { x: 0, y: 0 }
    const p = new DOMPoint(evento.clientX, evento.clientY).matrixTransform(m.inverse())
    return { x: p.x, y: p.y }
  }, [])

  // ── Herramienta: pared ──────────────────────────────────────────────────
  function agregarPunto(evento) {
    const { x, y } = puntoSvg(evento)
    let px = ajustarGrilla(x)
    let py = ajustarGrilla(y)

    const anterior = trazo?.puntos?.at(-1)
    if (evento.shiftKey && anterior) {
      // Shift: se queda con el eje donde hubo más recorrido → pared recta.
      if (Math.abs(px - anterior[0]) > Math.abs(py - anterior[1])) py = anterior[1]
      else px = anterior[0]
    }

    setTrazo((t) => ({
      puntos: [...(t?.puntos ?? []), [px, py]],
      cursor: [px, py],
      thickness: t?.thickness ?? 10,
    }))
  }

  const terminarPared = useCallback(() => {
    if (trazo?.puntos?.length >= 2) {
      aplicar((d) => ({ ...d, walls: [...d.walls, nuevaPared(trazo.puntos, trazo.thickness)] }))
    }
    setTrazo(null)
  }, [trazo, aplicar])

  // ── Herramienta: mesa / silla ───────────────────────────────────────────
  function colocarMesa(evento) {
    const idMesa = Number(mesaAColocar)
    const mesa = mesasPorId[idMesa]
    if (!mesa) {
      toast.info('Todas las mesas ya están ubicadas en el croquis')
      return
    }
    const { x, y } = puntoSvg(evento)
    const elemento = nuevaMesa({ tableId: mesa.id, capacidad: mesa.capacityPersons, x, y })
    aplicar((d) => {
      const conMesa = { ...d, tables: [...d.tables, elemento] }
      return conSillas ? recolocarSillas(conMesa, elemento, mesa.capacityPersons) : conMesa
    })
    setSeleccion({ tipo: 'mesa', id: elemento.id })
  }

  function colocarSilla(evento) {
    const { x, y } = puntoSvg(evento)
    const silla = nuevaSilla({ x, y })
    aplicar((d) => ({ ...d, chairs: [...d.chairs, silla] }))
    setSeleccion({ tipo: 'silla', id: silla.id })
  }

  // ── Eventos del lienzo ──────────────────────────────────────────────────
  function alPresionarFondo(evento) {
    if (evento.button !== 0) return
    if (herramienta === 'pared') return agregarPunto(evento)
    if (herramienta === 'mesa') return colocarMesa(evento)
    if (herramienta === 'silla') return colocarSilla(evento)
    if (herramienta === 'sel') {
      // Una pared es una línea fina: si el clic cayó cerca, cuenta como suyo.
      const { x, y } = puntoSvg(evento)
      const cerca = doc.walls.find((p) => distanciaAPared(x, y, p) <= (p.thickness ?? 10) + 8)
      setSeleccion(cerca ? { tipo: 'pared', id: cerca.id } : null)
    }
  }

  function alPresionarElemento(evento, tipo, id) {
    // Con las herramientas de dibujo el clic pertenece al lienzo, no al elemento.
    if (herramienta !== 'sel' && herramienta !== 'borrar') return

    evento.stopPropagation()

    if (herramienta === 'borrar') {
      aplicar((d) => quitarElemento(d, tipo, id))
      setSeleccion(null)
      return
    }

    setSeleccion({ tipo, id })
    if (tipo === 'pared') return // las paredes se editan por el panel, no se arrastran

    svgRef.current?.setPointerCapture?.(evento.pointerId)
    arrastre.current = { tipo, id, ultimo: puntoSvg(evento), movio: false }
  }

  function alMover(evento) {
    if (trazo) {
      const { x, y } = puntoSvg(evento)
      setTrazo((t) => (t ? { ...t, cursor: [ajustarGrilla(x), ajustarGrilla(y)] } : t))
      return
    }
    const a = arrastre.current
    if (!a) return

    const p = puntoSvg(evento)
    const dx = ajustarGrilla(p.x - a.ultimo.x, doc.grid / 2)
    const dy = ajustarGrilla(p.y - a.ultimo.y, doc.grid / 2)
    if (!dx && !dy) return

    a.ultimo = { x: a.ultimo.x + dx, y: a.ultimo.y + dy }

    // Durante el arrastre se toca el documento sin apilar historial: se apila
    // una sola entrada al soltar, si no el "deshacer" retrocedería píxel a píxel.
    if (!a.movio) {
      setHistorial((h) => [...h.slice(-49), doc])
      setFuturo([])
      a.movio = true
    }
    setSucio(true)
    setDoc((d) =>
      a.tipo === 'mesa'
        ? moverMesa(d, a.id, dx, dy)
        : { ...d, chairs: d.chairs.map((s) => (s.id === a.id ? { ...s, x: s.x + dx, y: s.y + dy } : s)) },
    )
  }

  function alSoltar(evento) {
    if (arrastre.current) {
      svgRef.current?.releasePointerCapture?.(evento.pointerId)
      arrastre.current = null
    }
  }

  // ── Teclado ─────────────────────────────────────────────────────────────
  useEffect(() => {
    function alTeclear(e) {
      if (e.target.matches('input, select, textarea')) return

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        e.shiftKey ? rehacer() : deshacer()
        return
      }
      if (e.key === 'Enter' && trazo) return terminarPared()
      if (e.key === 'Escape') {
        setTrazo(null)
        setSeleccion(null)
        return
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && seleccion) {
        e.preventDefault()
        aplicar((d) => quitarElemento(d, seleccion.tipo, seleccion.id))
        setSeleccion(null)
        return
      }

      const atajo = HERRAMIENTAS.find((h) => h.tecla.toLowerCase() === e.key.toLowerCase())
      if (atajo) {
        setHerramienta(atajo.id)
        setTrazo(null)
        return
      }

      const flechas = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }
      if (flechas[e.key] && seleccion) {
        e.preventDefault()
        const paso = e.shiftKey ? 1 : (doc?.grid ?? 20)
        const [ux, uy] = flechas[e.key]
        const dx = ux * paso
        const dy = uy * paso
        aplicar((d) =>
          seleccion.tipo === 'mesa'
            ? moverMesa(d, seleccion.id, dx, dy)
            : seleccion.tipo === 'silla'
              ? { ...d, chairs: d.chairs.map((s) => (s.id === seleccion.id ? { ...s, x: s.x + dx, y: s.y + dy } : s)) }
              : { ...d, walls: d.walls.map((p) => (p.id === seleccion.id ? { ...p, points: p.points.map(([x, y]) => [x + dx, y + dy]) } : p)) },
        )
      }
    }

    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [aplicar, deshacer, rehacer, seleccion, trazo, terminarPared, doc])

  // Aviso del navegador si se intenta cerrar con cambios sin guardar.
  useEffect(() => {
    if (!sucio) return
    const avisar = (e) => e.preventDefault()
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [sucio])

  // ── Guardado ────────────────────────────────────────────────────────────
  async function guardar() {
    try {
      const res = await run(() => croquisApi.save(doc))
      local.setData(res)
      setSucio(false)
      toast.ok('Croquis guardado')
    } catch (err) {
      toast.error(err)
    }
  }

  function descartar() {
    setDoc(normalizarCroquis(local.data?.drawCroquisLocal))
    setHistorial([])
    setFuturo([])
    setSeleccion(null)
    setTrazo(null)
    setSucio(false)
  }

  function salir() {
    if (sucio && !window.confirm('Hay cambios sin guardar en el croquis. ¿Salir igual?')) return
    navigate('/mesas')
  }

  if (local.loading && !doc) return <Loading label="Cargando croquis…" />
  if (local.error && !doc) return <ErrorState error={local.error} onRetry={local.refetch} />
  if (!doc) return null

  const activa = HERRAMIENTAS.find((h) => h.id === herramienta)

  return (
    <>
      <PageHeader
        title="Croquis del local"
        subtitle="Dibuja las paredes, ubica las mesas y coloca las sillas"
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={salir}>
              <Icon name="atras" size={15} />
              Volver al salón
            </Button>
            <Button variant="outline" size="sm" onClick={deshacer} disabled={!historial.length}>
              Deshacer
            </Button>
            <Button variant="outline" size="sm" onClick={rehacer} disabled={!futuro.length}>
              Rehacer
            </Button>
            {sucio && (
              <Button variant="ghost" size="sm" onClick={descartar}>
                Descartar
              </Button>
            )}
            <Button size="sm" loading={saving} disabled={!sucio} onClick={guardar}>
              <Icon name="check" size={15} />
              {sucio ? 'Guardar croquis' : 'Guardado'}
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[15rem_1fr_17rem]">
        {/* Herramientas */}
        <div className="space-y-4">
          <Card className="p-2">
            <div className="grid grid-cols-2 gap-1.5 xl:grid-cols-1">
              {HERRAMIENTAS.map((h) => (
                <button
                  key={h.id}
                  onClick={() => {
                    setHerramienta(h.id)
                    setTrazo(null)
                  }}
                  className={cx(
                    'flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    herramienta === h.id
                      ? 'bg-carbon-800 text-white'
                      : 'text-carbon-600 hover:bg-carbon-100',
                  )}
                >
                  <Icon name={h.icono} size={17} />
                  <span className="flex-1 text-left">{h.label}</span>
                  <kbd
                    className={cx(
                      'rounded px-1.5 py-0.5 text-[10px] font-bold',
                      herramienta === h.id ? 'bg-white/20' : 'bg-carbon-100 text-carbon-500',
                    )}
                  >
                    {h.tecla}
                  </kbd>
                </button>
              ))}
            </div>
          </Card>

          <Card className="bg-brasa-50/60 p-4">
            <p className="text-xs font-semibold text-brasa-900">{activa.label}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-brasa-800">{activa.ayuda}</p>
          </Card>

          {herramienta === 'mesa' && (
            <Card className="space-y-3 p-4">
              <Field label="Mesa a colocar" hint="Solo aparecen las que faltan ubicar">
                <Select
                  value={mesaAColocar}
                  onChange={(e) => setMesaAColocar(e.target.value)}
                  disabled={!sinUbicar.length}
                >
                  {sinUbicar.length ? (
                    sinUbicar.map((m) => (
                      <option key={m.id} value={m.id}>
                        Mesa {m.number} · {m.capacityPersons} pers.
                      </option>
                    ))
                  ) : (
                    <option value="">Todas ubicadas</option>
                  )}
                </Select>
              </Field>
              <label className="flex items-center gap-2 text-xs text-carbon-600">
                <input
                  type="checkbox"
                  checked={conSillas}
                  onChange={(e) => setConSillas(e.target.checked)}
                  className="size-4 accent-brasa-600"
                />
                Colocar las sillas según la capacidad
              </label>
            </Card>
          )}

          <Card className="p-4">
            <p className="text-[10px] font-semibold tracking-wide text-carbon-400 uppercase">
              En el croquis
            </p>
            <dl className="mt-2 space-y-1.5 text-xs">
              {[
                ['Paredes', doc.walls.length],
                ['Mesas', doc.tables.length],
                ['Sillas', doc.chairs.length],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <dt className="text-carbon-500">{k}</dt>
                  <dd className="font-semibold text-carbon-900 tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
            {sinUbicar.length > 0 && (
              <Badge tone="warn" className="mt-3">
                {sinUbicar.length} mesa(s) sin ubicar
              </Badge>
            )}
          </Card>
        </div>

        {/* Lienzo */}
        <Card className="overflow-hidden p-0">
          {trazo && (
            <div className="flex flex-wrap items-center gap-3 border-b border-brasa-200 bg-brasa-50 px-4 py-2.5 text-xs text-brasa-900">
              <span className="font-semibold">
                Trazando pared · {trazo.puntos.length} punto(s)
              </span>
              <span className="text-brasa-700">
                Clic para agregar esquina · Shift para forzar recta
              </span>
              <div className="ml-auto flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setTrazo(null)}>
                  Cancelar
                </Button>
                <Button size="sm" onClick={terminarPared} disabled={trazo.puntos.length < 2}>
                  Terminar pared
                </Button>
              </div>
            </div>
          )}
          <div className="overflow-x-auto bg-carbon-100 p-3">
            <div className="min-w-[680px]">
              <CroquisLienzo
                svgRef={svgRef}
                croquis={doc}
                mesasPorId={mesasPorId}
                modo="edicion"
                seleccion={seleccion}
                trazoEnCurso={trazo}
                cursor={CURSOR[herramienta]}
                onFondoPointerDown={alPresionarFondo}
                onElementoPointerDown={alPresionarElemento}
                onPointerMove={alMover}
                onPointerUp={alSoltar}
                className="rounded-lg border border-carbon-300 bg-white shadow-sm"
              />
            </div>
          </div>
        </Card>

        {/* Propiedades */}
        <PanelPropiedades
          doc={doc}
          seleccion={seleccion}
          mesasPorId={mesasPorId}
          sinUbicar={sinUbicar}
          aplicar={aplicar}
          limpiarSeleccion={() => setSeleccion(null)}
        />
      </div>
    </>
  )
}

// ── Panel de propiedades del elemento seleccionado ────────────────────────
function PanelPropiedades({ doc, seleccion, mesasPorId, sinUbicar, aplicar, limpiarSeleccion }) {
  if (!seleccion) {
    return (
      <Card className="p-5">
        <p className="text-xs font-semibold tracking-wide text-carbon-400 uppercase">Propiedades</p>
        <p className="mt-3 text-xs leading-relaxed text-carbon-500">
          Selecciona una pared, una mesa o una silla para editarla. Con la herramienta{' '}
          <strong>Seleccionar</strong> puedes arrastrarlas; las flechas del teclado las mueven de a
          un cuadro de la grilla.
        </p>
      </Card>
    )
  }

  const borrar = () => {
    aplicar((d) => quitarElemento(d, seleccion.tipo, seleccion.id))
    limpiarSeleccion()
  }

  if (seleccion.tipo === 'pared') {
    const pared = doc.walls.find((p) => p.id === seleccion.id)
    if (!pared) return null
    return (
      <Card className="space-y-4 p-5">
        <Encabezado titulo="Pared" detalle={`${pared.points.length} puntos`} />
        <Field label="Grosor" hint="Unidades del lienzo">
          <Input
            type="number"
            min="2"
            max="40"
            value={pared.thickness ?? 10}
            onChange={(e) =>
              aplicar((d) => ({
                ...d,
                walls: d.walls.map((p) =>
                  p.id === pared.id ? { ...p, thickness: acotar(Number(e.target.value), 2, 40) } : p,
                ),
              }))
            }
          />
        </Field>
        <BotonBorrar onClick={borrar} />
      </Card>
    )
  }

  if (seleccion.tipo === 'silla') {
    const silla = doc.chairs.find((s) => s.id === seleccion.id)
    if (!silla) return null
    const girar = (grados) =>
      aplicar((d) => ({
        ...d,
        chairs: d.chairs.map((s) =>
          s.id === silla.id ? { ...s, rotation: (((s.rotation ?? 0) + grados) % 360 + 360) % 360 } : s,
        ),
      }))
    return (
      <Card className="space-y-4 p-5">
        <Encabezado
          titulo="Silla"
          detalle={silla.mesaId ? 'Asignada a una mesa' : 'Suelta'}
        />
        <div>
          <p className="mb-1.5 text-xs font-semibold text-carbon-700">Orientación</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={() => girar(-90)}>
              ↺ 90°
            </Button>
            <Button variant="outline" size="sm" className="flex-1" onClick={() => girar(90)}>
              ↻ 90°
            </Button>
          </div>
          <p className="mt-1.5 text-[11px] text-carbon-500">
            Actual: {silla.rotation ?? 0}° — la silla mira hacia donde apunta el asiento.
          </p>
        </div>
        <BotonBorrar onClick={borrar} />
      </Card>
    )
  }

  // Mesa
  const elemento = doc.tables.find((m) => m.id === seleccion.id)
  if (!elemento) return null
  const mesa = elemento.tableId ? mesasPorId[elemento.tableId] : null

  const actualizar = (cambios) =>
    aplicar((d) => ({
      ...d,
      tables: d.tables.map((m) => (m.id === elemento.id ? { ...m, ...cambios } : m)),
    }))

  return (
    <Card className="space-y-4 p-5">
      <Encabezado
        titulo={mesa ? `Mesa ${mesa.number}` : 'Mesa sin vincular'}
        detalle={mesa ? `${mesa.capacityPersons} personas` : 'Elige a qué TABLE corresponde'}
      />

      <Field label="Corresponde a" hint="TABLE.id — vincula el dibujo con la mesa real">
        <Select
          value={elemento.tableId ?? ''}
          onChange={(e) => actualizar({ tableId: e.target.value ? Number(e.target.value) : null })}
        >
          <option value="">Sin vincular</option>
          {mesa && (
            <option value={mesa.id}>
              Mesa {mesa.number} · {mesa.capacityPersons} pers.
            </option>
          )}
          {sinUbicar.map((m) => (
            <option key={m.id} value={m.id}>
              Mesa {m.number} · {m.capacityPersons} pers.
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Forma">
        <Select value={elemento.shape} onChange={(e) => actualizar({ shape: e.target.value })}>
          <option value="rect">Rectangular</option>
          <option value="round">Redonda</option>
        </Select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label={elemento.shape === 'round' ? 'Diámetro' : 'Ancho'}>
          <Input
            type="number"
            min="40"
            max="320"
            step="10"
            value={elemento.width}
            onChange={(e) => {
              const w = acotar(Number(e.target.value), 40, 320)
              actualizar(elemento.shape === 'round' ? { width: w, height: w } : { width: w })
            }}
          />
        </Field>
        <Field label="Alto">
          <Input
            type="number"
            min="40"
            max="320"
            step="10"
            disabled={elemento.shape === 'round'}
            value={elemento.height}
            onChange={(e) => actualizar({ height: acotar(Number(e.target.value), 40, 320) })}
          />
        </Field>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-semibold text-carbon-700">Giro</p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => actualizar({ rotation: (((elemento.rotation ?? 0) - 45) % 360 + 360) % 360 })}
          >
            ↺ 45°
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => actualizar({ rotation: (((elemento.rotation ?? 0) + 45) % 360 + 360) % 360 })}
          >
            ↻ 45°
          </Button>
        </div>
      </div>

      <div className="space-y-2 rounded-lg bg-carbon-50 p-3">
        <p className="text-xs font-semibold text-carbon-700">Sillas</p>
        <p className="text-[11px] text-carbon-500">
          Se reparten alrededor de la mesa mirando hacia ella. Vuelve a colocarlas si cambiaste la
          forma o el tamaño.
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => aplicar((d) => recolocarSillas(d, elemento, mesa?.capacityPersons ?? 4))}
          >
            Colocar {mesa?.capacityPersons ?? 4}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => aplicar((d) => recolocarSillas(d, elemento, 0))}
          >
            Quitar
          </Button>
        </div>
        {mesa && medidasPorCapacidad(mesa.capacityPersons).width !== elemento.width && (
          <button
            onClick={() => actualizar(medidasPorCapacidad(mesa.capacityPersons))}
            className="text-[11px] font-semibold text-brasa-600 hover:text-brasa-700"
          >
            Usar el tamaño sugerido para {mesa.capacityPersons} personas
          </button>
        )}
      </div>

      <BotonBorrar onClick={borrar} etiqueta="Quitar mesa del croquis" />
    </Card>
  )
}

function Encabezado({ titulo, detalle }) {
  return (
    <div className="border-b border-carbon-100 pb-3">
      <p className="text-[10px] font-semibold tracking-wide text-carbon-400 uppercase">
        Propiedades
      </p>
      <p className="mt-1 text-sm font-bold text-carbon-900">{titulo}</p>
      {detalle && <p className="text-[11px] text-carbon-500">{detalle}</p>}
    </div>
  )
}

function BotonBorrar({ onClick, etiqueta = 'Eliminar' }) {
  return (
    <Button variant="danger" size="sm" className="w-full" onClick={onClick}>
      <Icon name="basura" size={15} />
      {etiqueta}
    </Button>
  )
}
