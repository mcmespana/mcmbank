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

export type ContactoDelegacion = Database["public"]["Tables"]["contacto_delegacion"]["Row"]
export type ContactoDelegacionInsert = Database["public"]["Tables"]["contacto_delegacion"]["Insert"]
export type ContactoDelegacionUpdate = Database["public"]["Tables"]["contacto_delegacion"]["Update"]

/** Lo que una delegación sobrescribe de un contacto compartido. */
export type ContactoAdopcion = Pick<
  ContactoDelegacion,
  "delegacion_id" | "categoria_id_predeterminada" | "alias" | "notas" | "archivado"
>

/**
 * Un contacto visto desde una delegación concreta.
 *
 * Los proveedores son de todo MCM (una sola ficha "Mercadona") y cada
 * delegación los adopta: `adopcion` es su fila en `contacto_delegacion`, con lo
 * que esa delegación sobrescribe. Mismo patrón que `CategoriaConOrdenEfectivo`:
 * el valor efectivo es el de la adopción si existe, y si no el de la ficha.
 */
export type ContactoConCategoriaPredeterminada = Contacto & {
  categoria_predeterminada?: Pick<Categoria, "id" | "nombre" | "emoji" | "color"> | null
  /** Fila de adopción de la delegación activa. Null si no la ha adoptado. */
  adopcion?: ContactoAdopcion | null
  /** Contacto global que esta delegación todavía no usa: está en el catálogo. */
  en_catalogo?: boolean
  /** Cuántas delegaciones lo usan. Solo se calcula para el catálogo. */
  usos_delegaciones?: number
}

/** Nombre con el que verlo aquí: el alias de la delegación si lo puso. */
export function nombreEfectivoContacto(contacto: ContactoConCategoriaPredeterminada): string {
  return contacto.adopcion?.alias?.trim() || contacto.nombre
}

/**
 * Archivar es una decisión de cada delegación: dejar de ver Mercadona en
 * Castellón no puede quitárselo a Sevilla. Para un contacto adoptado manda la
 * adopción; para uno propio, la ficha.
 */
export function archivadoEfectivoContacto(contacto: ContactoConCategoriaPredeterminada): boolean {
  return contacto.adopcion ? contacto.adopcion.archivado : contacto.archivado
}

/** La categoría sugerida es de la delegación; la de la ficha es el respaldo. */
export function categoriaPredeterminadaEfectiva(
  contacto: ContactoConCategoriaPredeterminada,
): string | null {
  return contacto.adopcion?.categoria_id_predeterminada ?? contacto.categoria_id_predeterminada
}

/** Las notas de la delegación tapan las de la ficha compartida. */
export function notasEfectivasContacto(contacto: ContactoConCategoriaPredeterminada): string | null {
  return contacto.adopcion?.notas ?? contacto.notas
}

export type ArchivoAdjunto = Database["public"]["Tables"]["archivo_adjunto"]["Row"]
export type ArchivoAdjuntoInsert = Database["public"]["Tables"]["archivo_adjunto"]["Insert"]
export type ArchivoAdjuntoUpdate = Database["public"]["Tables"]["archivo_adjunto"]["Update"]
export type ArchivoAdjuntoEntidad = ArchivoAdjunto["entidad"]

export type PagoMcm = Database["public"]["Tables"]["pago_mcm"]["Row"]
export type PagoMcmInsert = Database["public"]["Tables"]["pago_mcm"]["Insert"]
export type PagoMcmUpdate = Database["public"]["Tables"]["pago_mcm"]["Update"]
// pago_mcm.estado / tipo_calculo / gasolina_preset son text en la BD (el tipo
// generado los colapsa a string); la app los restringe aquí, igual que FacturaEstado.
export type PagoMcmEstado = "borrador" | "pendiente" | "pagado" | "cancelado"
export type PagoMcmTipoCalculo = "manual" | "gasolina_tickets" | "gasolina_km" | "gasolina_avanzado"
export type PagoMcmGasolinaPreset = "ivaj_0_12" | "min_0_18" | "max_0_20" | "estandar_0_26" | "personalizado"

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

export type PagoMcmConRelaciones = Omit<PagoMcm, "estado" | "tipo_calculo" | "gasolina_preset"> & {
  estado: PagoMcmEstado
  tipo_calculo: PagoMcmTipoCalculo
  gasolina_preset: PagoMcmGasolinaPreset | null
  contacto?: Pick<Contacto, "id" | "nombre" | "tipo" | "emoji" | "color" | "logo_url" | "iban" | "email" | "telefono"> | null
  categoria_sugerida?: Pick<Categoria, "id" | "nombre" | "emoji" | "color"> | null
  movimiento?: Pick<
    Database["public"]["Tables"]["movimiento"]["Row"],
    "id" | "fecha" | "concepto" | "importe" | "cuenta_id"
  > | null
}

export type Factura = Database["public"]["Tables"]["factura"]["Row"]
export type FacturaInsert = Database["public"]["Tables"]["factura"]["Insert"]
export type FacturaUpdate = Database["public"]["Tables"]["factura"]["Update"]
// factura.estado y factura.origen son text en la BD; la app los restringe aquí.
export type FacturaEstado = "bandeja" | "sin_pagar" | "pagada_parcial" | "pagada" | "pagada_fuera"
export type FacturaOrigen = "subida" | "movimiento" | "email"

export const FACTURA_ESTADOS: readonly FacturaEstado[] = [
  "bandeja",
  "sin_pagar",
  "pagada_parcial",
  "pagada",
  "pagada_fuera",
] as const

export type FacturaMovimientoVinculado = Pick<
  Database["public"]["Tables"]["movimiento"]["Row"],
  "id" | "fecha" | "concepto" | "importe" | "cuenta_id"
>

/**
 * Una factura puede tener 0, 1 o varios movimientos vinculados (pago en
 * varios plazos). `movimientos` sustituye al antiguo `movimiento` (1-a-1).
 */
export type FacturaConRelaciones = Omit<Factura, "estado" | "origen"> & {
  estado: FacturaEstado
  origen: FacturaOrigen
  contacto?: Pick<Contacto, "id" | "nombre" | "tipo" | "emoji" | "color" | "logo_url" | "email" | "identificador_fiscal"> | null
  movimientos?: FacturaMovimientoVinculado[]
  archivos?: Pick<
    ArchivoAdjunto,
    "id" | "nombre_original" | "tipo_mime" | "url_publica" | "path_storage" | "bucket" | "tamano_bytes" | "subido_en"
  >[] | null
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
  contacto?: Pick<Contacto, "id" | "nombre" | "tipo" | "emoji" | "color" | "logo_url" | "es_global"> | null
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

export type FacturaResumenRow = {
  estado: FacturaEstado
  n: number
  importe_total: number
  importe_pendiente: number
}

export type PagoMcmResumenRow = {
  estado: PagoMcmEstado
  n: number
  importe_total: number
}

export type CategoryBreakdownRow = {
  categoria_id: string | null
  categoria_nombre: string | null
  categoria_emoji: string | null
  categoria_color: string | null
  ingresos: number
  gastos: number
}
