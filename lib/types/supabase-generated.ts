export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      archivo_adjunto: {
        Row: {
          bucket: string
          delegacion_id: string
          descripcion: string | null
          entidad: string
          entidad_id: string
          es_factura: boolean
          id: string
          nombre_archivo: string
          nombre_original: string
          path_storage: string
          subido_en: string
          subido_por: string
          tamano_bytes: number
          tipo_mime: string
          url_publica: string
        }
        Insert: {
          bucket: string
          delegacion_id: string
          descripcion?: string | null
          entidad: string
          entidad_id: string
          es_factura?: boolean
          id?: string
          nombre_archivo: string
          nombre_original: string
          path_storage: string
          subido_en?: string
          subido_por: string
          tamano_bytes: number
          tipo_mime: string
          url_publica: string
        }
        Update: {
          bucket?: string
          delegacion_id?: string
          descripcion?: string | null
          entidad?: string
          entidad_id?: string
          es_factura?: boolean
          id?: string
          nombre_archivo?: string
          nombre_original?: string
          path_storage?: string
          subido_en?: string
          subido_por?: string
          tamano_bytes?: number
          tipo_mime?: string
          url_publica?: string
        }
        Relationships: [
          {
            foreignKeyName: "archivo_adjunto_delegacion_id_fkey"
            columns: ["delegacion_id"]
            isOneToOne: false
            referencedRelation: "delegacion"
            referencedColumns: ["id"]
          },
        ]
      }
      banco_conexion: {
        Row: {
          actualizado_en: string
          aspsp_country: string
          aspsp_name: string
          authorization_id: string | null
          consent_valid_until: string
          creado_en: string
          creado_por: string
          delegacion_id: string
          estado: string
          id: string
          proveedor: string
          psu_id_hash: string | null
          psu_type: string
          session_id: string | null
          ultimo_error: string | null
        }
        Insert: {
          actualizado_en?: string
          aspsp_country: string
          aspsp_name: string
          authorization_id?: string | null
          consent_valid_until: string
          creado_en?: string
          creado_por: string
          delegacion_id: string
          estado?: string
          id?: string
          proveedor?: string
          psu_id_hash?: string | null
          psu_type?: string
          session_id?: string | null
          ultimo_error?: string | null
        }
        Update: {
          actualizado_en?: string
          aspsp_country?: string
          aspsp_name?: string
          authorization_id?: string | null
          consent_valid_until?: string
          creado_en?: string
          creado_por?: string
          delegacion_id?: string
          estado?: string
          id?: string
          proveedor?: string
          psu_id_hash?: string | null
          psu_type?: string
          session_id?: string | null
          ultimo_error?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "banco_conexion_delegacion_id_fkey"
            columns: ["delegacion_id"]
            isOneToOne: false
            referencedRelation: "delegacion"
            referencedColumns: ["id"]
          },
        ]
      }
      banco_sync_log: {
        Row: {
          banco_conexion_id: string | null
          cuenta_id: string | null
          date_from: string | null
          date_to: string | null
          duracion_ms: number | null
          error_mensaje: string | null
          estado: string
          finished_at: string | null
          id: string
          iniciado_por: string | null
          log: Json
          started_at: string
          transacciones_duplicadas: number
          transacciones_error: number
          transacciones_insertadas: number
          transacciones_recibidas: number
          trigger: string
        }
        Insert: {
          banco_conexion_id?: string | null
          cuenta_id?: string | null
          date_from?: string | null
          date_to?: string | null
          duracion_ms?: number | null
          error_mensaje?: string | null
          estado?: string
          finished_at?: string | null
          id?: string
          iniciado_por?: string | null
          log?: Json
          started_at?: string
          transacciones_duplicadas?: number
          transacciones_error?: number
          transacciones_insertadas?: number
          transacciones_recibidas?: number
          trigger: string
        }
        Update: {
          banco_conexion_id?: string | null
          cuenta_id?: string | null
          date_from?: string | null
          date_to?: string | null
          duracion_ms?: number | null
          error_mensaje?: string | null
          estado?: string
          finished_at?: string | null
          id?: string
          iniciado_por?: string | null
          log?: Json
          started_at?: string
          transacciones_duplicadas?: number
          transacciones_error?: number
          transacciones_insertadas?: number
          transacciones_recibidas?: number
          trigger?: string
        }
        Relationships: [
          {
            foreignKeyName: "banco_sync_log_banco_conexion_id_fkey"
            columns: ["banco_conexion_id"]
            isOneToOne: false
            referencedRelation: "banco_conexion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "banco_sync_log_cuenta_id_fkey"
            columns: ["cuenta_id"]
            isOneToOne: false
            referencedRelation: "cuenta"
            referencedColumns: ["id"]
          },
        ]
      }
      categoria: {
        Row: {
          activa: boolean
          categoria_padre_id: string | null
          color: string | null
          creado_en: string
          delegacion_id: string | null
          emoji: string | null
          es_global: boolean
          esta_activa: boolean
          id: string
          nombre: string
          orden: number
          organizacion_id: string
          tipo: Database["public"]["Enums"]["tipo_categoria"]
        }
        Insert: {
          activa?: boolean
          categoria_padre_id?: string | null
          color?: string | null
          creado_en?: string
          delegacion_id?: string | null
          emoji?: string | null
          es_global?: boolean
          esta_activa?: boolean
          id?: string
          nombre: string
          orden?: number
          organizacion_id: string
          tipo?: Database["public"]["Enums"]["tipo_categoria"]
        }
        Update: {
          activa?: boolean
          categoria_padre_id?: string | null
          color?: string | null
          creado_en?: string
          delegacion_id?: string | null
          emoji?: string | null
          es_global?: boolean
          esta_activa?: boolean
          id?: string
          nombre?: string
          orden?: number
          organizacion_id?: string
          tipo?: Database["public"]["Enums"]["tipo_categoria"]
        }
        Relationships: [
          {
            foreignKeyName: "categoria_categoria_padre_id_fkey"
            columns: ["categoria_padre_id"]
            isOneToOne: false
            referencedRelation: "categoria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categoria_delegacion_id_fkey"
            columns: ["delegacion_id"]
            isOneToOne: false
            referencedRelation: "delegacion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categoria_organizacion_id_fkey"
            columns: ["organizacion_id"]
            isOneToOne: false
            referencedRelation: "organizacion"
            referencedColumns: ["id"]
          },
        ]
      }
      categoria_orden_delegacion: {
        Row: {
          actualizado_en: string
          categoria_id: string
          creado_en: string
          delegacion_id: string
          esta_activa: boolean
          orden: number
        }
        Insert: {
          actualizado_en?: string
          categoria_id: string
          creado_en?: string
          delegacion_id: string
          esta_activa?: boolean
          orden: number
        }
        Update: {
          actualizado_en?: string
          categoria_id?: string
          creado_en?: string
          delegacion_id?: string
          esta_activa?: boolean
          orden?: number
        }
        Relationships: [
          {
            foreignKeyName: "categoria_orden_delegacion_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categoria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categoria_orden_delegacion_delegacion_id_fkey"
            columns: ["delegacion_id"]
            isOneToOne: false
            referencedRelation: "delegacion"
            referencedColumns: ["id"]
          },
        ]
      }
      contacto: {
        Row: {
          actualizado_en: string
          archivado: boolean
          categoria_id_predeterminada: string | null
          ciudad: string | null
          codigo_postal: string | null
          color: string | null
          creado_en: string
          creado_por: string | null
          delegacion_id: string | null
          direccion: string | null
          email: string | null
          emoji: string | null
          es_global: boolean
          iban: string | null
          id: string
          identificador_fiscal: string | null
          nombre: string
          notas: string | null
          telefono: string | null
          tipo: string
        }
        Insert: {
          actualizado_en?: string
          archivado?: boolean
          categoria_id_predeterminada?: string | null
          ciudad?: string | null
          codigo_postal?: string | null
          color?: string | null
          creado_en?: string
          creado_por?: string | null
          delegacion_id?: string | null
          direccion?: string | null
          email?: string | null
          emoji?: string | null
          es_global?: boolean
          iban?: string | null
          id?: string
          identificador_fiscal?: string | null
          nombre: string
          notas?: string | null
          telefono?: string | null
          tipo: string
        }
        Update: {
          actualizado_en?: string
          archivado?: boolean
          categoria_id_predeterminada?: string | null
          ciudad?: string | null
          codigo_postal?: string | null
          color?: string | null
          creado_en?: string
          creado_por?: string | null
          delegacion_id?: string | null
          direccion?: string | null
          email?: string | null
          emoji?: string | null
          es_global?: boolean
          iban?: string | null
          id?: string
          identificador_fiscal?: string | null
          nombre?: string
          notas?: string | null
          telefono?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacto_categoria_id_predeterminada_fkey"
            columns: ["categoria_id_predeterminada"]
            isOneToOne: false
            referencedRelation: "categoria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacto_delegacion_id_fkey"
            columns: ["delegacion_id"]
            isOneToOne: false
            referencedRelation: "delegacion"
            referencedColumns: ["id"]
          },
        ]
      }
      cuenta: {
        Row: {
          activa: boolean
          banco_conexion_id: string | null
          banco_nombre: string | null
          color: string | null
          creado_en: string
          delegacion_id: string
          descripcion: string | null
          external_account_hash: string | null
          external_account_uid: string | null
          iban: string | null
          id: string
          informacion: string | null
          last_sync_at: string | null
          last_sync_error: string | null
          last_sync_status: string | null
          nombre: string
          origen: Database["public"]["Enums"]["origen_cuenta"]
          personas_autorizadas: string | null
          sync_desde_fecha: string | null
          sync_enabled: boolean
          tipo: Database["public"]["Enums"]["tipo_cuenta"]
        }
        Insert: {
          activa?: boolean
          banco_conexion_id?: string | null
          banco_nombre?: string | null
          color?: string | null
          creado_en?: string
          delegacion_id: string
          descripcion?: string | null
          external_account_hash?: string | null
          external_account_uid?: string | null
          iban?: string | null
          id?: string
          informacion?: string | null
          last_sync_at?: string | null
          last_sync_error?: string | null
          last_sync_status?: string | null
          nombre: string
          origen: Database["public"]["Enums"]["origen_cuenta"]
          personas_autorizadas?: string | null
          sync_desde_fecha?: string | null
          sync_enabled?: boolean
          tipo: Database["public"]["Enums"]["tipo_cuenta"]
        }
        Update: {
          activa?: boolean
          banco_conexion_id?: string | null
          banco_nombre?: string | null
          color?: string | null
          creado_en?: string
          delegacion_id?: string
          descripcion?: string | null
          external_account_hash?: string | null
          external_account_uid?: string | null
          iban?: string | null
          id?: string
          informacion?: string | null
          last_sync_at?: string | null
          last_sync_error?: string | null
          last_sync_status?: string | null
          nombre?: string
          origen?: Database["public"]["Enums"]["origen_cuenta"]
          personas_autorizadas?: string | null
          sync_desde_fecha?: string | null
          sync_enabled?: boolean
          tipo?: Database["public"]["Enums"]["tipo_cuenta"]
        }
        Relationships: [
          {
            foreignKeyName: "cuenta_banco_conexion_id_fkey"
            columns: ["banco_conexion_id"]
            isOneToOne: false
            referencedRelation: "banco_conexion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cuenta_delegacion_id_fkey"
            columns: ["delegacion_id"]
            isOneToOne: false
            referencedRelation: "delegacion"
            referencedColumns: ["id"]
          },
        ]
      }
      delegacion: {
        Row: {
          codigo: string | null
          creado_en: string
          id: string
          nombre: string
          organizacion_id: string
        }
        Insert: {
          codigo?: string | null
          creado_en?: string
          id?: string
          nombre: string
          organizacion_id: string
        }
        Update: {
          codigo?: string | null
          creado_en?: string
          id?: string
          nombre?: string
          organizacion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delegacion_organizacion_id_fkey"
            columns: ["organizacion_id"]
            isOneToOne: false
            referencedRelation: "organizacion"
            referencedColumns: ["id"]
          },
        ]
      }
      enablebanking_account: {
        Row: {
          consent_id: string
          created_at: string
          currency: string | null
          iban: string | null
          id: string
          identification_hash: string | null
          owner_name: string | null
          provider_account_id: string
          raw_payload: Json | null
        }
        Insert: {
          consent_id: string
          created_at?: string
          currency?: string | null
          iban?: string | null
          id?: string
          identification_hash?: string | null
          owner_name?: string | null
          provider_account_id: string
          raw_payload?: Json | null
        }
        Update: {
          consent_id?: string
          created_at?: string
          currency?: string | null
          iban?: string | null
          id?: string
          identification_hash?: string | null
          owner_name?: string | null
          provider_account_id?: string
          raw_payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "enablebanking_account_consent_id_fkey"
            columns: ["consent_id"]
            isOneToOne: false
            referencedRelation: "enablebanking_consent"
            referencedColumns: ["id"]
          },
        ]
      }
      enablebanking_consent: {
        Row: {
          aspsp_bic: string | null
          aspsp_country: string
          aspsp_name: string
          authorization_id: string
          authorized_at: string | null
          created_at: string
          error_code: string | null
          error_description: string | null
          id: string
          organizacion_id: string
          psu_type: string
          redirect_url: string
          session_id: string | null
          state: string
          status: string
        }
        Insert: {
          aspsp_bic?: string | null
          aspsp_country: string
          aspsp_name: string
          authorization_id: string
          authorized_at?: string | null
          created_at?: string
          error_code?: string | null
          error_description?: string | null
          id?: string
          organizacion_id: string
          psu_type: string
          redirect_url: string
          session_id?: string | null
          state: string
          status?: string
        }
        Update: {
          aspsp_bic?: string | null
          aspsp_country?: string
          aspsp_name?: string
          authorization_id?: string
          authorized_at?: string | null
          created_at?: string
          error_code?: string | null
          error_description?: string | null
          id?: string
          organizacion_id?: string
          psu_type?: string
          redirect_url?: string
          session_id?: string | null
          state?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "enablebanking_consent_organizacion_id_fkey"
            columns: ["organizacion_id"]
            isOneToOne: false
            referencedRelation: "organizacion"
            referencedColumns: ["id"]
          },
        ]
      }
      enablebanking_link: {
        Row: {
          created_at: string
          cuenta_id: string
          enablebanking_account_id: string
          id: string
          last_sync_at: string | null
          last_sync_from: string | null
          last_sync_to: string | null
          status: string
          sync_start_date: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          cuenta_id: string
          enablebanking_account_id: string
          id?: string
          last_sync_at?: string | null
          last_sync_from?: string | null
          last_sync_to?: string | null
          status?: string
          sync_start_date?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          cuenta_id?: string
          enablebanking_account_id?: string
          id?: string
          last_sync_at?: string | null
          last_sync_from?: string | null
          last_sync_to?: string | null
          status?: string
          sync_start_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enablebanking_link_cuenta_id_fkey"
            columns: ["cuenta_id"]
            isOneToOne: false
            referencedRelation: "cuenta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enablebanking_link_enablebanking_account_id_fkey"
            columns: ["enablebanking_account_id"]
            isOneToOne: false
            referencedRelation: "enablebanking_account"
            referencedColumns: ["id"]
          },
        ]
      }
      membresia: {
        Row: {
          delegacion_id: string
          rol: Database["public"]["Enums"]["rol_usuario"]
          usuario_id: string
        }
        Insert: {
          delegacion_id: string
          rol: Database["public"]["Enums"]["rol_usuario"]
          usuario_id: string
        }
        Update: {
          delegacion_id?: string
          rol?: Database["public"]["Enums"]["rol_usuario"]
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "membresia_delegacion_id_fkey"
            columns: ["delegacion_id"]
            isOneToOne: false
            referencedRelation: "delegacion"
            referencedColumns: ["id"]
          },
        ]
      }
      movimiento: {
        Row: {
          adjunto_principal_url: string | null
          booking_date: string | null
          categoria_id: string | null
          concepto: string
          concepto_hash: string | null
          contacto_id: string | null
          contraparte: string | null
          creado_en: string
          creado_por: string
          cuenta_id: string
          delegacion_id: string | null
          descripcion: string | null
          external_id: string | null
          external_id_source: string | null
          external_raw: Json | null
          fecha: string
          id: string
          ignorado: boolean
          importe: number
          metodo: string | null
          notas: string | null
          origen_sync: string | null
          pago_mcm_id: string | null
          source: string | null
          texto_extra_1: string | null
          texto_extra_2: string | null
          value_date: string | null
        }
        Insert: {
          adjunto_principal_url?: string | null
          booking_date?: string | null
          categoria_id?: string | null
          concepto: string
          concepto_hash?: string | null
          contacto_id?: string | null
          contraparte?: string | null
          creado_en?: string
          creado_por: string
          cuenta_id: string
          delegacion_id?: string | null
          descripcion?: string | null
          external_id?: string | null
          external_id_source?: string | null
          external_raw?: Json | null
          fecha: string
          id?: string
          ignorado?: boolean
          importe: number
          metodo?: string | null
          notas?: string | null
          origen_sync?: string | null
          pago_mcm_id?: string | null
          source?: string | null
          texto_extra_1?: string | null
          texto_extra_2?: string | null
          value_date?: string | null
        }
        Update: {
          adjunto_principal_url?: string | null
          booking_date?: string | null
          categoria_id?: string | null
          concepto?: string
          concepto_hash?: string | null
          contacto_id?: string | null
          contraparte?: string | null
          creado_en?: string
          creado_por?: string
          cuenta_id?: string
          delegacion_id?: string | null
          descripcion?: string | null
          external_id?: string | null
          external_id_source?: string | null
          external_raw?: Json | null
          fecha?: string
          id?: string
          ignorado?: boolean
          importe?: number
          metodo?: string | null
          notas?: string | null
          origen_sync?: string | null
          pago_mcm_id?: string | null
          source?: string | null
          texto_extra_1?: string | null
          texto_extra_2?: string | null
          value_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "movimiento_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categoria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimiento_contacto_id_fkey"
            columns: ["contacto_id"]
            isOneToOne: false
            referencedRelation: "contacto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimiento_cuenta_deleg_fk"
            columns: ["cuenta_id", "delegacion_id"]
            isOneToOne: false
            referencedRelation: "cuenta"
            referencedColumns: ["id", "delegacion_id"]
          },
          {
            foreignKeyName: "movimiento_cuenta_id_fkey"
            columns: ["cuenta_id"]
            isOneToOne: false
            referencedRelation: "cuenta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimiento_pago_mcm_id_fkey"
            columns: ["pago_mcm_id"]
            isOneToOne: true
            referencedRelation: "pago_mcm"
            referencedColumns: ["id"]
          },
        ]
      }
      movimiento_archivo: {
        Row: {
          bucket: string
          descripcion: string | null
          es_factura: boolean
          id: string
          movimiento_id: string
          nombre_archivo: string
          nombre_original: string
          path_storage: string
          subido_en: string | null
          subido_por: string
          tamaño_bytes: number
          tipo_mime: string
          url_publica: string
        }
        Insert: {
          bucket: string
          descripcion?: string | null
          es_factura?: boolean
          id?: string
          movimiento_id: string
          nombre_archivo: string
          nombre_original: string
          path_storage: string
          subido_en?: string | null
          subido_por: string
          tamaño_bytes: number
          tipo_mime: string
          url_publica: string
        }
        Update: {
          bucket?: string
          descripcion?: string | null
          es_factura?: boolean
          id?: string
          movimiento_id?: string
          nombre_archivo?: string
          nombre_original?: string
          path_storage?: string
          subido_en?: string | null
          subido_por?: string
          tamaño_bytes?: number
          tipo_mime?: string
          url_publica?: string
        }
        Relationships: [
          {
            foreignKeyName: "movimiento_archivo_movimiento_id_fkey"
            columns: ["movimiento_id"]
            isOneToOne: false
            referencedRelation: "movimiento"
            referencedColumns: ["id"]
          },
        ]
      }
      organizacion: {
        Row: {
          codigo: string | null
          creado_en: string
          id: string
          nombre: string
        }
        Insert: {
          codigo?: string | null
          creado_en?: string
          id?: string
          nombre: string
        }
        Update: {
          codigo?: string | null
          creado_en?: string
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      pago_mcm: {
        Row: {
          actualizado_en: string
          categoria_id_sugerida: string | null
          concepto: string
          contacto_id: string
          creado_en: string
          creado_por: string | null
          delegacion_id: string
          descripcion: string | null
          estado: string
          gasolina_ida_vuelta: boolean
          gasolina_km_un_trayecto: number | null
          gasolina_precio_km: number | null
          gasolina_preset: string | null
          id: string
          importe: number
          moneda: string
          movimiento_id: string | null
          notas: string | null
          tipo_calculo: string
        }
        Insert: {
          actualizado_en?: string
          categoria_id_sugerida?: string | null
          concepto: string
          contacto_id: string
          creado_en?: string
          creado_por?: string | null
          delegacion_id: string
          descripcion?: string | null
          estado?: string
          gasolina_ida_vuelta?: boolean
          gasolina_km_un_trayecto?: number | null
          gasolina_precio_km?: number | null
          gasolina_preset?: string | null
          id?: string
          importe: number
          moneda?: string
          movimiento_id?: string | null
          notas?: string | null
          tipo_calculo?: string
        }
        Update: {
          actualizado_en?: string
          categoria_id_sugerida?: string | null
          concepto?: string
          contacto_id?: string
          creado_en?: string
          creado_por?: string | null
          delegacion_id?: string
          descripcion?: string | null
          estado?: string
          gasolina_ida_vuelta?: boolean
          gasolina_km_un_trayecto?: number | null
          gasolina_precio_km?: number | null
          gasolina_preset?: string | null
          id?: string
          importe?: number
          moneda?: string
          movimiento_id?: string | null
          notas?: string | null
          tipo_calculo?: string
        }
        Relationships: [
          {
            foreignKeyName: "pago_mcm_categoria_id_sugerida_fkey"
            columns: ["categoria_id_sugerida"]
            isOneToOne: false
            referencedRelation: "categoria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pago_mcm_contacto_id_fkey"
            columns: ["contacto_id"]
            isOneToOne: false
            referencedRelation: "contacto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pago_mcm_delegacion_id_fkey"
            columns: ["delegacion_id"]
            isOneToOne: false
            referencedRelation: "delegacion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pago_mcm_movimiento_id_fkey"
            columns: ["movimiento_id"]
            isOneToOne: true
            referencedRelation: "movimiento"
            referencedColumns: ["id"]
          },
        ]
      }
      perfil: {
        Row: {
          creado_en: string
          nombre_completo: string | null
          usuario_id: string
        }
        Insert: {
          creado_en?: string
          nombre_completo?: string | null
          usuario_id: string
        }
        Update: {
          creado_en?: string
          nombre_completo?: string | null
          usuario_id?: string
        }
        Relationships: []
      }
      propuesta_mejora: {
        Row: {
          actualizado_en: string | null
          creado_en: string
          creado_por: string
          creado_por_email: string | null
          creado_por_nombre: string | null
          descripcion: string
          estado: string
          id: string
          impacto: string | null
          tipo: string
          titulo: string
        }
        Insert: {
          actualizado_en?: string | null
          creado_en?: string
          creado_por: string
          creado_por_email?: string | null
          creado_por_nombre?: string | null
          descripcion: string
          estado?: string
          id?: string
          impacto?: string | null
          tipo?: string
          titulo: string
        }
        Update: {
          actualizado_en?: string | null
          creado_en?: string
          creado_por?: string
          creado_por_email?: string | null
          creado_por_nombre?: string | null
          descripcion?: string
          estado?: string
          id?: string
          impacto?: string | null
          tipo?: string
          titulo?: string
        }
        Relationships: []
      }
      propuesta_mejora_comentario: {
        Row: {
          contenido: string
          creado_en: string
          creado_por: string
          creado_por_email: string | null
          creado_por_nombre: string | null
          id: string
          propuesta_id: string
        }
        Insert: {
          contenido: string
          creado_en?: string
          creado_por: string
          creado_por_email?: string | null
          creado_por_nombre?: string | null
          id?: string
          propuesta_id: string
        }
        Update: {
          contenido?: string
          creado_en?: string
          creado_por?: string
          creado_por_email?: string | null
          creado_por_nombre?: string | null
          id?: string
          propuesta_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "propuesta_mejora_comentario_propuesta_id_fkey"
            columns: ["propuesta_id"]
            isOneToOne: false
            referencedRelation: "propuesta_mejora"
            referencedColumns: ["id"]
          },
        ]
      }
      propuesta_mejora_voto: {
        Row: {
          creado_en: string
          id: string
          propuesta_id: string
          usuario_id: string
        }
        Insert: {
          creado_en?: string
          id?: string
          propuesta_id: string
          usuario_id: string
        }
        Update: {
          creado_en?: string
          id?: string
          propuesta_id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "propuesta_mejora_voto_propuesta_id_fkey"
            columns: ["propuesta_id"]
            isOneToOne: false
            referencedRelation: "propuesta_mejora"
            referencedColumns: ["id"]
          },
        ]
      }
      regla: {
        Row: {
          activa: boolean
          categoria_id: string
          condiciones: Json
          creada_en: string
          creada_por: string
          id: string
          nombre: string
          organizacion_id: string
          prioridad: number
        }
        Insert: {
          activa?: boolean
          categoria_id: string
          condiciones: Json
          creada_en?: string
          creada_por: string
          id?: string
          nombre: string
          organizacion_id: string
          prioridad?: number
        }
        Update: {
          activa?: boolean
          categoria_id?: string
          condiciones?: Json
          creada_en?: string
          creada_por?: string
          id?: string
          nombre?: string
          organizacion_id?: string
          prioridad?: number
        }
        Relationships: [
          {
            foreignKeyName: "regla_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categoria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regla_organizacion_id_fkey"
            columns: ["organizacion_id"]
            isOneToOne: false
            referencedRelation: "organizacion"
            referencedColumns: ["id"]
          },
        ]
      }
      z_nopausasupabase: {
        Row: {
          created_at: string
          id: number
          num: number | null
        }
        Insert: {
          created_at?: string
          id?: number
          num?: number | null
        }
        Update: {
          created_at?: string
          id?: number
          num?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_category_breakdown: {
        Args: { p_delegacion_id: string; p_desde: string; p_hasta: string }
        Returns: {
          categoria_color: string
          categoria_emoji: string
          categoria_id: string
          categoria_nombre: string
          gastos: number
          ingresos: number
        }[]
      }
      get_financial_summary: {
        Args: { p_delegacion_id: string; p_desde: string; p_hasta: string }
        Returns: {
          balance: number
          gastos: number
          ingresos: number
          sin_categoria: number
          total_movimientos: number
        }[]
      }
      get_monthly_trend: {
        Args: { p_delegacion_id: string; p_desde: string; p_hasta: string }
        Returns: {
          gastos: number
          ingresos: number
          mes: string
        }[]
      }
      is_gestor_central: { Args: never; Returns: boolean }
      trigger_bank_sync_cron: { Args: never; Returns: number }
    }
    Enums: {
      origen_cuenta: "manual" | "conectada"
      rol_usuario: "gestor_central" | "tesorero" | "solo_lectura"
      team_type: "ECE" | "ECL"
      tipo_categoria: "ingreso" | "gasto" | "mixto"
      tipo_cuenta: "banco" | "caja"
      user_role: "admin" | "super_admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      origen_cuenta: ["manual", "conectada"],
      rol_usuario: ["gestor_central", "tesorero", "solo_lectura"],
      team_type: ["ECE", "ECL"],
      tipo_categoria: ["ingreso", "gasto", "mixto"],
      tipo_cuenta: ["banco", "caja"],
      user_role: ["admin", "super_admin"],
    },
  },
} as const
