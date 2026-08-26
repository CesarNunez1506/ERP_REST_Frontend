# Sabor & Fuego — Frontend del ERP de restaurante

Frontend React del ERP construido sobre el diagrama entidad-relación del proyecto
(`WORKER`, `TABLE`, `ORDER`, `PLATE`, `MENU`, `STATION`, `ORDER_TICKET`).

**Stack:** React 19 · Vite 7 · Tailwind CSS 4 · React Router 7 · Socket.IO client.
Sin librería de componentes: los primitivos viven en `src/components/ui.jsx`.

## Arrancar

```bash
npm install
npm run dev          # http://localhost:5173
```

Arranca funcionando aunque el backend NestJS todavía no exista: con
`VITE_USE_MOCK=true` (valor por defecto en `.env`) las llamadas las atiende un
servidor simulado en memoria que respeta el mismo contrato REST, y un bus de
eventos hace de gateway para que el tiempo real también funcione.

Cuando el backend esté listo:

```bash
# .env
VITE_USE_MOCK=false
VITE_API_URL=http://localhost:3000/api
```

Ninguna pantalla cambia — las rutas viven en `src/api/endpoints.js` y los eventos
en `src/api/events.js`. El contrato que el back debe cumplir (REST + gateway)
está en [docs/API-CONTRATO.md](docs/API-CONTRATO.md).

## Tiempo real

No hay polling: la app se suscribe al gateway de Socket.IO y repinta con lo que
llega. Cada pantalla entra solo a las salas que le importan.

| Pantalla | Sala | Qué hace al recibir un evento |
|---|---|---|
| Cocina (KDS) | `estacion:<id>` o `cocina` | aplica el plato del payload en sitio, sin refetch |
| Salón | `salon` | reemplaza la mesa con su `status` ya recalculado |
| Detalle de orden | `orden:<id>` | `order.updated` trae la orden completa y se pinta directo |
| Órdenes / Caja / Panel | `salon`, `caja` | relee: son listados filtrados o agregados |

El indicador de la barra lateral muestra si el socket está conectado y con qué
transporte. `socket.io-client` reconecta solo; como durante un corte se pierden
eventos, cada pantalla mantiene un refetch de seguridad cada 120 s.

Las acciones del KDS son **optimistas**: el plato cambia de columna al toque y el
`plate.updated` del gateway confirma. Si el PATCH falla, se revierte con un
refetch y sale el error.

## Pantallas

| Ruta | Qué hace | Entidades |
|---|---|---|
| `/` | KPIs del día: ventas, ocupación, cola de cocina, SLA promedio, top de carta | agregado |
| `/mesas` | Plano del local en vivo. Mesa libre → abre orden; ocupada → va a su detalle | `TABLE` |
| `/mesas/croquis` | Editor del croquis: dibuja paredes, ubica mesas, coloca sillas | `draw_croquislocal` |
| `/ordenes` | Listado filtrable de comandas | `ORDER` |
| `/ordenes/:id` | Comanda: agregar platos, enviar a cocina, emitir y cobrar el ticket | `ORDER`, `PLATE`, `ORDER_TICKET` |
| `/cocina` | KDS por estación en 3 columnas, con cronómetro y semáforo de SLA | `PLATE`, `STATION` |
| `/caja` | Tickets del día, desglose de IGV, cobro | `ORDER_TICKET` |
| `/carta` | ABM de carta, stock y disponibilidad | `MENU` |
| `/estaciones` | ABM de estaciones, responsable y carga actual | `STATION`, `WORKER` |
| `/personal` | ABM de trabajadores por rol y turno | `WORKER` |

## Croquis del local

El salón tiene dos vistas: **Plano** (el croquis real del local) y **Cuadrícula** (las
mesas como tarjetas, útil cuando todavía no hay croquis o desde el celular). El plano
pinta cada mesa con su estado en vivo y al tocarla hace lo mismo que la tarjeta: abre
orden si está libre, o va al detalle si está ocupada.

El croquis se dibuja en `/mesas/croquis` y se guarda entero en la columna
`draw_croquislocal`. El editor tiene cinco herramientas:

| Tecla | Herramienta | |
|---|---|---|
| `V` | Seleccionar | Arrastra para mover. `Supr` borra, las flechas mueven de a un cuadro (con `Shift`, de a uno) |
| `P` | Pared | Un clic por esquina; `Enter` termina, `Esc` cancela, `Shift` fuerza recta |
| `M` | Mesa | Elige qué `TABLE` es y haz clic donde va; opcionalmente coloca sus sillas |
| `S` | Silla | Sillas sueltas (barra, espera) |
| `B` | Borrar | Clic sobre lo que sobra |

`Ctrl+Z` / `Ctrl+Shift+Z` deshacen y rehacen. Al salir con cambios sin guardar avisa.

Detalles que importan:

- Las sillas de una mesa se **reparten según `TABLE.capacity_persons`** y miran hacia
  ella. Se mueven y se borran junto con su mesa.
- Cada mesa dibujada apunta a un `TABLE.id` real. Si hay mesas registradas que aún no
  están en el plano, el salón lo avisa y lleva al editor.
- El croquis guarda **dónde** está cada mesa; el estado sigue viniendo de `GET /tables`.
  Mover una mesa de sitio no toca las órdenes.

## Flujo operativo

```
Mesa LIBRE
  └─ POST /orders ─────────────────► ORDER (ABIERTA), mesa OCUPADA
       └─ POST /plates ──────────────► PLATE (sin sendTime, todavía no está en cocina)
            └─ POST /orders/:id/send ► sella sendTime  ⏱ arranca el SLA
                                       descuenta stock de MENU
                                       ORDER → EN_PREPARACION
                 └─ KDS: PENDIENTE → EN_PREPARACION → LISTO → ENTREGADO
                      └─ todos ENTREGADO ──► ORDER → SERVIDA, mesa POR_COBRAR
                           └─ POST /order-tickets ──► ORDER_TICKET (PENDIENTE)
                                └─ PATCH { PAGADA } ─► ORDER → CERRADA, mesa LIBRE
```

## Campos calculados

Los tres `(CALCULADO)` del DER los deriva el backend, el front solo los pinta:

- **`TABLE.status`** — `LIBRE` / `OCUPADA` / `POR_COBRAR`, según las órdenes vivas de la mesa.
- **`PLATE.sla`** — minutos entre `sendTime` y `readyAt`. Objetivo 15 min, alerta a los 12
  (`src/lib/constants.js`). El KDS pinta el borde de cada comanda con ese semáforo.
- **`ORDER_TICKET.withoutIgv`** — `amount / 1.18`. `amount` es lo que paga el cliente.

## Estructura

```
src/
  api/
    client.js        fetch + manejo del formato de error de Nest
    endpoints.js     un objeto por entidad; el único sitio con URLs
    events.js        catálogo de eventos y salas del gateway
    realtime.js      conexión Socket.IO (singleton) + join/leave
    mock/
      server.js      servidor REST simulado
      bus.js         gateway simulado: publica los mismos eventos
  components/
    Layout.jsx       barra lateral, estado de conexión, shell responsivo
    ui.jsx           Button, Card, Modal, Table, Badge, Toast…
    Icon.jsx         set de íconos SVG
    croquis/
      CroquisLienzo.jsx  dibujo del plano (lo usan la vista y el editor)
  hooks/
    useApi.js        useFetch, useAction, useNow
    useRealtime.js   useRealtime, useSalas, useRefetchEnEventos, useConexion
  lib/
    constants.js     enums del DER + etiquetas y tonos
    format.js        soles, IGV, cronómetro, semáforo de SLA
    croquis.js       formato de draw_croquislocal y geometría (grilla, sillas)
  pages/             una por ruta
```
