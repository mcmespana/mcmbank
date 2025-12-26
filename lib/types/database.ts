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
          adjunto_principal_url: string | null
          creado_por: string
          creado_en: string
          concepto_hash: string | null
          source: string | null
          external_id: string | null
          external_raw: any | null
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
          adjunto_principal_url?: string | null
          creado_por: string
          creado_en?: string
          concepto_hash?: string | null
          source?: string | null
          external_id?: string | null
          external_raw?: any | null
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
          adjunto_principal_url?: string | null
          creado_por?: string
          creado_en?: string
          concepto_hash?: string | null
          source?: string | null
          external_id?: string | null
          external_raw?: any | null
        }
      }
      enablebanking_consent: {
        Row: {
          id: string
          organizacion_id: string
          aspsp_name: string
          aspsp_country: string
          aspsp_bic: string | null
          psu_type: string
          authorization_id: string
          state: string
          redirect_url: string
          status: string
          session_id: string | null
          authorized_at: string | null
          error_code: string | null
          error_description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organizacion_id: string
          aspsp_name: string
          aspsp_country: string
          aspsp_bic?: string | null
          psu_type: string
          authorization_id: string
          state: string
          redirect_url: string
          status?: string
          session_id?: string | null
          authorized_at?: string | null
          error_code?: string | null
          error_description?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          organizacion_id?: string
          aspsp_name?: string
          aspsp_country?: string
          aspsp_bic?: string | null
          psu_type?: string
          authorization_id?: string
          state?: string
          redirect_url?: string
          status?: string
          session_id?: string | null
          authorized_at?: string | null
          error_code?: string | null
          error_description?: string | null
          created_at?: string
        }
      }
      enablebanking_account: {
        Row: {
          id: string
          consent_id: string
          provider_account_id: string
          identification_hash: string | null
          iban: string | null
          currency: string | null
          owner_name: string | null
          raw_payload: any | null
          created_at: string
        }
        Insert: {
          id?: string
          consent_id: string
          provider_account_id: string
          identification_hash?: string | null
          iban?: string | null
          currency?: string | null
          owner_name?: string | null
          raw_payload?: any | null
          created_at?: string
        }
        Update: {
          id?: string
          consent_id?: string
          provider_account_id?: string
          identification_hash?: string | null
          iban?: string | null
          currency?: string | null
          owner_name?: string | null
          raw_payload?: any | null
          created_at?: string
        }
      }
      enablebanking_link: {
        Row: {
          id: string
          cuenta_id: string
          enablebanking_account_id: string
          status: string
          sync_start_date: string | null
          last_sync_at: string | null
          last_sync_from: string | null
          last_sync_to: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          cuenta_id: string
          enablebanking_account_id: string
          status?: string
          sync_start_date?: string | null
          last_sync_at?: string | null
          last_sync_from?: string | null
          last_sync_to?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          cuenta_id?: string
          enablebanking_account_id?: string
          status?: string
          sync_start_date?: string | null
          last_sync_at?: string | null
          last_sync_from?: string | null
          last_sync_to?: string | null
          created_at?: string
          updated_at?: string
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
export type EnableBankingConsent = Database["public"]["Tables"]["enablebanking_consent"]["Row"]
export type EnableBankingAccount = Database["public"]["Tables"]["enablebanking_account"]["Row"]
export type EnableBankingLink = Database["public"]["Tables"]["enablebanking_link"]["Row"]

// Extended types with relations
export type MovimientoConRelaciones = Movimiento & {
  cuenta: Cuenta
  categoria?: Categoria
  archivos?: MovimientoArchivo[] // Lazy loaded - not included in default queries
}

export type CuentaConDelegacion = Cuenta & {
  delegacion: Delegacion
}
