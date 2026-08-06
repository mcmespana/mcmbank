import { supabase } from "@/lib/supabase/client"
import { FileService } from "@/lib/services/file-service"
import type {
  Categoria,
  CategoryBreakdownRow,
  CategoriaConOrdenEfectivo,
  CategoriaOrdenDelegacion,
  Contacto,
  ContactoConCategoriaPredeterminada,
  ContactoInsert,
  ContactoTipo,
  ContactoUpdate,
  Factura,
  FacturaConRelaciones,
  FacturaEstado,
  FacturaInsert,
  FacturaUpdate,
  FacturaResumenRow,
  FinancialSummary,
  MonthlyTrendRow,
  MovimientoConRelaciones,
  PagoMcm,
  PagoMcmConRelaciones,
  PagoMcmEstado,
  PagoMcmInsert,
  PagoMcmResumenRow,
  PagoMcmUpdate,
} from "@/lib/types/database"
import { margenImporteFactura, scoreCandidatoMovimiento } from "@/lib/utils/facturas"

type CategoriaWithOverrides = Categoria & {
  overrides?: CategoriaOrdenDelegacion[] | null
}

const selectCategoriasWithOverrides = `
  *,
  overrides:categoria_orden_delegacion!left (
    delegacion_id,
    categoria_id,
    orden,
    esta_activa
  )
`

function mapCategorias(
  data: CategoriaWithOverrides[] | null,
  delegacionId?: string | null,
): CategoriaConOrdenEfectivo[] {
  if (!data) return []

  const mapped = data.map((item) => {
    const { overrides, orden, ...categoria } = item
    const override = delegacionId
      ? overrides?.find((entry) => entry.delegacion_id === delegacionId)
      : null

    const orden_base = orden
    const overrideOrdenRaw = override?.orden ?? null
    const orden_override =
      override && overrideOrdenRaw !== null && overrideOrdenRaw !== orden_base
        ? overrideOrdenRaw
        : null
    const orden_efectivo = orden_override ?? orden_base
    // Visibilidad POR DELEGACIÓN: si existe override para esta delegación, manda;
    // si no, se usa el esta_activa de la categoría (las globales no tienen
    // desactivación global, así que su base es siempre activa).
    const esta_activa_override =
      override && typeof override.esta_activa === "boolean"
        ? override.esta_activa
        : null
    const esta_activa_efectiva =
      esta_activa_override !== null ? esta_activa_override : categoria.esta_activa

    return {
      ...categoria,
      orden,
      orden_base,
      orden_override,
      orden_efectivo,
      esta_activa_override,
      esta_activa_efectiva,
      has_override: Boolean(override),
    }
  })

  return mapped.sort((a, b) => {
    if (a.orden_efectivo !== b.orden_efectivo) {
      return a.orden_efectivo - b.orden_efectivo
    }
    return a.nombre.localeCompare(b.nombre)
  })
}

export class DatabaseService {
  private static getClient() {
    return supabase
  }

  // Movimiento operations (client-side only)
  static async updateMovimientoCategoria(movimientoId: string, categoriaId: string | null): Promise<void> {
    const supabase = this.getClient() as any
    const { error } = await supabase.from("movimiento").update({ categoria_id: categoriaId }).eq("id", movimientoId)

    if (error) throw error
  }

  // Categoria operations (client-side only)
  static async getCategoriasByDelegacion(
    delegacionId?: string | null,
    options: { includeGlobal?: boolean; includeInactive?: boolean; signal?: AbortSignal } = {},
  ): Promise<CategoriaConOrdenEfectivo[]> {
    const supabase = this.getClient()
    const includeGlobal = options.includeGlobal ?? true
    const includeInactive = options.includeInactive ?? false

    if (!delegacionId && includeGlobal === false) {
      return []
    }

    let query = supabase
      .from("categoria")
      .select(selectCategoriasWithOverrides)
      .order("orden", { ascending: true })

    if (delegacionId) {
      query = includeGlobal
        ? query.or(`delegacion_id.eq.${delegacionId},es_global.is.true`)
        : query.eq("delegacion_id", delegacionId)
    } else if (includeGlobal) {
      query = query.eq("es_global", true)
    }

    if (options.signal) {
      query = query.abortSignal(options.signal)
    }

    const { data, error } = await query

    if (error) throw error
    const mapped = mapCategorias(data as CategoriaWithOverrides[] | null, delegacionId)
    if (includeInactive) {
      return mapped
    }
    return mapped.filter((categoria) => categoria.esta_activa_efectiva !== false)
  }

  static async createCategoria(
    categoria: Omit<Categoria, "id" | "creado_en">,
  ): Promise<Categoria> {
    const supabase = this.getClient() as any
    const { data, error } = await supabase.from("categoria").insert(categoria as any).select().single()

    if (error) throw error
    return data
  }

  static async updateCategoria(id: string, updates: Partial<Categoria>): Promise<void> {
    const supabase = this.getClient() as any
    const { error } = await supabase.from("categoria").update(updates as any).eq("id", id)

    if (error) throw error
  }

  static async deleteCategoria(id: string): Promise<void> {
    const supabase = this.getClient() as any
    const { error } = await supabase.from("categoria").delete().eq("id", id)

    if (error) throw error
  }

  static async setDelegacionCategoryOrder(
    delegacionId: string,
    categoriaId: string,
    orden: number,
  ): Promise<void> {
    const supabase = this.getClient() as any
    const now = new Date().toISOString()

    const { data, error } = await supabase
      .from("categoria_orden_delegacion")
      .update({ orden, actualizado_en: now } as any)
      .match({ delegacion_id: delegacionId, categoria_id: categoriaId })
      .select("categoria_id")

    if (error) throw error

    if (!data || data.length === 0) {
      const { error: insertError } = await supabase.from("categoria_orden_delegacion").insert({
        delegacion_id: delegacionId,
        categoria_id: categoriaId,
        orden,
        esta_activa: true,
      } as any)

      if (insertError) throw insertError
    }
  }

  static async setDelegacionCategoryVisibility(
    delegacionId: string,
    categoriaId: string,
    estaActiva: boolean,
    ordenFallback: number,
  ): Promise<void> {
    const supabase = this.getClient() as any
    const now = new Date().toISOString()

    const { data, error } = await supabase
      .from("categoria_orden_delegacion")
      .update({ esta_activa: estaActiva, actualizado_en: now } as any)
      .match({ delegacion_id: delegacionId, categoria_id: categoriaId })
      .select("categoria_id")

    if (error) throw error

    if (!data || data.length === 0) {
      const { error: insertError } = await supabase.from("categoria_orden_delegacion").insert({
        delegacion_id: delegacionId,
        categoria_id: categoriaId,
        orden: ordenFallback,
        esta_activa: estaActiva,
      } as any)

      if (insertError) throw insertError
    }
  }

  static async clearDelegacionCategoryOrder(
    delegacionId: string,
    categoriaId: string,
  ): Promise<void> {
    const supabase = this.getClient() as any
    const { error } = await supabase
      .from("categoria_orden_delegacion")
      .delete()
      .match({ delegacion_id: delegacionId, categoria_id: categoriaId })

    if (error) throw error
  }

  // ---------------------------------------------------------------------------
  // Contacto operations (client-side)
  // ---------------------------------------------------------------------------

  static async getContactosByDelegacion(
    delegacionId?: string | null,
    options: {
      tipo?: ContactoTipo
      busqueda?: string
      incluirArchivados?: boolean
      incluirGlobales?: boolean
      signal?: AbortSignal
    } = {},
  ): Promise<ContactoConCategoriaPredeterminada[]> {
    const supabase = this.getClient() as any
    const incluirGlobales = options.incluirGlobales ?? true

    if (!delegacionId && !incluirGlobales) return []

    let query = supabase
      .from("contacto")
      .select(`
        *,
        categoria_predeterminada:categoria_id_predeterminada (
          id,
          nombre,
          emoji,
          color
        )
      `)
      .order("archivado", { ascending: true })
      .order("nombre", { ascending: true })

    if (delegacionId) {
      query = incluirGlobales
        ? query.or(`delegacion_id.eq.${delegacionId},es_global.is.true`)
        : query.eq("delegacion_id", delegacionId)
    } else if (incluirGlobales) {
      query = query.eq("es_global", true)
    }

    if (options.tipo) {
      query = query.eq("tipo", options.tipo)
    }

    if (!options.incluirArchivados) {
      query = query.eq("archivado", false)
    }

    if (options.busqueda) {
      const term = options.busqueda.replace(/%/g, "\\%").replace(/,/g, "\\,")
      query = query.or(
        `nombre.ilike.%${term}%,email.ilike.%${term}%,telefono.ilike.%${term}%,identificador_fiscal.ilike.%${term}%,iban.ilike.%${term}%`,
      )
    }

    if (options.signal) {
      query = query.abortSignal(options.signal)
    }

    const { data, error } = await query
    if (error) throw error
    return (data ?? []) as ContactoConCategoriaPredeterminada[]
  }

  static async getContactoById(id: string): Promise<ContactoConCategoriaPredeterminada | null> {
    const supabase = this.getClient() as any
    const { data, error } = await supabase
      .from("contacto")
      .select(`
        *,
        categoria_predeterminada:categoria_id_predeterminada (
          id,
          nombre,
          emoji,
          color
        )
      `)
      .eq("id", id)
      .maybeSingle()
    if (error) throw error
    return (data ?? null) as ContactoConCategoriaPredeterminada | null
  }

  static async createContacto(
    contacto: Omit<ContactoInsert, "creado_en" | "actualizado_en">,
  ): Promise<Contacto> {
    const supabase = this.getClient() as any
    const { data, error } = await supabase.from("contacto").insert(contacto).select().single()
    if (error) throw error
    return data as Contacto
  }

  static async updateContacto(id: string, updates: ContactoUpdate): Promise<void> {
    const supabase = this.getClient() as any
    const { error } = await supabase.from("contacto").update(updates).eq("id", id)
    if (error) throw error
  }

  static async deleteContacto(id: string): Promise<void> {
    const supabase = this.getClient() as any
    const { error } = await supabase.from("contacto").delete().eq("id", id)
    if (error) throw error
  }

  static async archiveContacto(id: string, archivado: boolean): Promise<void> {
    await this.updateContacto(id, { archivado })
  }

  static async getMovimientosByContacto(
    contactoId: string,
    options: { limite?: number; signal?: AbortSignal } = {},
  ): Promise<MovimientoConRelaciones[]> {
    const supabase = this.getClient() as any
    const limite = options.limite ?? 100

    let query = supabase
      .from("movimiento")
      .select(`
        id,
        delegacion_id,
        cuenta_id,
        fecha,
        concepto,
        descripcion,
        importe,
        notas,
        ignorado,
        categoria_id,
        contacto_id,
        pago_mcm_id,
        creado_en,
        cuenta:cuenta_id!inner (
          id,
          delegacion_id,
          nombre,
          tipo,
          origen,
          banco_nombre,
          color,
          activa
        ),
        categoria:categoria_id (
          id,
          nombre,
          color,
          tipo,
          emoji,
          orden,
          categoria_padre_id,
          creado_en
        )
      `)
      .eq("contacto_id", contactoId)
      .eq("ignorado", false)
      .eq("cuenta.activa", true)
      .order("fecha", { ascending: false })
      .order("creado_en", { ascending: false })
      .limit(limite)

    if (options.signal) {
      query = query.abortSignal(options.signal)
    }

    const { data, error } = await query
    if (error) throw error
    return (data ?? []) as MovimientoConRelaciones[]
  }

  // ---------------------------------------------------------------------------
  // Pago MCM operations (client-side)
  // ---------------------------------------------------------------------------

  static async getPagosMcmByDelegacion(
    delegacionId: string,
    options: {
      estados?: PagoMcmEstado[]
      contactoId?: string
      busqueda?: string
      offset?: number
      limit?: number
      signal?: AbortSignal
    } = {},
  ): Promise<PagoMcmConRelaciones[]> {
    const supabase = this.getClient() as any
    let query = supabase
      .from("pago_mcm")
      .select(`
        *,
        contacto:contacto_id (
          id,
          nombre,
          tipo,
          emoji,
          color,
          iban,
          email,
          telefono
        ),
        categoria_sugerida:categoria_id_sugerida (
          id,
          nombre,
          emoji,
          color
        ),
        movimiento:movimiento_id (
          id,
          fecha,
          concepto,
          importe,
          cuenta_id
        )
      `)
      .eq("delegacion_id", delegacionId)
      .order("creado_en", { ascending: false })

    if (options.estados && options.estados.length > 0) {
      query = query.in("estado", options.estados)
    }

    if (options.contactoId) {
      query = query.eq("contacto_id", options.contactoId)
    }

    if (options.busqueda) {
      const term = options.busqueda.replace(/%/g, "\\%").replace(/,/g, "\\,")
      query = query.or(`concepto.ilike.%${term}%,descripcion.ilike.%${term}%,notas.ilike.%${term}%`)
    }

    if (options.offset != null && options.limit != null) {
      query = query.range(options.offset, options.offset + options.limit - 1)
    }

    if (options.signal) {
      query = query.abortSignal(options.signal)
    }

    const { data, error } = await query
    if (error) throw error
    return (data ?? []) as PagoMcmConRelaciones[]
  }

  static async getPagoMcmById(id: string): Promise<PagoMcmConRelaciones | null> {
    const supabase = this.getClient() as any
    const { data, error } = await supabase
      .from("pago_mcm")
      .select(`
        *,
        contacto:contacto_id (
          id,
          nombre,
          tipo,
          emoji,
          color,
          iban,
          email,
          telefono
        ),
        categoria_sugerida:categoria_id_sugerida (
          id,
          nombre,
          emoji,
          color
        ),
        movimiento:movimiento_id (
          id,
          fecha,
          concepto,
          importe,
          cuenta_id
        )
      `)
      .eq("id", id)
      .maybeSingle()
    if (error) throw error
    return (data ?? null) as PagoMcmConRelaciones | null
  }

  static async createPagoMcm(
    pago: Omit<PagoMcmInsert, "creado_en" | "actualizado_en">,
  ): Promise<PagoMcm> {
    const supabase = this.getClient() as any
    const { data, error } = await supabase.from("pago_mcm").insert(pago).select().single()
    if (error) throw error
    return data as PagoMcm
  }

  static async updatePagoMcm(id: string, updates: PagoMcmUpdate): Promise<void> {
    const supabase = this.getClient() as any
    const { error } = await supabase.from("pago_mcm").update(updates).eq("id", id)
    if (error) throw error
  }

  static async deletePagoMcm(id: string): Promise<void> {
    const supabase = this.getClient() as any
    const { error } = await supabase.from("pago_mcm").delete().eq("id", id)
    if (error) throw error
  }

  /**
   * Convierte un pago MCM en un movimiento manual (gasto) en la cuenta indicada.
   * Crea el movimiento con importe negativo (gasto), copia contacto y categoría
   * del pago, y vincula ambos lados (pago_mcm.movimiento_id y movimiento.pago_mcm_id).
   * Tras vincular, el trigger marca el pago como 'pagado'. También replica los
   * adjuntos del pago en movimiento_archivo para que aparezcan desde el movimiento.
   */
  static async convertPagoToMovimiento(
    pagoId: string,
    options: {
      cuentaId: string
      fecha: string // YYYY-MM-DD
      delegacionId: string
      creadoPor: string
    },
  ): Promise<{ movimientoId: string }> {
    const supabase = this.getClient() as any

    const pago = await this.getPagoMcmById(pagoId)
    if (!pago) throw new Error("Pago MCM no encontrado")
    if (pago.movimiento_id) throw new Error("Este pago ya está vinculado a un movimiento")

    const movimientoInsert = {
      cuenta_id: options.cuentaId,
      delegacion_id: options.delegacionId,
      fecha: options.fecha,
      concepto: pago.concepto,
      descripcion: pago.descripcion,
      importe: -Math.abs(Number(pago.importe)),
      categoria_id: pago.categoria_id_sugerida,
      contacto_id: pago.contacto_id,
      pago_mcm_id: pago.id,
      notas: pago.notas,
      origen_sync: "manual" as const,
      creado_por: options.creadoPor,
    }

    const { data: created, error: insertErr } = await supabase
      .from("movimiento")
      .insert(movimientoInsert)
      .select("id")
      .single()
    if (insertErr) throw insertErr

    // Vincular el pago al movimiento (trigger ajusta estado a 'pagado').
    const { error: updErr } = await supabase
      .from("pago_mcm")
      .update({ movimiento_id: created.id })
      .eq("id", pagoId)
    if (updErr) {
      // rollback best-effort
      await supabase.from("movimiento").delete().eq("id", created.id)
      throw updErr
    }

    // Replica los adjuntos del pago en movimiento_archivo (best-effort: si falla,
    // el pago y movimiento siguen vinculados; el usuario puede resubir).
    await this.replicateArchivosPagoToMovimiento(pagoId, created.id, options.creadoPor).catch(
      (err) => console.warn("No se pudieron replicar adjuntos del pago al movimiento:", err),
    )

    return { movimientoId: created.id }
  }

  /**
   * Vincula un pago MCM a un movimiento existente (sin crear nada nuevo).
   * Replica los adjuntos del pago en movimiento_archivo.
   */
  static async linkPagoToMovimiento(pagoId: string, movimientoId: string, creadoPor?: string): Promise<void> {
    const supabase = this.getClient() as any

    const { error: updPagoErr } = await supabase
      .from("pago_mcm")
      .update({ movimiento_id: movimientoId })
      .eq("id", pagoId)
    if (updPagoErr) throw updPagoErr

    const { error: updMovErr } = await supabase
      .from("movimiento")
      .update({ pago_mcm_id: pagoId })
      .eq("id", movimientoId)
    if (updMovErr) throw updMovErr

    // Replica los adjuntos best-effort. Si no nos dieron creadoPor, lo obtenemos.
    let userId = creadoPor
    if (!userId) {
      const { data } = await supabase.auth.getUser()
      userId = data?.user?.id ?? undefined
    }
    if (userId) {
      await this.replicateArchivosPagoToMovimiento(pagoId, movimientoId, userId).catch((err) =>
        console.warn("No se pudieron replicar adjuntos del pago al movimiento:", err),
      )
    }
  }

  /**
   * Inserta copias de los adjuntos del pago en movimiento_archivo apuntando al
   * mismo path de Storage. UNIQUE (movimiento_id, path_storage) evita duplicados
   * si la operación se repite.
   */
  private static async replicateArchivosPagoToMovimiento(
    pagoId: string,
    movimientoId: string,
    subidoPor: string,
  ): Promise<void> {
    const supabase = this.getClient() as any

    const { data: adjuntos, error } = await supabase
      .from("archivo_adjunto")
      .select("*")
      .eq("entidad", "pago_mcm")
      .eq("entidad_id", pagoId)
    if (error) throw error
    if (!Array.isArray(adjuntos) || adjuntos.length === 0) return

    // movimiento_archivo usa "tamaño_bytes" (con ñ) y subido_por (string NOT NULL).
    const inserts = adjuntos.map((a: any) => ({
      movimiento_id: movimientoId,
      nombre_original: a.nombre_original,
      nombre_archivo: a.nombre_archivo,
      tipo_mime: a.tipo_mime,
      "tamaño_bytes": a.tamano_bytes,
      bucket: a.bucket,
      path_storage: a.path_storage,
      url_publica: a.url_publica,
      es_factura: a.es_factura,
      descripcion: a.descripcion,
      subido_por: subidoPor,
    }))

    // upsert con onConflict para idempotencia
    await supabase
      .from("movimiento_archivo")
      .upsert(inserts, { onConflict: "movimiento_id,path_storage", ignoreDuplicates: true })
  }

  /**
   * Desvincula un pago MCM de su movimiento (el movimiento sigue existiendo).
   */
  static async unlinkPagoFromMovimiento(pagoId: string): Promise<void> {
    const supabase = this.getClient() as any
    const pago = await this.getPagoMcmById(pagoId)
    if (!pago?.movimiento_id) return

    const movimientoId = pago.movimiento_id
    const { error: e1 } = await supabase
      .from("pago_mcm")
      .update({ movimiento_id: null })
      .eq("id", pagoId)
    if (e1) throw e1

    const { error: e2 } = await supabase
      .from("movimiento")
      .update({ pago_mcm_id: null })
      .eq("id", movimientoId)
    if (e2) throw e2
  }

  /**
   * Devuelve la cuenta de la delegación con más movimientos (sugerencia por defecto
   * para 'convertir pago a movimiento'), vía la RPC get_cuenta_con_mas_movimientos
   * (una sola llamada, en vez de una query count por cuenta). NULL si la
   * delegación no tiene movimientos; el caller cae a cuentas[0].
   */
  static async getCuentaConMasMovimientos(delegacionId: string): Promise<string | null> {
    const client = this.getClient() as any
    const { data, error } = await client.rpc("get_cuenta_con_mas_movimientos", {
      p_delegacion_id: delegacionId,
    })
    if (error) return null
    return (data as string | null) ?? null
  }

  /**
   * Busca movimientos candidatos para vincular a un pago MCM. Usa el mismo
   * margen que la vía de facturas (margenImporteFactura: 2%, mínimo 0,50 €)
   * en vez de exigir importe exacto, para que ambos flujos encuentren
   * candidatos con diferencias de céntimos. Excluye los que ya tienen
   * pago_mcm_id.
   */
  static async findCandidatosMovimientoParaPago(
    delegacionId: string,
    importe: number,
    opts: { contactoId?: string | null; limit?: number; signal?: AbortSignal } = {},
  ): Promise<MovimientoConRelaciones[]> {
    const supabase = this.getClient() as any
    // Pagos son gastos: el movimiento del banco tendrá importe negativo del mismo valor absoluto.
    const target = -Math.abs(importe)
    const margen = margenImporteFactura(importe)
    let query = supabase
      .from("movimiento")
      .select(`
        id,
        delegacion_id,
        cuenta_id,
        fecha,
        concepto,
        descripcion,
        importe,
        notas,
        ignorado,
        categoria_id,
        contacto_id,
        pago_mcm_id,
        creado_en,
        cuenta:cuenta_id (
          id,
          nombre,
          banco_nombre,
          color
        )
      `)
      .eq("delegacion_id", delegacionId)
      .gte("importe", target - margen)
      .lte("importe", target + margen)
      .is("pago_mcm_id", null)
      .order("fecha", { ascending: false })
      .limit(opts.limit ?? 20)

    if (opts.contactoId) {
      // Prioriza los del mismo contacto, pero no excluye los otros
      // (postgrest no soporta order by case-when; lo dejamos a nivel cliente)
    }

    if (opts.signal) query = query.abortSignal(opts.signal)

    const { data, error } = await query
    if (error) throw error
    const list = (data ?? []) as MovimientoConRelaciones[]

    if (opts.contactoId) {
      // Sort: same contacto first
      list.sort((a, b) => {
        const aMatch = a.contacto_id === opts.contactoId ? 0 : 1
        const bMatch = b.contacto_id === opts.contactoId ? 0 : 1
        return aMatch - bMatch
      })
    }

    return list
  }

  // ---------------------------------------------------------------------------
  // Factura operations (client-side)
  // ---------------------------------------------------------------------------

  private static readonly FACTURA_SELECT = `
    *,
    contacto:contacto_id (
      id,
      nombre,
      tipo,
      emoji,
      color,
      email,
      identificador_fiscal
    ),
    movimientos:movimiento (
      id,
      fecha,
      concepto,
      importe,
      cuenta_id
    )
  `

  /**
   * archivo_adjunto es polimórfico (sin FK a factura), así que los adjuntos
   * se cargan aparte y se mezclan en memoria.
   */
  private static async attachArchivosToFacturas(
    facturas: FacturaConRelaciones[],
    signal?: AbortSignal,
  ): Promise<FacturaConRelaciones[]> {
    if (facturas.length === 0) return facturas
    const supabase = this.getClient() as any
    let query = supabase
      .from("archivo_adjunto")
      .select("id, entidad_id, nombre_original, tipo_mime, url_publica, path_storage, bucket, tamano_bytes, subido_en")
      .eq("entidad", "factura")
      .in("entidad_id", facturas.map((f) => f.id))
      .order("subido_en", { ascending: false })
    if (signal) query = query.abortSignal(signal)
    const { data, error } = await query
    if (error) throw error

    const porFactura = new Map<string, any[]>()
    for (const archivo of data ?? []) {
      const list = porFactura.get(archivo.entidad_id) ?? []
      list.push(archivo)
      porFactura.set(archivo.entidad_id, list)
    }
    return facturas.map((f) => ({ ...f, archivos: porFactura.get(f.id) ?? [] }))
  }

  static async getFacturasByDelegacion(
    delegacionId: string,
    options: {
      estados?: FacturaEstado[]
      contactoId?: string
      busqueda?: string
      offset?: number
      limit?: number
      signal?: AbortSignal
    } = {},
  ): Promise<FacturaConRelaciones[]> {
    const supabase = this.getClient() as any
    let query = supabase
      .from("factura")
      .select(this.FACTURA_SELECT)
      .eq("delegacion_id", delegacionId)
      .order("fecha_emision", { ascending: false, nullsFirst: false })
      .order("creado_en", { ascending: false })

    if (options.estados && options.estados.length > 0) {
      query = query.in("estado", options.estados)
    }
    if (options.contactoId) {
      query = query.eq("contacto_id", options.contactoId)
    }
    if (options.busqueda) {
      const term = options.busqueda.replace(/%/g, "\\%").replace(/,/g, "\\,")
      query = query.or(`concepto.ilike.%${term}%,numero.ilike.%${term}%,notas.ilike.%${term}%`)
    }
    if (options.offset != null && options.limit != null) {
      query = query.range(options.offset, options.offset + options.limit - 1)
    }
    if (options.signal) {
      query = query.abortSignal(options.signal)
    }

    const { data, error } = await query
    if (error) throw error
    return this.attachArchivosToFacturas((data ?? []) as FacturaConRelaciones[], options.signal)
  }

  static async getFacturaById(id: string): Promise<FacturaConRelaciones | null> {
    const supabase = this.getClient() as any
    const { data, error } = await supabase
      .from("factura")
      .select(this.FACTURA_SELECT)
      .eq("id", id)
      .maybeSingle()
    if (error) throw error
    if (!data) return null
    const [conArchivos] = await this.attachArchivosToFacturas([data as FacturaConRelaciones])
    return conArchivos
  }

  static async getFacturaByMovimiento(movimientoId: string): Promise<FacturaConRelaciones | null> {
    const supabase = this.getClient() as any
    const { data: movimiento, error: movErr } = await supabase
      .from("movimiento")
      .select("factura_id")
      .eq("id", movimientoId)
      .maybeSingle()
    if (movErr) throw movErr
    if (!movimiento?.factura_id) return null
    return this.getFacturaById(movimiento.factura_id)
  }

  static async createFactura(
    factura: Omit<FacturaInsert, "creado_en" | "actualizado_en">,
  ): Promise<Factura> {
    const supabase = this.getClient() as any
    const { data, error } = await supabase.from("factura").insert(factura).select().single()
    if (error) throw error
    return data as Factura
  }

  static async updateFactura(id: string, updates: FacturaUpdate): Promise<void> {
    const supabase = this.getClient() as any
    const { error } = await supabase.from("factura").update(updates).eq("id", id)
    if (error) throw error
  }

  /**
   * Elimina una factura y sus adjuntos (registros; el borrado en Storage lo
   * hace el hook de archivos antes de llamar aquí, si procede). Desvincula
   * todos los movimientos que tuviera asociados (puede haber varios: pagos
   * en varios plazos).
   */
  static async deleteFactura(id: string): Promise<void> {
    const supabase = this.getClient() as any

    await supabase.from("movimiento").update({ factura_id: null }).eq("factura_id", id)

    const { data: archivos } = await supabase
      .from("archivo_adjunto")
      .select("path_storage, bucket")
      .eq("entidad", "factura")
      .eq("entidad_id", id)
    for (const archivo of (archivos ?? []) as { path_storage: string; bucket: "facturas" | "documentos" }[]) {
      await FileService.deleteFile(archivo.path_storage, archivo.bucket).catch((err) =>
        console.warn("No se pudo eliminar el archivo de Storage:", err),
      )
    }
    await supabase.from("archivo_adjunto").delete().eq("entidad", "factura").eq("entidad_id", id)

    const { error } = await supabase.from("factura").delete().eq("id", id)
    if (error) throw error
  }

  /**
   * Vincula una factura a un movimiento existente (conciliación). Una factura
   * puede tener varios movimientos vinculados (pago en varios plazos); un
   * movimiento, como mucho, uno.
   * - El trigger de BD recalcula el estado de la factura (pagada / pagada_parcial)
   *   comparando su importe con la suma de los movimientos vinculados.
   * - Sincroniza el contacto en ambos sentidos (sin machacar el que exista).
   * - Rellena importe/fecha de la factura desde el movimiento solo si estaban vacíos.
   * - Replica los adjuntos de la factura en movimiento_archivo (mismo Storage).
   */
  static async linkFacturaToMovimiento(
    facturaId: string,
    movimientoId: string,
    creadoPor?: string,
  ): Promise<void> {
    const supabase = this.getClient() as any

    const [{ data: factura, error: facturaErr }, { data: movimiento, error: movErr }] = await Promise.all([
      supabase.from("factura").select("*").eq("id", facturaId).maybeSingle(),
      supabase.from("movimiento").select("id, fecha, importe, contacto_id, factura_id").eq("id", movimientoId).maybeSingle(),
    ])
    if (facturaErr) throw facturaErr
    if (movErr) throw movErr
    if (!factura) throw new Error("Factura no encontrada")
    if (!movimiento) throw new Error("Movimiento no encontrado")
    if (movimiento.factura_id) throw new Error("Ese movimiento ya tiene una factura vinculada")

    const movimientoUpdates: Record<string, unknown> = { factura_id: facturaId }
    if (factura.contacto_id && !movimiento.contacto_id) movimientoUpdates.contacto_id = factura.contacto_id

    const { error: updMovErr } = await supabase
      .from("movimiento")
      .update(movimientoUpdates)
      .eq("id", movimientoId)
    if (updMovErr) throw updMovErr

    // Relleno best-effort de datos de la factura (no bloquea el vínculo si falla).
    const facturaUpdates: Record<string, unknown> = {}
    if (factura.importe == null) facturaUpdates.importe = Math.abs(Number(movimiento.importe))
    if (!factura.fecha_emision && movimiento.fecha) facturaUpdates.fecha_emision = movimiento.fecha
    if (!factura.contacto_id && movimiento.contacto_id) facturaUpdates.contacto_id = movimiento.contacto_id
    if (Object.keys(facturaUpdates).length > 0) {
      const { error } = await supabase.from("factura").update(facturaUpdates).eq("id", facturaId)
      if (error) console.warn("No se pudieron rellenar los datos de la factura:", error)
    }

    let userId = creadoPor
    if (!userId) {
      const { data } = await supabase.auth.getUser()
      userId = data?.user?.id ?? undefined
    }
    if (userId) {
      await this.replicateArchivosFacturaToMovimiento(facturaId, movimientoId, userId).catch((err) =>
        console.warn("No se pudieron replicar adjuntos de la factura al movimiento:", err),
      )
    }
  }

  /**
   * Desvincula un movimiento concreto de una factura (una factura puede tener
   * varios; hay que indicar cuál se desvincula). El trigger recalcula el
   * estado de la factura con los movimientos restantes.
   */
  static async unlinkFacturaFromMovimiento(facturaId: string, movimientoId: string): Promise<void> {
    const supabase = this.getClient() as any
    const { error } = await supabase
      .from("movimiento")
      .update({ factura_id: null })
      .eq("id", movimientoId)
      .eq("factura_id", facturaId)
    if (error) throw error
  }

  /**
   * Inserta copias de los adjuntos de la factura en movimiento_archivo
   * apuntando al mismo path de Storage (idempotente por UNIQUE).
   */
  private static async replicateArchivosFacturaToMovimiento(
    facturaId: string,
    movimientoId: string,
    subidoPor: string,
  ): Promise<void> {
    const supabase = this.getClient() as any

    const { data: adjuntos, error } = await supabase
      .from("archivo_adjunto")
      .select("*")
      .eq("entidad", "factura")
      .eq("entidad_id", facturaId)
    if (error) throw error
    if (!Array.isArray(adjuntos) || adjuntos.length === 0) return

    const inserts = adjuntos.map((a: any) => ({
      movimiento_id: movimientoId,
      nombre_original: a.nombre_original,
      nombre_archivo: a.nombre_archivo,
      tipo_mime: a.tipo_mime,
      "tamaño_bytes": a.tamano_bytes,
      bucket: a.bucket,
      path_storage: a.path_storage,
      url_publica: a.url_publica,
      es_factura: true,
      descripcion: a.descripcion,
      subido_por: subidoPor,
    }))

    await supabase
      .from("movimiento_archivo")
      .upsert(inserts, { onConflict: "movimiento_id,path_storage", ignoreDuplicates: true })
  }

  /**
   * Crea (si no existe) la entidad factura para un movimiento al que se le ha
   * subido una factura. Copia fecha, importe y contacto del movimiento y queda
   * vinculada y 'pagada'. Devuelve la factura (existente o recién creada).
   */
  static async ensureFacturaForMovimiento(
    movimientoId: string,
    options: { creadoPor?: string } = {},
  ): Promise<Factura> {
    const supabase = this.getClient() as any

    const { data: movimiento, error: movErr } = await supabase
      .from("movimiento")
      .select("id, delegacion_id, fecha, concepto, importe, contacto_id, factura_id")
      .eq("id", movimientoId)
      .maybeSingle()
    if (movErr) throw movErr
    if (!movimiento) throw new Error("Movimiento no encontrado")

    if (movimiento.factura_id) {
      const { data: existente, error } = await supabase
        .from("factura")
        .select("*")
        .eq("id", movimiento.factura_id)
        .maybeSingle()
      if (error) throw error
      if (existente) return existente as Factura
    }
    if (!movimiento.delegacion_id) throw new Error("El movimiento no tiene delegación")

    const insert: Record<string, unknown> = {
      delegacion_id: movimiento.delegacion_id,
      contacto_id: movimiento.contacto_id,
      concepto: movimiento.concepto,
      fecha_emision: movimiento.fecha,
      importe: Math.abs(Number(movimiento.importe)) || null,
      origen: "movimiento",
      creado_por: options.creadoPor ?? null,
    }

    const { data: creada, error: insertErr } = await supabase
      .from("factura")
      .insert(insert)
      .select()
      .single()
    if (insertErr) throw insertErr

    const { error: updErr } = await supabase
      .from("movimiento")
      .update({ factura_id: creada.id })
      .eq("id", movimientoId)
    if (updErr) {
      await supabase.from("factura").delete().eq("id", creada.id)
      throw updErr
    }

    return creada as Factura
  }

  /**
   * Registra en archivo_adjunto (entidad='factura') un archivo ya subido a
   * Storage (desde la bandeja o replicado desde movimiento_archivo). Idempotente.
   */
  static async registrarArchivoFactura(
    facturaId: string,
    delegacionId: string,
    archivo: {
      nombre_original: string
      nombre_archivo: string
      tipo_mime: string
      tamanoBytes: number
      bucket: string
      path_storage: string
      url_publica: string
      descripcion?: string | null
      subido_por: string
    },
  ): Promise<void> {
    const supabase = this.getClient() as any
    const { error } = await supabase.from("archivo_adjunto").upsert(
      [
        {
          entidad: "factura",
          entidad_id: facturaId,
          delegacion_id: delegacionId,
          nombre_original: archivo.nombre_original,
          nombre_archivo: archivo.nombre_archivo,
          tipo_mime: archivo.tipo_mime,
          tamano_bytes: archivo.tamanoBytes,
          bucket: archivo.bucket,
          path_storage: archivo.path_storage,
          url_publica: archivo.url_publica,
          es_factura: true,
          descripcion: archivo.descripcion ?? null,
          subido_por: archivo.subido_por,
        },
      ],
      { onConflict: "entidad,entidad_id,path_storage", ignoreDuplicates: true },
    )
    if (error) throw error
  }

  /**
   * Busca movimientos candidatos para conciliar con una factura.
   * El importe manda (con un pequeño margen); la fecha y el contacto afinan.
   * Devuelve la lista ordenada por puntuación (mejor primero).
   */
  static async findCandidatosMovimientoParaFactura(
    delegacionId: string,
    factura: { importe?: number | null; fecha_emision?: string | null; contacto_id?: string | null },
    opts: { limit?: number; signal?: AbortSignal } = {},
  ): Promise<MovimientoConRelaciones[]> {
    const supabase = this.getClient() as any
    let query = supabase
      .from("movimiento")
      .select(`
        id,
        delegacion_id,
        cuenta_id,
        fecha,
        concepto,
        descripcion,
        importe,
        notas,
        ignorado,
        categoria_id,
        contacto_id,
        factura_id,
        creado_en,
        cuenta:cuenta_id (
          id,
          nombre,
          banco_nombre,
          color
        )
      `)
      .eq("delegacion_id", delegacionId)
      .is("factura_id", null)
      .eq("ignorado", false)
      .lt("importe", 0)
      .order("fecha", { ascending: false })

    if (factura.importe != null && factura.importe > 0) {
      // Facturas son gastos: el movimiento tendrá importe negativo.
      const margen = margenImporteFactura(factura.importe)
      query = query
        .gte("importe", -(Number(factura.importe) + margen))
        .lte("importe", -(Number(factura.importe) - margen))
        .limit(opts.limit ?? 30)
    } else {
      // Sin importe conocido: últimos gastos sin factura.
      query = query.limit(opts.limit ?? 30)
    }

    if (opts.signal) query = query.abortSignal(opts.signal)

    const { data, error } = await query
    if (error) throw error
    const list = (data ?? []) as MovimientoConRelaciones[]

    return list
      .map((m) => ({ m, s: scoreCandidatoMovimiento(factura, m) }))
      .sort((a, b) => b.s.score - a.s.score || (a.m.fecha < b.m.fecha ? 1 : -1))
      .map(({ m }) => m)
  }

  /**
   * Busca facturas candidatas para conciliar con un movimiento (lado movimiento).
   * Excluye facturas ya completamente pagadas. El importe manda, pero comparado
   * contra el importe PENDIENTE de la factura (importe total menos lo ya
   * vinculado en otros movimientos), para soportar pagos en varios plazos.
   */
  static async findCandidatosFacturaParaMovimiento(
    movimientoId: string,
    opts: { limit?: number; signal?: AbortSignal } = {},
  ): Promise<FacturaConRelaciones[]> {
    const supabase = this.getClient() as any

    const { data: movimiento, error: movErr } = await supabase
      .from("movimiento")
      .select("id, delegacion_id, fecha, importe, contacto_id")
      .eq("id", movimientoId)
      .maybeSingle()
    if (movErr) throw movErr
    if (!movimiento?.delegacion_id) return []

    let query = supabase
      .from("factura")
      .select(this.FACTURA_SELECT)
      .eq("delegacion_id", movimiento.delegacion_id)
      .not("estado", "in", "(pagada,pagada_fuera)")
      .order("creado_en", { ascending: false })
      .limit(opts.limit ?? 40)
    if (opts.signal) query = query.abortSignal(opts.signal)

    const { data, error } = await query
    if (error) throw error
    const facturas = (data ?? []) as FacturaConRelaciones[]

    const importeMov = Math.abs(Number(movimiento.importe))
    const scored = facturas
      .map((f) => {
        const pagado = (f.movimientos ?? []).reduce((sum, m) => sum + Math.abs(Number(m.importe)), 0)
        const pendiente = f.importe != null ? Math.max(Number(f.importe) - pagado, 0) : null
        const score = scoreCandidatoMovimiento(
          { importe: pendiente, fecha_emision: f.fecha_emision, contacto_id: f.contacto_id },
          { importe: movimiento.importe, fecha: movimiento.fecha, contacto_id: movimiento.contacto_id } as any,
        )
        // Descarta las que se van mucho de precio (si el pendiente es conocido)
        const fueraDeMargen = pendiente != null && Math.abs(pendiente - importeMov) > margenImporteFactura(importeMov)
        return { f, score, fueraDeMargen }
      })
      .filter(({ fueraDeMargen }) => !fueraDeMargen)
      .sort((a, b) => b.score.score - a.score.score)
      .map(({ f }) => f)

    return this.attachArchivosToFacturas(scored, opts.signal)
  }

  // ---------------------------------------------------------------------------
  // Dashboard aggregations (RPC — computed in database, not in JS)
  // ---------------------------------------------------------------------------

  static async getFinancialSummary(
    delegacionId: string,
    desde: string,
    hasta: string,
    signal?: AbortSignal,
  ): Promise<FinancialSummary> {
    const client = this.getClient() as any
    let query = client.rpc("get_financial_summary", {
      p_delegacion_id: delegacionId,
      p_desde: desde,
      p_hasta: hasta,
    })
    if (signal) query = query.abortSignal(signal)
    const { data, error } = await query
    if (error) throw error
    // rpc returns an array of rows; we want the first (and only) row
    const row = Array.isArray(data) ? data[0] : data
    return {
      ingresos: Number(row?.ingresos ?? 0),
      gastos: Number(row?.gastos ?? 0),
      balance: Number(row?.balance ?? 0),
      total_movimientos: Number(row?.total_movimientos ?? 0),
      sin_categoria: Number(row?.sin_categoria ?? 0),
    }
  }

  static async getMonthlyTrend(
    delegacionId: string,
    desde: string,
    hasta: string,
    signal?: AbortSignal,
  ): Promise<MonthlyTrendRow[]> {
    const client = this.getClient() as any
    let query = client.rpc("get_monthly_trend", {
      p_delegacion_id: delegacionId,
      p_desde: desde,
      p_hasta: hasta,
    })
    if (signal) query = query.abortSignal(signal)
    const { data, error } = await query
    if (error) throw error
    return ((data as any[]) ?? []).map((row) => ({
      mes: String(row.mes),
      ingresos: Number(row.ingresos ?? 0),
      gastos: Number(row.gastos ?? 0),
    }))
  }

  static async getCategoryBreakdown(
    delegacionId: string,
    desde: string,
    hasta: string,
    signal?: AbortSignal,
  ): Promise<CategoryBreakdownRow[]> {
    const client = this.getClient() as any
    let query = client.rpc("get_category_breakdown", {
      p_delegacion_id: delegacionId,
      p_desde: desde,
      p_hasta: hasta,
    })
    if (signal) query = query.abortSignal(signal)
    const { data, error } = await query
    if (error) throw error
    return ((data as any[]) ?? []).map((row) => ({
      categoria_id: row.categoria_id ?? null,
      categoria_nombre: row.categoria_nombre ?? null,
      categoria_emoji: row.categoria_emoji ?? null,
      categoria_color: row.categoria_color ?? null,
      ingresos: Number(row.ingresos ?? 0),
      gastos: Number(row.gastos ?? 0),
    }))
  }

  /** Resumen de facturas por estado (contadores de pestaña + KPI de /facturas). */
  static async getFacturasResumen(delegacionId: string, signal?: AbortSignal): Promise<FacturaResumenRow[]> {
    const client = this.getClient() as any
    let query = client.rpc("get_facturas_resumen", { p_delegacion_id: delegacionId })
    if (signal) query = query.abortSignal(signal)
    const { data, error } = await query
    if (error) throw error
    return ((data as any[]) ?? []).map((row) => ({
      estado: row.estado as FacturaResumenRow["estado"],
      n: Number(row.n ?? 0),
      importe_total: Number(row.importe_total ?? 0),
      importe_pendiente: Number(row.importe_pendiente ?? 0),
    }))
  }

  /** Resumen de pagos MCM por estado (contadores de pestaña + línea de resumen de /pagos-mcm). */
  static async getPagosMcmResumen(delegacionId: string, signal?: AbortSignal): Promise<PagoMcmResumenRow[]> {
    const client = this.getClient() as any
    let query = client.rpc("get_pagos_mcm_resumen", { p_delegacion_id: delegacionId })
    if (signal) query = query.abortSignal(signal)
    const { data, error } = await query
    if (error) throw error
    return ((data as any[]) ?? []).map((row) => ({
      estado: row.estado as PagoMcmResumenRow["estado"],
      n: Number(row.n ?? 0),
      importe_total: Number(row.importe_total ?? 0),
    }))
  }
}
