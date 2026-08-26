/**
 * Enums y catálogos derivados del diagrama entidad-relación.
 * Los valores son los que viajan por la API (Nest); las etiquetas son solo UI.
 */

// WORKER.role
export const ROLES = {
  ADMIN: 'ADMIN',
  MOZO: 'MOZO',
  COCINERO: 'COCINERO',
  CAJERO: 'CAJERO',
}

export const ROLE_LABEL = {
  ADMIN: 'Administrador',
  MOZO: 'Mozo',
  COCINERO: 'Cocinero',
  CAJERO: 'Cajero',
}

// ORDER.status
export const ORDER_STATUS = {
  ABIERTA: 'ABIERTA',
  EN_PREPARACION: 'EN_PREPARACION',
  SERVIDA: 'SERVIDA',
  CERRADA: 'CERRADA',
  ANULADA: 'ANULADA',
}

export const ORDER_STATUS_LABEL = {
  ABIERTA: 'Abierta',
  EN_PREPARACION: 'En preparación',
  SERVIDA: 'Servida',
  CERRADA: 'Cerrada',
  ANULADA: 'Anulada',
}

export const ORDER_STATUS_TONE = {
  ABIERTA: 'info',
  EN_PREPARACION: 'warn',
  SERVIDA: 'ok',
  CERRADA: 'neutral',
  ANULADA: 'danger',
}

// PLATE.status — el flujo del KDS
export const PLATE_STATUS = {
  PENDIENTE: 'PENDIENTE',
  EN_PREPARACION: 'EN_PREPARACION',
  LISTO: 'LISTO',
  ENTREGADO: 'ENTREGADO',
  ANULADO: 'ANULADO',
}

export const PLATE_STATUS_LABEL = {
  PENDIENTE: 'Pendiente',
  EN_PREPARACION: 'En preparación',
  LISTO: 'Listo',
  ENTREGADO: 'Entregado',
  ANULADO: 'Anulado',
}

export const PLATE_STATUS_TONE = {
  PENDIENTE: 'neutral',
  EN_PREPARACION: 'warn',
  LISTO: 'ok',
  ENTREGADO: 'info',
  ANULADO: 'danger',
}

/** Transición permitida desde cada estado (avance del plato en cocina). */
export const PLATE_NEXT = {
  PENDIENTE: PLATE_STATUS.EN_PREPARACION,
  EN_PREPARACION: PLATE_STATUS.LISTO,
  LISTO: PLATE_STATUS.ENTREGADO,
}

// TABLE.status — calculado por el backend a partir de las órdenes vivas
export const TABLE_STATUS = {
  LIBRE: 'LIBRE',
  OCUPADA: 'OCUPADA',
  POR_COBRAR: 'POR_COBRAR',
}

export const TABLE_STATUS_LABEL = {
  LIBRE: 'Libre',
  OCUPADA: 'Ocupada',
  POR_COBRAR: 'Por cobrar',
}

export const TABLE_STATUS_TONE = {
  LIBRE: 'ok',
  OCUPADA: 'warn',
  POR_COBRAR: 'info',
}

// ORDER_TICKET.status
export const TICKET_STATUS = {
  PENDIENTE: 'PENDIENTE',
  PAGADA: 'PAGADA',
  ANULADA: 'ANULADA',
}

export const TICKET_STATUS_LABEL = {
  PENDIENTE: 'Pendiente',
  PAGADA: 'Pagada',
  ANULADA: 'Anulada',
}

export const TICKET_STATUS_TONE = {
  PENDIENTE: 'warn',
  PAGADA: 'ok',
  ANULADA: 'danger',
}

/**
 * SLA objetivo por plato, en minutos. PLATE.sla es un campo calculado:
 * cuánto lleva el plato desde send_time hasta que se marca LISTO.
 */
export const SLA_OBJETIVO_MIN = 15
export const SLA_ALERTA_MIN = 12

export const IGV = Number(import.meta.env.VITE_IGV ?? 0.18)
