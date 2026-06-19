import type { Database, Json } from "./supabase-generated"

// El tipo Database se genera desde el esquema real de Supabase
// (lib/types/supabase-generated.ts, vía `supabase gen types`).
// Aquí solo se re-exporta y se derivan los tipos de dominio de la app.
export type { Database, Json }

export type Organizacion = Database["public"]["Tables"]["organizacion"]["Row"]
export type Delegacion = Database["public"]["Tables"]["delegacion"]["Row"]
export type Cuenta = Database["public"]["Tables"]["cuenta"]["Row"]
export type Movimiento = Database["public"]["Tables"]["movimiento"]["Row"]
export type Categoria = Database["public"]["Tables"]["categoria"]["Row"]
export type CategoriaOrdenDelegacion = Database["public"]["Tables"]["categoria_orden_delegacion"]["Row"]
export type CategoriaConOrdenEfectivo = Categoria & {
  orden_base: number
  orden_override: number | null
  orden_efectivo: number
  esta_activa_override: boolean | null
  esta_activa_efectiva: boolean
  has_override: boolean
}
export type Membresia = Database["public"]["Tables"]["membresia"]["Row"]
export type Perfil = Database["public"]["Tables"]["perfil"]["Row"]
export type MovimientoArchivo = Database["public"]["Tables"]["movimiento_archivo"]["Row"]
export type PropuestaMejora = Database["public"]["Tables"]["propuesta_mejora"]["Row"]
export type PropuestaMejoraComentario = Database["public"]["Tables"]["propuesta_mejora_comentario"]["Row"]
export type PropuestaMejoraVoto = Database["public"]["Tables"]["propuesta_mejora_voto"]["Row"]
export type BancoConexion = Database["public"]["Tables"]["banco_conexion"]["Row"]
export type BancoSyncLog = Database["public"]["Tables"]["banco_sync_log"]["Row"]
// La columna contacto.tipo es text en la BD (string en el tipo generado), pero
// la app la restringe a ContactoTipo; lo afinamos aquí para los datos leídos.
export type Contacto = Omit<Database["public"]["Tables"]["contacto"]["Row"], "tipo"> & {
  tipo: ContactoTipo
}
export type ContactoInsert = Database["public"]["Tables"]["contacto"]["Insert"]
export type ContactoUpdate = Database["public"]["Tables"]["contacto"]["Update"]
// La columna contacto.tipo es text en la BD (no un enum), por eso el tipo
// generado es string. La app la restringe a estos tres valores.
export type ContactoTipo = "proveedor" | "persona_mcm" | "destinatario_mcm"

export const CONTACTO_TIPOS: readonly ContactoTipo[] = ["proveedor", "persona_mcm", "destinatario_mcm"] as const

export type ContactoConCategoriaPredeterminada = Contacto & {
  categoria_predeterminada?: Pick<Categoria, "id" | "nombre" | "emoji" | "color"> | null
}

export type ArchivoAdjunto = Database["public"]["Tables"]["archivo_adjunto"]["Row"]
export type ArchivoAdjuntoInsert = Database["public"]["Tables"]["archivo_adjunto"]["Insert"]
export type ArchivoAdjuntoUpdate = Database["public"]["Tables"]["archivo_adjunto"]["Update"]
export type ArchivoAdjuntoEntidad = ArchivoAdjunto["entidad"]

export type PagoMcm = Database["public"]["Tables"]["pago_mcm"]["Row"]
export type PagoMcmInsert = Database["public"]["Tables"]["pago_mcm"]["Insert"]
export type PagoMcmUpdate = Database["public"]["Tables"]["pago_mcm"]["Update"]
export type PagoMcmEstado = PagoMcm["estado"]
export type PagoMcmTipoCalculo = PagoMcm["tipo_calculo"]
export type PagoMcmGasolinaPreset = NonNullable<PagoMcm["gasolina_preset"]>

export const PAGO_MCM_ESTADOS: readonly PagoMcmEstado[] = [
  "borrador",
  "pendiente",
  "pagado",
  "cancelado",
] as const

export const PAGO_MCM_TIPOS_CALCULO: readonly PagoMcmTipoCalculo[] = [
  "manual",
  "gasolina_tickets",
  "gasolina_km",
  "gasolina_avanzado",
] as const

export type PagoMcmConRelaciones = PagoMcm & {
  contacto?: Pick<Contacto, "id" | "nombre" | "tipo" | "emoji" | "color" | "iban" | "email" | "telefono"> | null
  categoria_sugerida?: Pick<Categoria, "id" | "nombre" | "emoji" | "color"> | null
  movimiento?: Pick<
    Database["public"]["Tables"]["movimiento"]["Row"],
    "id" | "fecha" | "concepto" | "importe" | "cuenta_id"
  > | null
}

export type BancoSyncLogStep = {
  t: string
  level: "info" | "warn" | "error" | "debug"
  msg: string
  data?: Record<string, unknown>
}

// Informes (memorias económicas y archivo de informes)
export type Informe = Database["public"]["Tables"]["informe"]["Row"]
export type InformeInsert = Database["public"]["Tables"]["informe"]["Insert"]
export type InformeUpdate = Database["public"]["Tables"]["informe"]["Update"]
export type InformeArchivo = Database["public"]["Tables"]["informe_archivo"]["Row"]
export type InformeArchivoInsert = Database["public"]["Tables"]["informe_archivo"]["Insert"]
export type InformeConArchivos = Informe & {
  archivos?: InformeArchivo[]
}
export type GoogleCredencial = Database["public"]["Tables"]["google_credencial"]["Row"]

// Extended types with relations
export type MovimientoConRelaciones = Movimiento & {
  cuenta: Cuenta
  categoria?: Categoria
  contacto?: Pick<Contacto, "id" | "nombre" | "tipo" | "emoji" | "color" | "es_global"> | null
  archivos?: MovimientoArchivo[] // Lazy loaded - not included in default queries
}

export type CuentaConDelegacion = Cuenta & {
  delegacion: Delegacion
}

// RPC return types for dashboard aggregations
export type FinancialSummary = {
  ingresos: number
  gastos: number
  balance: number
  total_movimientos: number
  sin_categoria: number
}

export type MonthlyTrendRow = {
  mes: string // 'YYYY-MM'
  ingresos: number
  gastos: number
}

export type CategoryBreakdownRow = {
  categoria_id: string | null
  categoria_nombre: string | null
  categoria_emoji: string | null
  categoria_color: string | null
  ingresos: number
  gastos: number
}
