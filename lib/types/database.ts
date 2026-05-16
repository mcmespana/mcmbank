export type Database = {
  public: {
    Tables: {
      organizacion: {
        Row: {
          id: string
          codigo: string | null
          nombre: string
          creado_en: string
        }
        Insert: {
          id?: string
          codigo?: string | null
          nombre: string
          creado_en?: string
        }
        Update: {
          id?: string
          codigo?: string | null
          nombre?: string
          creado_en?: string
        }
      }
      delegacion: {
        Row: {
          id: string
          organizacion_id: string
          codigo: string | null
          nombre: string
          creado_en: string
        }
        Insert: {
          id?: string
          organizacion_id: string
          codigo?: string | null
          nombre: string
          creado_en?: string
        }
        Update: {
          id?: string
          organizacion_id?: string
          codigo?: string | null
          nombre?: string
          creado_en?: string
        }
      }
      cuenta: {
        Row: {
          id: string
          delegacion_id: string
          nombre: string
          tipo: string
          origen: string
          banco_nombre: string | null
          iban: string | null
          color: string | null
          personas_autorizadas: string | null
          descripcion: string | null
          creado_en: string
          banco_conexion_id: string | null
          external_account_uid: string | null
          external_account_hash: string | null
          sync_enabled: boolean
          last_sync_at: string | null
          last_sync_status: string | null
          last_sync_error: string | null
          sync_desde_fecha: string | null
        }
        Insert: {
          id?: string
          delegacion_id: string
          nombre: string
          tipo: string
          origen: string
          banco_nombre?: string | null
          iban?: string | null
          color?: string | null
          personas_autorizadas?: string | null
          descripcion?: string | null
          creado_en?: string
          banco_conexion_id?: string | null
          external_account_uid?: string | null
          external_account_hash?: string | null
          sync_enabled?: boolean
          last_sync_at?: string | null
          last_sync_status?: string | null
          last_sync_error?: string | null
          sync_desde_fecha?: string | null
        }
        Update: {
          id?: string
          delegacion_id?: string
          nombre?: string
          tipo?: string
          origen?: string
          banco_nombre?: string | null
          iban?: string | null
          color?: string | null
          personas_autorizadas?: string | null
          descripcion?: string | null
          creado_en?: string
          banco_conexion_id?: string | null
          external_account_uid?: string | null
          external_account_hash?: string | null
          sync_enabled?: boolean
          last_sync_at?: string | null
          last_sync_status?: string | null
          last_sync_error?: string | null
          sync_desde_fecha?: string | null
        }
      }
      movimiento: {
        Row: {
          id: string
          cuenta_id: string
          delegacion_id: string
          fecha: string
          concepto: string
          descripcion: string | null
          texto_extra_1: string | null
          texto_extra_2: string | null
          contraparte: string | null
          importe: number
          metodo: string | null
          notas: string | null
          ignorado: boolean
          categoria_id: string | null
          contacto_id: string | null
          pago_mcm_id: string | null
          adjunto_principal_url: string | null
          creado_por: string
          creado_en: string
          concepto_hash: string | null
          external_id: string | null
          external_id_source: "transaction_id" | "entry_reference" | "composite_hash" | null
          booking_date: string | null
          value_date: string | null
          origen_sync: "manual" | "import_excel" | "enablebanking" | null
        }
        Insert: {
          id?: string
          cuenta_id: string
          delegacion_id: string
          fecha: string
          concepto: string
          descripcion?: string | null
          texto_extra_1?: string | null
          texto_extra_2?: string | null
          contraparte?: string | null
          importe: number
          metodo?: string | null
          notas?: string | null
          ignorado?: boolean
          categoria_id?: string | null
          contacto_id?: string | null
          pago_mcm_id?: string | null
          adjunto_principal_url?: string | null
          creado_por: string
          creado_en?: string
          concepto_hash?: string | null
          external_id?: string | null
          external_id_source?: "transaction_id" | "entry_reference" | "composite_hash" | null
          booking_date?: string | null
          value_date?: string | null
          origen_sync?: "manual" | "import_excel" | "enablebanking" | null
        }
        Update: {
          id?: string
          cuenta_id?: string
          delegacion_id?: string
          fecha?: string
          concepto?: string
          descripcion?: string | null
          texto_extra_1?: string | null
          texto_extra_2?: string | null
          contraparte?: string | null
          importe?: number
          metodo?: string | null
          notas?: string | null
          ignorado?: boolean
          categoria_id?: string | null
          contacto_id?: string | null
          pago_mcm_id?: string | null
          adjunto_principal_url?: string | null
          creado_por?: string
          creado_en?: string
          concepto_hash?: string | null
          external_id?: string | null
          external_id_source?: "transaction_id" | "entry_reference" | "composite_hash" | null
          booking_date?: string | null
          value_date?: string | null
          origen_sync?: "manual" | "import_excel" | "enablebanking" | null
        }
      }
      contacto: {
        Row: {
          id: string
          delegacion_id: string | null
          es_global: boolean
          tipo: "proveedor" | "persona_mcm" | "destinatario_mcm"
          nombre: string
          emoji: string | null
          color: string | null
          identificador_fiscal: string | null
          iban: string | null
          email: string | null
          telefono: string | null
          direccion: string | null
          ciudad: string | null
          codigo_postal: string | null
          categoria_id_predeterminada: string | null
          notas: string | null
          archivado: boolean
          creado_por: string | null
          creado_en: string
          actualizado_en: string
        }
        Insert: {
          id?: string
          delegacion_id?: string | null
          es_global?: boolean
          tipo: "proveedor" | "persona_mcm" | "destinatario_mcm"
          nombre: string
          emoji?: string | null
          color?: string | null
          identificador_fiscal?: string | null
          iban?: string | null
          email?: string | null
          telefono?: string | null
          direccion?: string | null
          ciudad?: string | null
          codigo_postal?: string | null
          categoria_id_predeterminada?: string | null
          notas?: string | null
          archivado?: boolean
          creado_por?: string | null
          creado_en?: string
          actualizado_en?: string
        }
        Update: {
          id?: string
          delegacion_id?: string | null
          es_global?: boolean
          tipo?: "proveedor" | "persona_mcm" | "destinatario_mcm"
          nombre?: string
          emoji?: string | null
          color?: string | null
          identificador_fiscal?: string | null
          iban?: string | null
          email?: string | null
          telefono?: string | null
          direccion?: string | null
          ciudad?: string | null
          codigo_postal?: string | null
          categoria_id_predeterminada?: string | null
          notas?: string | null
          archivado?: boolean
          creado_por?: string | null
          creado_en?: string
          actualizado_en?: string
        }
      }
      pago_mcm: {
        Row: {
          id: string
          delegacion_id: string
          contacto_id: string
          concepto: string
          descripcion: string | null
          importe: number
          moneda: string
          estado: "borrador" | "pendiente" | "pagado" | "cancelado"
          tipo_calculo: "manual" | "gasolina_tickets" | "gasolina_km" | "gasolina_avanzado"
          gasolina_km_un_trayecto: number | null
          gasolina_ida_vuelta: boolean
          gasolina_precio_km: number | null
          gasolina_preset: "ivaj_0_12" | "min_0_18" | "max_0_20" | "estandar_0_26" | "personalizado" | null
          categoria_id_sugerida: string | null
          notas: string | null
          movimiento_id: string | null
          creado_por: string | null
          creado_en: string
          actualizado_en: string
        }
        Insert: {
          id?: string
          delegacion_id: string
          contacto_id: string
          concepto: string
          descripcion?: string | null
          importe: number
          moneda?: string
          estado?: "borrador" | "pendiente" | "pagado" | "cancelado"
          tipo_calculo?: "manual" | "gasolina_tickets" | "gasolina_km" | "gasolina_avanzado"
          gasolina_km_un_trayecto?: number | null
          gasolina_ida_vuelta?: boolean
          gasolina_precio_km?: number | null
          gasolina_preset?: "ivaj_0_12" | "min_0_18" | "max_0_20" | "estandar_0_26" | "personalizado" | null
          categoria_id_sugerida?: string | null
          notas?: string | null
          movimiento_id?: string | null
          creado_por?: string | null
          creado_en?: string
          actualizado_en?: string
        }
        Update: {
          id?: string
          delegacion_id?: string
          contacto_id?: string
          concepto?: string
          descripcion?: string | null
          importe?: number
          moneda?: string
          estado?: "borrador" | "pendiente" | "pagado" | "cancelado"
          tipo_calculo?: "manual" | "gasolina_tickets" | "gasolina_km" | "gasolina_avanzado"
          gasolina_km_un_trayecto?: number | null
          gasolina_ida_vuelta?: boolean
          gasolina_precio_km?: number | null
          gasolina_preset?: "ivaj_0_12" | "min_0_18" | "max_0_20" | "estandar_0_26" | "personalizado" | null
          categoria_id_sugerida?: string | null
          notas?: string | null
          movimiento_id?: string | null
          creado_por?: string | null
          creado_en?: string
          actualizado_en?: string
        }
      }
      categoria: {
        Row: {
          color: string
          id: string
          organizacion_id: string
          delegacion_id: string | null
          nombre: string
          tipo: string
          emoji: string | null
          orden: number
          categoria_padre_id: string | null
          creado_en: string
          es_global: boolean
          esta_activa: boolean
        }
        Insert: {
          id?: string
          organizacion_id: string
          delegacion_id?: string | null
          nombre: string
          tipo: string
          emoji?: string | null
          orden?: number
          categoria_padre_id?: string | null
          creado_en?: string
          es_global?: boolean
          esta_activa?: boolean
        }
        Update: {
          id?: string
          organizacion_id?: string
          delegacion_id?: string | null
          nombre?: string
          tipo?: string
          emoji?: string | null
          orden?: number
          categoria_padre_id?: string | null
          creado_en?: string
          es_global?: boolean
          esta_activa?: boolean
        }
      }
      categoria_orden_delegacion: {
        Row: {
          delegacion_id: string
          categoria_id: string
          orden: number
          creado_en: string
          actualizado_en: string
          esta_activa: boolean
        }
        Insert: {
          delegacion_id: string
          categoria_id: string
          orden: number
          creado_en?: string
          actualizado_en?: string
          esta_activa?: boolean
        }
        Update: {
          delegacion_id?: string
          categoria_id?: string
          orden?: number
          creado_en?: string
          actualizado_en?: string
          esta_activa?: boolean
        }
      }
      membresia: {
        Row: {
          usuario_id: string
          delegacion_id: string
          rol: string
        }
        Insert: {
          usuario_id: string
          delegacion_id: string
          rol: string
        }
        Update: {
          usuario_id?: string
          delegacion_id?: string
          rol?: string
        }
      }
      perfil: {
        Row: {
          usuario_id: string
          nombre_completo: string
          creado_en: string
        }
        Insert: {
          usuario_id: string
          nombre_completo: string
          creado_en?: string
        }
        Update: {
          usuario_id?: string
          nombre_completo?: string
          creado_en?: string
        }
      }
      movimiento_archivo: {
        Row: {
          id: string
          movimiento_id: string
          nombre_original: string
          nombre_archivo: string
          tipo_mime: string
          tamaño_bytes: number
          bucket: string
          path_storage: string
          url_publica: string
          es_factura: boolean
          descripcion: string | null
          subido_por: string
          subido_en: string
        }
        Insert: {
          id?: string
          movimiento_id: string
          nombre_original: string
          nombre_archivo: string
          tipo_mime: string
          tamaño_bytes: number
          bucket: string
          path_storage: string
          url_publica: string
          es_factura?: boolean
          descripcion?: string | null
          subido_por: string
          subido_en?: string
        }
        Update: {
          id?: string
          movimiento_id?: string
          nombre_original?: string
          nombre_archivo?: string
          tipo_mime?: string
          tamaño_bytes?: number
          bucket?: string
          path_storage?: string
          url_publica?: string
          es_factura?: boolean
          descripcion?: string | null
          subido_por?: string
          subido_en?: string
        }
      }
      banco_conexion: {
        Row: {
          id: string
          delegacion_id: string
          proveedor: string
          aspsp_name: string
          aspsp_country: string
          psu_type: string
          authorization_id: string | null
          session_id: string | null
          psu_id_hash: string | null
          consent_valid_until: string
          estado: "pendiente" | "autorizada" | "expirada" | "revocada" | "error"
          ultimo_error: string | null
          creado_por: string
          creado_en: string
          actualizado_en: string
        }
        Insert: {
          id?: string
          delegacion_id: string
          proveedor?: string
          aspsp_name: string
          aspsp_country: string
          psu_type?: string
          authorization_id?: string | null
          session_id?: string | null
          psu_id_hash?: string | null
          consent_valid_until: string
          estado?: "pendiente" | "autorizada" | "expirada" | "revocada" | "error"
          ultimo_error?: string | null
          creado_por: string
          creado_en?: string
          actualizado_en?: string
        }
        Update: {
          id?: string
          delegacion_id?: string
          proveedor?: string
          aspsp_name?: string
          aspsp_country?: string
          psu_type?: string
          authorization_id?: string | null
          session_id?: string | null
          psu_id_hash?: string | null
          consent_valid_until?: string
          estado?: "pendiente" | "autorizada" | "expirada" | "revocada" | "error"
          ultimo_error?: string | null
          creado_por?: string
          creado_en?: string
          actualizado_en?: string
        }
      }
      banco_sync_log: {
        Row: {
          id: string
          cuenta_id: string | null
          banco_conexion_id: string | null
          trigger: "cron" | "manual"
          iniciado_por: string | null
          started_at: string
          finished_at: string | null
          duracion_ms: number | null
          date_from: string | null
          date_to: string | null
          transacciones_recibidas: number
          transacciones_insertadas: number
          transacciones_duplicadas: number
          transacciones_error: number
          estado: "en_curso" | "ok" | "error" | "parcial"
          error_mensaje: string | null
          log: unknown
        }
        Insert: {
          id?: string
          cuenta_id?: string | null
          banco_conexion_id?: string | null
          trigger: "cron" | "manual"
          iniciado_por?: string | null
          started_at?: string
          finished_at?: string | null
          duracion_ms?: number | null
          date_from?: string | null
          date_to?: string | null
          transacciones_recibidas?: number
          transacciones_insertadas?: number
          transacciones_duplicadas?: number
          transacciones_error?: number
          estado?: "en_curso" | "ok" | "error" | "parcial"
          error_mensaje?: string | null
          log?: unknown
        }
        Update: {
          id?: string
          cuenta_id?: string | null
          banco_conexion_id?: string | null
          trigger?: "cron" | "manual"
          iniciado_por?: string | null
          started_at?: string
          finished_at?: string | null
          duracion_ms?: number | null
          date_from?: string | null
          date_to?: string | null
          transacciones_recibidas?: number
          transacciones_insertadas?: number
          transacciones_duplicadas?: number
          transacciones_error?: number
          estado?: "en_curso" | "ok" | "error" | "parcial"
          error_mensaje?: string | null
          log?: unknown
        }
      }
      propuesta_mejora: {
        Row: {
          id: string
          titulo: string
          descripcion: string
          impacto: string | null
          tipo: "idea" | "error"
          estado:
          | "nueva_idea"
          | "en_estudio"
          | "lo_haremos"
          | "en_desarrollo"
          | "hechisimo"
          | "error_detectado"
          | "resolviendo"
          | "resuelto"
          creado_por: string
          creado_por_nombre: string | null
          creado_por_email: string | null
          creado_en: string
          actualizado_en: string | null
        }
        Insert: {
          id?: string
          titulo: string
          descripcion: string
          impacto?: string | null
          tipo?: "idea" | "error"
          estado?:
          | "nueva_idea"
          | "en_estudio"
          | "lo_haremos"
          | "en_desarrollo"
          | "hechisimo"
          | "error_detectado"
          | "resolviendo"
          | "resuelto"
          creado_por: string
          creado_por_nombre?: string | null
          creado_por_email?: string | null
          creado_en?: string
          actualizado_en?: string | null
        }
        Update: {
          id?: string
          titulo?: string
          descripcion?: string
          impacto?: string | null
          tipo?: "idea" | "error"
          estado?:
          | "nueva_idea"
          | "en_estudio"
          | "lo_haremos"
          | "en_desarrollo"
          | "hechisimo"
          | "error_detectado"
          | "resolviendo"
          | "resuelto"
          creado_por?: string
          creado_por_nombre?: string | null
          creado_por_email?: string | null
          creado_en?: string
          actualizado_en?: string | null
        }
      }
      propuesta_mejora_comentario: {
        Row: {
          id: string
          propuesta_id: string
          contenido: string
          creado_por: string
          creado_por_nombre: string | null
          creado_por_email: string | null
          creado_en: string
        }
        Insert: {
          id?: string
          propuesta_id: string
          contenido: string
          creado_por: string
          creado_por_nombre?: string | null
          creado_por_email?: string | null
          creado_en?: string
        }
        Update: {
          id?: string
          propuesta_id?: string
          contenido?: string
          creado_por?: string
          creado_por_nombre?: string | null
          creado_por_email?: string | null
          creado_en?: string
        }
      }
      propuesta_mejora_voto: {
        Row: {
          id: string
          propuesta_id: string
          usuario_id: string
          creado_en: string
        }
        Insert: {
          id?: string
          propuesta_id: string
          usuario_id: string
          creado_en?: string
        }
        Update: {
          id?: string
          propuesta_id?: string
          usuario_id?: string
          creado_en?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

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
export type Contacto = Database["public"]["Tables"]["contacto"]["Row"]
export type ContactoInsert = Database["public"]["Tables"]["contacto"]["Insert"]
export type ContactoUpdate = Database["public"]["Tables"]["contacto"]["Update"]
export type ContactoTipo = Contacto["tipo"]

export const CONTACTO_TIPOS: readonly ContactoTipo[] = ["proveedor", "persona_mcm", "destinatario_mcm"] as const

export type ContactoConCategoriaPredeterminada = Contacto & {
  categoria_predeterminada?: Pick<Categoria, "id" | "nombre" | "emoji" | "color"> | null
}

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
