// Core types for MCM Bank application
export type UUID = string

export type TipoCuenta = "banco" | "caja"
export type OrigenCuenta = "manual" | "conectada"
export type TipoCategoria = "ingreso" | "gasto" | "mixto"

export interface Organizacion {
  id: UUID
  codigo: string | null
  nombre: string
  creado_en: string
}

export interface Delegacion {
  id: UUID
  organizacion_id: UUID
  codigo: string | null
  nombre: string
  creado_en: string
}

export interface Cuenta {
  id: UUID
  delegacion_id: UUID
  nombre: string
  tipo: TipoCuenta
  origen: OrigenCuenta
  banco_nombre: string | null
  iban: string | null
  creado_en: string
}

export interface Categoria {
  id: UUID
  organizacion_id: UUID
  nombre: string
  tipo: TipoCategoria
  emoji: string | null
  orden: number
  categoria_padre_id: UUID | null
  creado_en: string
}

export interface Movimiento {
  id: UUID
  cuenta_id: UUID
  fecha: string // 'YYYY-MM-DD'
  concepto: string
  descripcion: string | null
  texto_extra_1: string | null
  texto_extra_2: string | null
  contraparte: string | null
  importe: number // + entrada / - salida
  metodo: string | null
  notas: string | null
  ignorado: boolean
  categoria_id: UUID | null
  adjunto_principal_url: string | null
  creado_por: UUID
  creado_en: string // ISO
}

// Extended types for UI
export interface MovimientoConCuenta extends Movimiento {
  cuenta: Cuenta
  categoria?: Categoria
}
