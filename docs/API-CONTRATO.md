# Contrato de API — lo que el frontend le pide al backend NestJS

Este documento es la referencia para el equipo de backend. El frontend ya consume
**exactamente** estas rutas (ver `src/api/endpoints.js`); mientras Nest no esté listo,
un mock en memoria (`src/api/mock/server.js`) responde lo mismo.

## Convenciones

| | |
|---|---|
| Prefijo global | `app.setGlobalPrefix('api')` → todas las rutas cuelgan de `/api` |
| Puerto | `3000` (configurable con `VITE_API_URL` en el front) |
| Formato | JSON, campos en **camelCase** (`sendTime`, `quantityDispend`, `withoutIgv`) |
| Validación | `ValidationPipe({ whitelist: true, transform: true })` |
| Errores | El shape por defecto de Nest: `{ statusCode, message, error }`. `message` puede ser `string` o `string[]` — el front ya maneja ambos. |
| CORS | `app.enableCors({ origin: 'http://localhost:5173' })` |

Códigos que el frontend interpreta:

- `201` en POST, `200` en GET/PATCH, `204` en DELETE
- `400` validación (muestra los mensajes del array tal cual)
- `404` recurso inexistente
- `409` regla de negocio violada (mesa ocupada, plato agotado, ticket ya pagado…)

---

## Entidades y campos calculados

Los tres campos marcados como *(calculado)* en el DER **no se guardan**: el backend
los deriva en el `service` al serializar.

| Campo | Se deriva de |
|---|---|
| `TABLE.status` | `LIBRE` si la mesa no tiene órdenes vivas · `POR_COBRAR` si su orden está `SERVIDA` o tiene ticket `PENDIENTE` · si no, `OCUPADA` |
| `PLATE.sla` | Minutos entre `sendTime` y `readyAt` (o `now()` si aún no está listo) |
| `ORDER_TICKET.withoutIgv` | `amount / 1.18` — base imponible; `amount` es lo que paga el cliente |

> **Un campo fuera del DER:** `MENU.price`. El diagrama no lo incluye, pero
> `ORDER_TICKET.amount` tiene que salir de algún lado. El front asume
> `MENU.price` como precio unitario **con IGV incluido** (como se muestra en carta
> en Perú). Si el back lo modela en otra tabla, es el único punto a reubicar.
>
> El front también usa `MENU.stationId` para autoasignar la estación del plato.
> Si no existe, se manda `stationId` explícito en cada `POST /plates`.

---

## Endpoints

### `WORKER` — `/api/workers`

```
GET    /workers?role=MOZO
GET    /workers/:id
POST   /workers      { name, lastname, role, startWork, endWork }
PATCH  /workers/:id  (campos parciales)
DELETE /workers/:id  → 409 si tiene órdenes asociadas
```

`role`: `ADMIN | MOZO | COCINERO | CAJERO`
`startWork` / `endWork`: `"HH:mm"`

### `TABLE` — `/api/tables`

```
GET    /tables?status=LIBRE
GET    /tables/:id
POST   /tables       { number, capacityPersons }   → 409 si el número ya existe
PATCH  /tables/:id
DELETE /tables/:id   → 409 si no está LIBRE
```

Respuesta enriquecida (lo que el plano del salón necesita):

```json
{
  "id": 3, "number": 3, "capacityPersons": 4,
  "status": "OCUPADA",
  "currentOrderId": 1001,
  "currentOrderStatus": "EN_PREPARACION"
}
```

### `MENU` — `/api/menus`

```
GET    /menus?q=lomo&isAvailable=true&stationId=1
GET    /menus/:id
POST   /menus        { name, price, quantity, isAvailable, stationId }
PATCH  /menus/:id    (se usa con { isAvailable } para agotar/reponer)
DELETE /menus/:id
```

### `STATION` — `/api/stations`

```
GET    /stations
GET    /stations/:id
POST   /stations     { name, workerId, isAvailable }
PATCH  /stations/:id
DELETE /stations/:id → 409 si tiene platos asociados
```

Respuesta enriquecida:

```json
{
  "id": 2, "name": "Parrilla", "isAvailable": true, "workerId": 6,
  "worker": { "id": 6, "name": "Diego", "lastname": "Salas", "role": "COCINERO" },
  "platesInQueue": 3
}
```

### `ORDER` — `/api/orders`

```
GET    /orders?activas=true&status=&tableId=&workerId=
GET    /orders/:id            → incluye plates[] y ticket
GET    /orders/:id/plates
POST   /orders     { tableId, workerId }   → 409 si la mesa no está LIBRE
POST   /orders/:id/send                    → sella sendTime de los platos nuevos
PATCH  /orders/:id { status }
DELETE /orders/:id → 409 si ya se envió algo a cocina
```

`status`: `ABIERTA | EN_PREPARACION | SERVIDA | CERRADA | ANULADA`

**`POST /orders/:id/send`** es la operación clave del flujo:

1. A cada `PLATE` de la orden con `sendTime === null` se le pone `sendTime = now()`
   (aquí arranca el SLA).
2. Descuenta `MENU.quantity` según `quantityDispend`; si llega a 0, `isAvailable = false`.
3. La orden pasa a `EN_PREPARACION`.
4. Devuelve la orden completa. → `409` si no había platos nuevos.

Respuesta de `GET /orders/:id`:

```json
{
  "id": 1001, "status": "EN_PREPARACION", "tableId": 3, "workerId": 2,
  "createdAt": "2026-08-26T18:04:00.000Z",
  "table":  { "id": 3, "number": 3, "capacityPersons": 4 },
  "worker": { "id": 2, "name": "Lucía", "lastname": "Fernández", "role": "MOZO" },
  "ticket": null,
  "plateCount": 3,
  "total": 118,
  "plates": [ /* ver PLATE */ ]
}
```

### `PLATE` — `/api/plates`

```
GET    /plates?stationId=2&status=PENDIENTE,EN_PREPARACION&enviados=true&orderId=
GET    /plates/:id
POST   /plates      { orderId, menuId, quantityDispend, comment, stationId? }
PATCH  /plates/:id  (se usa con { status })
DELETE /plates/:id  → 409 si ya tiene sendTime
```

`status`: `PENDIENTE | EN_PREPARACION | LISTO | ENTREGADO | ANULADO`
`status` en el query admite **lista separada por comas** — el KDS pide las tres
columnas en una sola llamada.

Al pasar a `LISTO`, el backend sella `readyAt` (es lo que congela el SLA).
Después de cada cambio recalcula el `status` de la orden padre: todos `ENTREGADO`
→ `SERVIDA`; alguno enviado → `EN_PREPARACION`.

Respuesta enriquecida (lo que el KDS pinta en cada comanda):

```json
{
  "id": 1, "orderId": 1001, "menuId": 1, "stationId": 1,
  "quantityDispend": 2, "comment": "Uno sin cebolla",
  "status": "EN_PREPARACION",
  "sendTime": "2026-08-26T18:06:00.000Z", "readyAt": null,
  "sla": 18,
  "menu":    { "id": 1, "name": "Lomo saltado", "price": 38 },
  "station": { "id": 1, "name": "Cocina caliente" },
  "tableNumber": 3,
  "unitPrice": 38, "subtotal": 76
}
```

### `ORDER_TICKET` — `/api/order-tickets`

```
GET    /order-tickets?status=PENDIENTE
GET    /order-tickets/:id
POST   /order-tickets  { orderId }
PATCH  /order-tickets/:id { status: "PAGADA" | "ANULADA" }
```

`POST` calcula el monto en el servidor (**nunca lo manda el cliente**): suma
`MENU.price × PLATE.quantityDispend` de los platos no anulados.
→ `409` si la orden ya tiene ticket vivo o no tiene platos.

`PATCH { status: "PAGADA" }` sella `paidAt` y cierra la orden (`CERRADA`), lo que
libera la mesa. → `409` si ya estaba pagado.

```json
{
  "id": 5001, "orderId": 1004, "status": "PENDIENTE",
  "amount": 96, "withoutIgv": 81.36, "igv": 14.64,
  "createdAt": "...", "paidAt": null,
  "tableNumber": 1, "workerName": "Marco Quispe"
}
```

### Croquis del local — `/api/croquis-local`

El plano del local se guarda entero en la columna **`draw_croquislocal`**. No es una
colección: es un documento único, por eso no lleva `:id`.

```
GET /croquis-local
PUT /croquis-local  { drawCroquisLocal: { ... } }
```

Respuesta (ambos verbos):

```json
{
  "id": 1,
  "name": "Sabor & Fuego — Local Miraflores",
  "updatedAt": "2026-08-26T08:12:00.000Z",
  "drawCroquisLocal": { "...": "el documento completo, ver abajo" }
}
```

El backend **no interpreta el dibujo**: lo guarda tal cual (`jsonb` o `text`). Basta con
dos validaciones:

- `400` si `drawCroquisLocal` no es un objeto.
- `409` si alguna `tables[].tableId` no corresponde a un `TABLE` existente — así el
  plano nunca queda apuntando a mesas borradas.

Si la columna es `TEXT` en vez de `JSONB` y devuelve el JSON como string, el front
igual lo entiende (`normalizarCroquis` lo parsea).

#### Formato de `draw_croquislocal`

Coordenadas en unidades del lienzo, no en píxeles: el SVG escala solo. El origen es
la esquina superior izquierda.

```json
{
  "version": 1,
  "width": 1200,
  "height": 800,
  "grid": 20,
  "walls": [
    { "id": "pared_x1", "points": [[40,40],[1160,40]], "thickness": 10 }
  ],
  "tables": [
    { "id": "mesa_x2", "tableId": 3, "x": 640, "y": 160,
      "shape": "rect", "width": 100, "height": 80, "rotation": 0 }
  ],
  "chairs": [
    { "id": "silla_x3", "mesaId": "mesa_x2", "x": 640, "y": 90, "rotation": 0 }
  ]
}
```

| Campo | Detalle |
|---|---|
| `walls[].points` | Polilínea: 2 puntos es una pared recta, más puntos son esquinas |
| `tables[].tableId` | **La única clave foránea del documento** — enlaza el dibujo con `TABLE.id`. En `null` el dibujo existe pero no representa ninguna mesa real |
| `tables[].shape` | `rect` o `round` (en `round`, `width` es el diámetro) |
| `chairs[].mesaId` | Apunta al `id` del elemento mesa **dentro del croquis**, no a `TABLE.id`. Sirve para que la silla se mueva y se borre junto con su mesa. En `null` es una silla suelta |
| `rotation` | Grados, horario. En una silla, `0` = mira hacia abajo (+y); `90` izquierda, `180` arriba, `270` derecha |

Los `id` de los elementos los genera el frontend (`mesa_…`, `silla_…`, `pared_…`) y solo
tienen que ser únicos dentro del documento.

**Importante:** el croquis guarda *dónde* está cada mesa; el estado (`LIBRE`/`OCUPADA`/
`POR_COBRAR`) sigue saliendo de `GET /tables` y de `table.updated`. Son dos cosas
separadas a propósito: mover una mesa de sitio no toca las órdenes, y una orden nueva no
reescribe el plano.

### Panel — `/api/dashboard/resumen`

Un solo endpoint agregado para no hacer 6 llamadas desde el panel:

```json
{
  "mesas": { "total": 12, "libres": 8, "ocupadas": 2, "porCobrar": 2 },
  "ordenesActivas": 4,
  "platosEnCola": 3,
  "platosVencidos": 1,
  "slaPromedioMin": 9.4,
  "ventasDia": 487,
  "ticketsPendientes": { "cantidad": 1, "monto": 96 },
  "ticketPromedio": 243.5,
  "topPlatos":       [{ "name": "Parrilla mixta", "cantidad": 3, "monto": 195 }],
  "cargaEstaciones": [{ "id": 2, "name": "Parrilla", "isAvailable": true, "enCola": 2 }]
}
```

---

## Gateway de Socket.IO

El frontend no hace polling: se suscribe al gateway y repinta con lo que llega.
El catálogo de eventos vive en `src/api/events.js` y es el contrato compartido.

```ts
@WebSocketGateway({ cors: { origin: 'http://localhost:5173' } })
export class ErpGateway implements OnGatewayConnection {
  @WebSocketServer() server: Server

  @SubscribeMessage('join')
  join(@ConnectedSocket() client: Socket, @MessageBody() rooms: string[]) {
    client.join(rooms)
  }

  @SubscribeMessage('leave')
  leave(@ConnectedSocket() client: Socket, @MessageBody() rooms: string[]) {
    rooms.forEach((r) => client.leave(r))
  }
}
```

### Salas

El cliente entra y sale de salas con `join` / `leave`, mandando un **array de strings**.
Cada pantalla se suscribe solo a lo suyo:

| Sala | Quién entra | Para qué |
|---|---|---|
| `salon` | Salón, Órdenes, Panel | mesas y comandas |
| `cocina` | KDS sin filtro, Estaciones | todos los platos |
| `estacion:<id>` | KDS filtrado por estación | solo esa estación |
| `caja` | Caja, Panel | tickets |
| `orden:<id>` | Detalle de una orden | solo esa comanda |

### Eventos servidor → cliente

| Evento | Payload | Se emite a |
|---|---|---|
| `plate.created` | `PLATE` expandido | `cocina`, `estacion:<stationId>`, `orden:<orderId>` |
| `plate.updated` | `PLATE` expandido | idem |
| `plate.deleted` | `{ plateId, orderId, stationId }` | idem |
| `order.created` | `ORDER` con `plates[]` | `salon`, `orden:<id>` |
| `order.updated` | `ORDER` con `plates[]` | `salon`, `orden:<id>` |
| `order.sent` | `ORDER` con `plates[]` | `salon`, `cocina`, `orden:<id>` |
| `order.deleted` | `{ orderId, tableId }` | `salon` |
| `table.updated` | `TABLE` con `status` recalculado | `salon` |
| `ticket.created` | `ORDER_TICKET` expandido | `caja`, `salon`, `orden:<id>` |
| `ticket.updated` | `ORDER_TICKET` expandido | `caja`, `salon`, `orden:<id>` |
| `menu.updated` | `MENU` | broadcast |
| `station.updated` | `STATION` con `platesInQueue` | `cocina` |
| `croquis.updated` | el local completo, con `drawCroquisLocal` | `salon` |

**Regla clave:** el payload es **el mismo objeto expandido que devuelve el REST**,
no un `{ id }` suelto. Así el KDS aplica el cambio sin volver a pedir nada. Donde
el front sí relee (panel, listados filtrados) es porque el dato es agregado o
depende de un filtro, no por falta de datos en el evento.

Qué emitir en cada operación del service:

- `POST /plates` → `plate.created` + `order.updated` + `table.updated`
- `PATCH /plates/:id` → `plate.updated` + `order.updated` + `table.updated`
- `POST /orders/:id/send` → un `plate.created` por plato + `menu.updated` por cada
  stock descontado + `order.sent` + `table.updated`
- `POST /order-tickets` y `PATCH /order-tickets/:id` → `ticket.*` + `order.updated` + `table.updated`
- `PUT /croquis-local` → `croquis.updated` (para que el plano del salón se reacomode
  en las demás pantallas sin recargar)

`table.updated` acompaña a casi todo porque `TABLE.status` es calculado: cambia
sin que nadie toque la tabla `TABLE`.

### Reconexión

`socket.io-client` reconecta solo. Como durante el corte se pierden eventos, cada
pantalla mantiene además un refetch de seguridad cada 120 s. No hace falta que el
gateway reenvíe historial.

---

## Cuando el backend esté listo

1. En Nest: `app.setGlobalPrefix('api')` + `enableCors` para `http://localhost:5173`,
   y el gateway con el mismo `cors`.
2. En el front, `.env`: `VITE_USE_MOCK=false` y `VITE_API_URL=http://localhost:3000/api`.

No hay que tocar ninguna pantalla: las rutas viven en `src/api/endpoints.js` y los
eventos en `src/api/events.js`. Si algo terminó llamándose distinto en Nest, se
corrige en esos dos archivos y en ningún otro lado.
