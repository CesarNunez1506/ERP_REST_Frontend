/**
 * Catálogo de eventos del gateway de Socket.IO.
 *
 * Es el contrato compartido con el backend NestJS (`@WebSocketGateway`).
 * Ninguna pantalla escribe un nombre de evento a mano: todas importan de aquí,
 * así un cambio de nomenclatura en el gateway se corrige en un solo archivo.
 */

// ── Servidor → cliente ────────────────────────────────────────────────────
export const EV = {
  // Cocina
  PLATE_CREATED: 'plate.created',
  PLATE_UPDATED: 'plate.updated',
  PLATE_DELETED: 'plate.deleted',
  // Salón / comandas
  ORDER_CREATED: 'order.created',
  ORDER_UPDATED: 'order.updated',
  ORDER_SENT: 'order.sent',
  ORDER_DELETED: 'order.deleted',
  TABLE_UPDATED: 'table.updated',
  // Caja
  TICKET_CREATED: 'ticket.created',
  TICKET_UPDATED: 'ticket.updated',
  // Catálogos
  MENU_UPDATED: 'menu.updated',
  STATION_UPDATED: 'station.updated',
  // Plano del local (columna draw_croquislocal)
  CROQUIS_UPDATED: 'croquis.updated',
}

// ── Cliente → servidor ────────────────────────────────────────────────────
export const CMD = {
  JOIN: 'join',
  LEAVE: 'leave',
}

/**
 * Salas (rooms) del gateway. Cada pantalla se suscribe solo a lo suyo para no
 * recibir tráfico que no va a pintar.
 */
export const ROOM = {
  SALON: 'salon',
  COCINA: 'cocina',
  CAJA: 'caja',
  estacion: (id) => `estacion:${id}`,
  orden: (id) => `orden:${id}`,
}

/** Grupos de eventos que suele escuchar cada pantalla. */
export const GRUPOS = {
  cocina: [EV.PLATE_CREATED, EV.PLATE_UPDATED, EV.PLATE_DELETED, EV.ORDER_SENT],
  salon: [
    EV.TABLE_UPDATED,
    EV.ORDER_CREATED,
    EV.ORDER_UPDATED,
    EV.ORDER_DELETED,
    EV.TICKET_CREATED,
    EV.TICKET_UPDATED,
    EV.CROQUIS_UPDATED,
  ],
  caja: [EV.TICKET_CREATED, EV.TICKET_UPDATED],
  orden: [
    EV.ORDER_UPDATED,
    EV.ORDER_SENT,
    EV.PLATE_CREATED,
    EV.PLATE_UPDATED,
    EV.PLATE_DELETED,
    EV.TICKET_CREATED,
    EV.TICKET_UPDATED,
  ],
}
