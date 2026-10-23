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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      acabados_fijos: {
        Row: {
          acabado: string
          activo: boolean
          id: string
          precio: number
          tamano: string
        }
        Insert: {
          acabado: string
          activo?: boolean
          id?: string
          precio: number
          tamano: string
        }
        Update: {
          acabado?: string
          activo?: boolean
          id?: string
          precio?: number
          tamano?: string
        }
        Relationships: []
      }
      acabados_tramos: {
        Row: {
          acabado: string
          activo: boolean
          id: string
          paginas_desde: number
          paginas_hasta: number | null
          precio: number
        }
        Insert: {
          acabado: string
          activo?: boolean
          id?: string
          paginas_desde: number
          paginas_hasta?: number | null
          precio: number
        }
        Update: {
          acabado?: string
          activo?: boolean
          id?: string
          paginas_desde?: number
          paginas_hasta?: number | null
          precio?: number
        }
        Relationships: []
      }
      anillado_rangos: {
        Row: {
          activo: boolean | null
          created_at: string | null
          hojas_max: number
          hojas_min: number
          id: string
          nombre: string
          precio: number
        }
        Insert: {
          activo?: boolean | null
          created_at?: string | null
          hojas_max: number
          hojas_min?: number
          id?: string
          nombre: string
          precio?: number
        }
        Update: {
          activo?: boolean | null
          created_at?: string | null
          hojas_max?: number
          hojas_min?: number
          id?: string
          nombre?: string
          precio?: number
        }
        Relationships: []
      }
      anillos: {
        Row: {
          activo: boolean
          capacidad_hojas: number | null
          medida_mm: number
          precio: number | null
        }
        Insert: {
          activo?: boolean
          capacidad_hojas?: number | null
          medida_mm: number
          precio?: number | null
        }
        Update: {
          activo?: boolean
          capacidad_hojas?: number | null
          medida_mm?: number
          precio?: number | null
        }
        Relationships: []
      }
      archivos_pedido: {
        Row: {
          color: boolean | null
          copias: number | null
          doble_faz: boolean | null
          estado: string | null
          google_file_id: string | null
          id: string
          impreso: boolean | null
          nombre_archivo: string
          orientacion: string | null
          paginas_por_hoja: number | null
          pedido_id: string | null
          rango_paginas: string | null
          storage_path: string | null
          subido_en: string | null
          tamano_papel: string | null
        }
        Insert: {
          color?: boolean | null
          copias?: number | null
          doble_faz?: boolean | null
          estado?: string | null
          google_file_id?: string | null
          id?: string
          impreso?: boolean | null
          nombre_archivo: string
          orientacion?: string | null
          paginas_por_hoja?: number | null
          pedido_id?: string | null
          rango_paginas?: string | null
          storage_path?: string | null
          subido_en?: string | null
          tamano_papel?: string | null
        }
        Update: {
          color?: boolean | null
          copias?: number | null
          doble_faz?: boolean | null
          estado?: string | null
          google_file_id?: string | null
          id?: string
          impreso?: boolean | null
          nombre_archivo?: string
          orientacion?: string | null
          paginas_por_hoja?: number | null
          pedido_id?: string | null
          rango_paginas?: string | null
          storage_path?: string | null
          subido_en?: string | null
          tamano_papel?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "archivos_pedido_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      asistencia: {
        Row: {
          certificado_url: string | null
          creado_en: string | null
          estado: string
          fecha: string
          hora_entrada: string | null
          hora_salida: string | null
          id: string
          notas: string | null
          usuario_id: string
        }
        Insert: {
          certificado_url?: string | null
          creado_en?: string | null
          estado?: string
          fecha?: string
          hora_entrada?: string | null
          hora_salida?: string | null
          id?: string
          notas?: string | null
          usuario_id: string
        }
        Update: {
          certificado_url?: string | null
          creado_en?: string | null
          estado?: string
          fecha?: string
          hora_entrada?: string | null
          hora_salida?: string | null
          id?: string
          notas?: string | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asistencia_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios_sistema"
            referencedColumns: ["id"]
          },
        ]
      }
      caja_jornadas: {
        Row: {
          billetes: Json
          created_at: string
          gastos: Json
          id: string
          tipo: string
          total: number
          usuario_id: string | null
          usuario_nombre: string | null
        }
        Insert: {
          billetes?: Json
          created_at?: string
          gastos?: Json
          id?: string
          tipo: string
          total?: number
          usuario_id?: string | null
          usuario_nombre?: string | null
        }
        Update: {
          billetes?: Json
          created_at?: string
          gastos?: Json
          id?: string
          tipo?: string
          total?: number
          usuario_id?: string | null
          usuario_nombre?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "caja_jornadas_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios_sistema"
            referencedColumns: ["id"]
          },
        ]
      }
      catalogo_encargos: {
        Row: {
          activo: boolean | null
          id: string
          nombre: string
          precio: number | null
        }
        Insert: {
          activo?: boolean | null
          id?: string
          nombre: string
          precio?: number | null
        }
        Update: {
          activo?: boolean | null
          id?: string
          nombre?: string
          precio?: number | null
        }
        Relationships: []
      }
      clientes: {
        Row: {
          activo: boolean | null
          cod_pais: string | null
          codigo: string
          codigo_origen: string | null
          creado_en: string | null
          duplicado_de: string | null
          grupos_dup: string[] | null
          id: string
          mail: string | null
          nombre: string
          origen_fila: number | null
          revisar: boolean | null
          revisar_motivo: string | null
          telefono: string | null
        }
        Insert: {
          activo?: boolean | null
          cod_pais?: string | null
          codigo: string
          codigo_origen?: string | null
          creado_en?: string | null
          duplicado_de?: string | null
          grupos_dup?: string[] | null
          id?: string
          mail?: string | null
          nombre: string
          origen_fila?: number | null
          revisar?: boolean | null
          revisar_motivo?: string | null
          telefono?: string | null
        }
        Update: {
          activo?: boolean | null
          cod_pais?: string | null
          codigo?: string
          codigo_origen?: string | null
          creado_en?: string | null
          duplicado_de?: string | null
          grupos_dup?: string[] | null
          id?: string
          mail?: string | null
          nombre?: string
          origen_fila?: number | null
          revisar?: boolean | null
          revisar_motivo?: string | null
          telefono?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clientes_duplicado_de_fkey"
            columns: ["duplicado_de"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clientes_duplicado_de_fkey"
            columns: ["duplicado_de"]
            isOneToOne: false
            referencedRelation: "clientes_a_revisar"
            referencedColumns: ["id"]
          },
        ]
      }
      config_proveedores: {
        Row: {
          id: string
          porcentaje: number
          precio_base: number
          proveedor: string
        }
        Insert: {
          id?: string
          porcentaje?: number
          precio_base?: number
          proveedor: string
        }
        Update: {
          id?: string
          porcentaje?: number
          precio_base?: number
          proveedor?: string
        }
        Relationships: []
      }
      configuracion: {
        Row: {
          clave: string
          created_at: string | null
          valor: string
        }
        Insert: {
          clave: string
          created_at?: string | null
          valor: string
        }
        Update: {
          clave?: string
          created_at?: string | null
          valor?: string
        }
        Relationships: []
      }
      counters: {
        Row: {
          nombre: string
          valor: number | null
        }
        Insert: {
          nombre: string
          valor?: number | null
        }
        Update: {
          nombre?: string
          valor?: number | null
        }
        Relationships: []
      }
      estados_pedido: {
        Row: {
          activo: boolean
          codigo: string
          es_final: boolean
          nombre: string
          orden: number
        }
        Insert: {
          activo?: boolean
          codigo: string
          es_final?: boolean
          nombre: string
          orden: number
        }
        Update: {
          activo?: boolean
          codigo?: string
          es_final?: boolean
          nombre?: string
          orden?: number
        }
        Relationships: []
      }
      feriados: {
        Row: {
          fecha: string
          nombre: string | null
        }
        Insert: {
          fecha: string
          nombre?: string | null
        }
        Update: {
          fecha?: string
          nombre?: string | null
        }
        Relationships: []
      }
      horarios_sucursal: {
        Row: {
          abre: string
          cierra: string
          dia_semana: number
          sucursal: string
        }
        Insert: {
          abre: string
          cierra: string
          dia_semana: number
          sucursal: string
        }
        Update: {
          abre?: string
          cierra?: string
          dia_semana?: number
          sucursal?: string
        }
        Relationships: [
          {
            foreignKeyName: "horarios_sucursal_sucursal_fkey"
            columns: ["sucursal"]
            isOneToOne: false
            referencedRelation: "sucursales_retiro"
            referencedColumns: ["codigo"]
          },
        ]
      }
      impresoras: {
        Row: {
          activo: boolean | null
          creado_en: string | null
          id: string
          modelo: string | null
          nombre: string
          sucursal: string | null
        }
        Insert: {
          activo?: boolean | null
          creado_en?: string | null
          id?: string
          modelo?: string | null
          nombre: string
          sucursal?: string | null
        }
        Update: {
          activo?: boolean | null
          creado_en?: string | null
          id?: string
          modelo?: string | null
          nombre?: string
          sucursal?: string | null
        }
        Relationships: []
      }
      items_pedido: {
        Row: {
          anillado: boolean
          anotacion: string | null
          cantidad: number
          creado_en: string | null
          descuento: number | null
          dia_entrega: string | null
          estado: string | null
          hora_entrega: string | null
          id: string
          lugar_entrega: string | null
          modo: string | null
          orden: number | null
          origen_filas: string | null
          paginas: number | null
          pago: string | null
          pedido_id: string | null
          precio: number | null
          precio_unitario: number | null
          prioridad: string
          producto: string
          url_pdf: string | null
        }
        Insert: {
          anillado?: boolean
          anotacion?: string | null
          cantidad?: number
          creado_en?: string | null
          descuento?: number | null
          dia_entrega?: string | null
          estado?: string | null
          hora_entrega?: string | null
          id?: string
          lugar_entrega?: string | null
          modo?: string | null
          orden?: number | null
          origen_filas?: string | null
          paginas?: number | null
          pago?: string | null
          pedido_id?: string | null
          precio?: number | null
          precio_unitario?: number | null
          prioridad?: string
          producto: string
          url_pdf?: string | null
        }
        Update: {
          anillado?: boolean
          anotacion?: string | null
          cantidad?: number
          creado_en?: string | null
          descuento?: number | null
          dia_entrega?: string | null
          estado?: string | null
          hora_entrega?: string | null
          id?: string
          lugar_entrega?: string | null
          modo?: string | null
          orden?: number | null
          origen_filas?: string | null
          paginas?: number | null
          pago?: string | null
          pedido_id?: string | null
          precio?: number | null
          precio_unitario?: number | null
          prioridad?: string
          producto?: string
          url_pdf?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "items_pedido_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      items_presupuesto: {
        Row: {
          descuento: number | null
          id: string
          modo: string | null
          paginas: number | null
          precio: number | null
          presupuesto_id: string | null
          producto: string
          unidades: number | null
        }
        Insert: {
          descuento?: number | null
          id?: string
          modo?: string | null
          paginas?: number | null
          precio?: number | null
          presupuesto_id?: string | null
          producto: string
          unidades?: number | null
        }
        Update: {
          descuento?: number | null
          id?: string
          modo?: string | null
          paginas?: number | null
          precio?: number | null
          presupuesto_id?: string | null
          producto?: string
          unidades?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "items_presupuesto_presupuesto_id_fkey"
            columns: ["presupuesto_id"]
            isOneToOne: false
            referencedRelation: "presupuestos"
            referencedColumns: ["id"]
          },
        ]
      }
      items_venta: {
        Row: {
          cantidad: number | null
          creado_en: string | null
          descuento_pct: number | null
          id: string
          precio_unitario: number | null
          precio_venta: number | null
          producto_codigo: string | null
          producto_id: string | null
          producto_nombre: string
          total: number | null
          venta_id: string | null
        }
        Insert: {
          cantidad?: number | null
          creado_en?: string | null
          descuento_pct?: number | null
          id?: string
          precio_unitario?: number | null
          precio_venta?: number | null
          producto_codigo?: string | null
          producto_id?: string | null
          producto_nombre: string
          total?: number | null
          venta_id?: string | null
        }
        Update: {
          cantidad?: number | null
          creado_en?: string | null
          descuento_pct?: number | null
          id?: string
          precio_unitario?: number | null
          precio_venta?: number | null
          producto_codigo?: string | null
          producto_id?: string | null
          producto_nombre?: string
          total?: number | null
          venta_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "items_venta_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_venta_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "ventas"
            referencedColumns: ["id"]
          },
        ]
      }
      mensajes_enviados: {
        Row: {
          enviado_en: string
          enviado_por: string | null
          id: string
          pedido_id: string
          plantilla: string | null
        }
        Insert: {
          enviado_en?: string
          enviado_por?: string | null
          id?: string
          pedido_id: string
          plantilla?: string | null
        }
        Update: {
          enviado_en?: string
          enviado_por?: string | null
          id?: string
          pedido_id?: string
          plantilla?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mensajes_enviados_enviado_por_fkey"
            columns: ["enviado_por"]
            isOneToOne: false
            referencedRelation: "usuarios_sistema"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensajes_enviados_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      notificaciones: {
        Row: {
          creado_en: string
          detalle: string | null
          id: string
          leida_en: string | null
          pedido_id: string | null
          tipo: string
          titulo: string
          usuario_id: string
        }
        Insert: {
          creado_en?: string
          detalle?: string | null
          id?: string
          leida_en?: string | null
          pedido_id?: string | null
          tipo: string
          titulo: string
          usuario_id: string
        }
        Update: {
          creado_en?: string
          detalle?: string | null
          id?: string
          leida_en?: string | null
          pedido_id?: string | null
          tipo?: string
          titulo?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificaciones_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios_sistema"
            referencedColumns: ["id"]
          },
        ]
      }
      parametros_precio: {
        Row: {
          activo: boolean
          categoria: string | null
          created_at: string | null
          descuento_maximo: number
          divisor: number
          id: string
          nombre: string
          precio: number
        }
        Insert: {
          activo?: boolean
          categoria?: string | null
          created_at?: string | null
          descuento_maximo?: number
          divisor?: number
          id?: string
          nombre: string
          precio?: number
        }
        Update: {
          activo?: boolean
          categoria?: string | null
          created_at?: string | null
          descuento_maximo?: number
          divisor?: number
          id?: string
          nombre?: string
          precio?: number
        }
        Relationships: []
      }
      pedido_print_events: {
        Row: {
          archivo_id: string | null
          color: boolean | null
          completed_at: string
          copias: number
          creado_en: string
          duplex_mode: string | null
          duration_ms: number | null
          hojas_estimadas: number
          id: string
          job_name: string | null
          metadata: Json
          page_ranges: string | null
          paginas_impresas: number
          paper_name: string | null
          pedido_id: string
          printer_name: string | null
          source_type: string
          started_at: string | null
          status: string
          ticket_type: string | null
        }
        Insert: {
          archivo_id?: string | null
          color?: boolean | null
          completed_at?: string
          copias?: number
          creado_en?: string
          duplex_mode?: string | null
          duration_ms?: number | null
          hojas_estimadas?: number
          id?: string
          job_name?: string | null
          metadata?: Json
          page_ranges?: string | null
          paginas_impresas?: number
          paper_name?: string | null
          pedido_id: string
          printer_name?: string | null
          source_type: string
          started_at?: string | null
          status?: string
          ticket_type?: string | null
        }
        Update: {
          archivo_id?: string | null
          color?: boolean | null
          completed_at?: string
          copias?: number
          creado_en?: string
          duplex_mode?: string | null
          duration_ms?: number | null
          hojas_estimadas?: number
          id?: string
          job_name?: string | null
          metadata?: Json
          page_ranges?: string | null
          paginas_impresas?: number
          paper_name?: string | null
          pedido_id?: string
          printer_name?: string | null
          source_type?: string
          started_at?: string | null
          status?: string
          ticket_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pedido_print_events_archivo_id_fkey"
            columns: ["archivo_id"]
            isOneToOne: false
            referencedRelation: "archivos_pedido"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_print_events_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos: {
        Row: {
          carpeta_url: string | null
          cliente_id: string | null
          codigo_unico: string | null
          creado_en: string | null
          eliminado: boolean
          eliminado_en: string | null
          eliminado_por: string | null
          entregado_en: string | null
          entregado_por: string | null
          es_envio: boolean
          estado: string | null
          fecha: string | null
          fecha_en_produccion: string | null
          fecha_entrega: string | null
          fecha_entregado: string | null
          fecha_listo: string | null
          fecha_marcado_entrega: string | null
          fecha_pedido: string | null
          hora_entrega: string | null
          id: string
          imprimir_tapas: boolean | null
          lugar_entrega: string | null
          medio_contacto: string | null
          medio_pago: string | null
          medio_pago_restante: string | null
          mensaje: string | null
          mercado_pago_hora: string | null
          mercado_pago_monto: number | null
          mercado_pago_payment_id: string | null
          numero: string
          numero_origen: string | null
          orden_produccion: number | null
          origen_filas: string | null
          pago2: number | null
          pago2_fecha: string | null
          pago2_medio: string | null
          prioridad: string | null
          produccion_iniciada_en: string | null
          produccion_por: string | null
          produccion_terminada_en: string | null
          produccion_vence_en: string | null
          queja_en: string | null
          queja_motivo: string | null
          queja_por: string | null
          quien_cargo_codigo: string | null
          quien_entrego_codigo: string | null
          quien_hizo_codigo: string | null
          revisar: boolean
          revisar_motivo: string | null
          senia: number | null
          sucursal: string | null
          sucursal_movida_en: string | null
          sucursal_movida_por: string | null
          sucursal_produccion: string | null
          sucursal_retiro: string | null
          telefono_contacto: string | null
          terciarizado_id: string | null
          ticket_pedido_url: string | null
          total: number | null
          ubicacion: string | null
          ubicacion_actualizada_en: string | null
          ubicacion_en: string | null
          ubicacion_por: string | null
          url_comprobante: string | null
          url_link_pedido: string | null
          url_ticket_entrega: string | null
          url_ticket_pedido: string | null
          usuario_id: string | null
          via_contacto: string | null
        }
        Insert: {
          carpeta_url?: string | null
          cliente_id?: string | null
          codigo_unico?: string | null
          creado_en?: string | null
          eliminado?: boolean
          eliminado_en?: string | null
          eliminado_por?: string | null
          entregado_en?: string | null
          entregado_por?: string | null
          es_envio?: boolean
          estado?: string | null
          fecha?: string | null
          fecha_en_produccion?: string | null
          fecha_entrega?: string | null
          fecha_entregado?: string | null
          fecha_listo?: string | null
          fecha_marcado_entrega?: string | null
          fecha_pedido?: string | null
          hora_entrega?: string | null
          id?: string
          imprimir_tapas?: boolean | null
          lugar_entrega?: string | null
          medio_contacto?: string | null
          medio_pago?: string | null
          medio_pago_restante?: string | null
          mensaje?: string | null
          mercado_pago_hora?: string | null
          mercado_pago_monto?: number | null
          mercado_pago_payment_id?: string | null
          numero: string
          numero_origen?: string | null
          orden_produccion?: number | null
          origen_filas?: string | null
          pago2?: number | null
          pago2_fecha?: string | null
          pago2_medio?: string | null
          prioridad?: string | null
          produccion_iniciada_en?: string | null
          produccion_por?: string | null
          produccion_terminada_en?: string | null
          produccion_vence_en?: string | null
          queja_en?: string | null
          queja_motivo?: string | null
          queja_por?: string | null
          quien_cargo_codigo?: string | null
          quien_entrego_codigo?: string | null
          quien_hizo_codigo?: string | null
          revisar?: boolean
          revisar_motivo?: string | null
          senia?: number | null
          sucursal?: string | null
          sucursal_movida_en?: string | null
          sucursal_movida_por?: string | null
          sucursal_produccion?: string | null
          sucursal_retiro?: string | null
          telefono_contacto?: string | null
          terciarizado_id?: string | null
          ticket_pedido_url?: string | null
          total?: number | null
          ubicacion?: string | null
          ubicacion_actualizada_en?: string | null
          ubicacion_en?: string | null
          ubicacion_por?: string | null
          url_comprobante?: string | null
          url_link_pedido?: string | null
          url_ticket_entrega?: string | null
          url_ticket_pedido?: string | null
          usuario_id?: string | null
          via_contacto?: string | null
        }
        Update: {
          carpeta_url?: string | null
          cliente_id?: string | null
          codigo_unico?: string | null
          creado_en?: string | null
          eliminado?: boolean
          eliminado_en?: string | null
          eliminado_por?: string | null
          entregado_en?: string | null
          entregado_por?: string | null
          es_envio?: boolean
          estado?: string | null
          fecha?: string | null
          fecha_en_produccion?: string | null
          fecha_entrega?: string | null
          fecha_entregado?: string | null
          fecha_listo?: string | null
          fecha_marcado_entrega?: string | null
          fecha_pedido?: string | null
          hora_entrega?: string | null
          id?: string
          imprimir_tapas?: boolean | null
          lugar_entrega?: string | null
          medio_contacto?: string | null
          medio_pago?: string | null
          medio_pago_restante?: string | null
          mensaje?: string | null
          mercado_pago_hora?: string | null
          mercado_pago_monto?: number | null
          mercado_pago_payment_id?: string | null
          numero?: string
          numero_origen?: string | null
          orden_produccion?: number | null
          origen_filas?: string | null
          pago2?: number | null
          pago2_fecha?: string | null
          pago2_medio?: string | null
          prioridad?: string | null
          produccion_iniciada_en?: string | null
          produccion_por?: string | null
          produccion_terminada_en?: string | null
          produccion_vence_en?: string | null
          queja_en?: string | null
          queja_motivo?: string | null
          queja_por?: string | null
          quien_cargo_codigo?: string | null
          quien_entrego_codigo?: string | null
          quien_hizo_codigo?: string | null
          revisar?: boolean
          revisar_motivo?: string | null
          senia?: number | null
          sucursal?: string | null
          sucursal_movida_en?: string | null
          sucursal_movida_por?: string | null
          sucursal_produccion?: string | null
          sucursal_retiro?: string | null
          telefono_contacto?: string | null
          terciarizado_id?: string | null
          ticket_pedido_url?: string | null
          total?: number | null
          ubicacion?: string | null
          ubicacion_actualizada_en?: string | null
          ubicacion_en?: string | null
          ubicacion_por?: string | null
          url_comprobante?: string | null
          url_link_pedido?: string | null
          url_ticket_entrega?: string | null
          url_ticket_pedido?: string | null
          usuario_id?: string | null
          via_contacto?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes_a_revisar"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_eliminado_por_fkey"
            columns: ["eliminado_por"]
            isOneToOne: false
            referencedRelation: "usuarios_sistema"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_entregado_por_fkey"
            columns: ["entregado_por"]
            isOneToOne: false
            referencedRelation: "usuarios_sistema"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_produccion_por_fkey"
            columns: ["produccion_por"]
            isOneToOne: false
            referencedRelation: "usuarios_sistema"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_queja_por_fkey"
            columns: ["queja_por"]
            isOneToOne: false
            referencedRelation: "usuarios_sistema"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_sucursal_movida_por_fkey"
            columns: ["sucursal_movida_por"]
            isOneToOne: false
            referencedRelation: "usuarios_sistema"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_terciarizado_id_fkey"
            columns: ["terciarizado_id"]
            isOneToOne: false
            referencedRelation: "terciarizados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_ubicacion_por_fkey"
            columns: ["ubicacion_por"]
            isOneToOne: false
            referencedRelation: "usuarios_sistema"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios_sistema"
            referencedColumns: ["id"]
          },
        ]
      }
      plantillas_mensaje: {
        Row: {
          activo: boolean
          codigo: string
          cuerpo: string
          estado: string | null
          id: string
          nombre: string
          orden: number
        }
        Insert: {
          activo?: boolean
          codigo: string
          cuerpo: string
          estado?: string | null
          id?: string
          nombre: string
          orden?: number
        }
        Update: {
          activo?: boolean
          codigo?: string
          cuerpo?: string
          estado?: string | null
          id?: string
          nombre?: string
          orden?: number
        }
        Relationships: [
          {
            foreignKeyName: "plantillas_mensaje_estado_fkey"
            columns: ["estado"]
            isOneToOne: false
            referencedRelation: "estados_pedido"
            referencedColumns: ["codigo"]
          },
        ]
      }
      precios_impresion: {
        Row: {
          activo: boolean
          hojas_desde: number
          hojas_hasta: number | null
          id: string
          precio_por_hoja: number
          tamano: string
          tipo_papel: string
          vigente_desde: string
          vigente_hasta: string | null
        }
        Insert: {
          activo?: boolean
          hojas_desde: number
          hojas_hasta?: number | null
          id?: string
          precio_por_hoja: number
          tamano: string
          tipo_papel: string
          vigente_desde?: string
          vigente_hasta?: string | null
        }
        Update: {
          activo?: boolean
          hojas_desde?: number
          hojas_hasta?: number | null
          id?: string
          precio_por_hoja?: number
          tamano?: string
          tipo_papel?: string
          vigente_desde?: string
          vigente_hasta?: string | null
        }
        Relationships: []
      }
      presupuestos: {
        Row: {
          cliente_id: string | null
          creado_en: string | null
          fecha: string | null
          fecha_vencimiento: string | null
          id: string
          medio_contacto: string | null
          numero: string
          total: number | null
          url_pdf: string | null
          usuario_id: string | null
        }
        Insert: {
          cliente_id?: string | null
          creado_en?: string | null
          fecha?: string | null
          fecha_vencimiento?: string | null
          id?: string
          medio_contacto?: string | null
          numero: string
          total?: number | null
          url_pdf?: string | null
          usuario_id?: string | null
        }
        Update: {
          cliente_id?: string | null
          creado_en?: string | null
          fecha?: string | null
          fecha_vencimiento?: string | null
          id?: string
          medio_contacto?: string | null
          numero?: string
          total?: number | null
          url_pdf?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "presupuestos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presupuestos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes_a_revisar"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presupuestos_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios_sistema"
            referencedColumns: ["id"]
          },
        ]
      }
      prioridades: {
        Row: {
          activo: boolean
          codigo: string
          color: string | null
          nombre: string
          orden: number
        }
        Insert: {
          activo?: boolean
          codigo: string
          color?: string | null
          nombre: string
          orden: number
        }
        Update: {
          activo?: boolean
          codigo?: string
          color?: string | null
          nombre?: string
          orden?: number
        }
        Relationships: []
      }
      productos: {
        Row: {
          activo: boolean | null
          anillo_mm: number | null
          anillos_cant: number | null
          carrera: string | null
          categoria: string | null
          codigo_barras: string | null
          creado_en: string | null
          descuento_maximo: number | null
          es_servicio: boolean | null
          foto_url: string | null
          id: string
          link_pdf: string | null
          materia: string | null
          nombre: string
          origen_fila: number | null
          paginas: number | null
          precio: number | null
          precio_compra: number | null
          precio_d: number | null
          precio_e: number | null
          precio_f: number | null
          precio_g: number | null
          revisar: boolean | null
          revisar_motivo: string | null
          tipo: string | null
        }
        Insert: {
          activo?: boolean | null
          anillo_mm?: number | null
          anillos_cant?: number | null
          carrera?: string | null
          categoria?: string | null
          codigo_barras?: string | null
          creado_en?: string | null
          descuento_maximo?: number | null
          es_servicio?: boolean | null
          foto_url?: string | null
          id?: string
          link_pdf?: string | null
          materia?: string | null
          nombre: string
          origen_fila?: number | null
          paginas?: number | null
          precio?: number | null
          precio_compra?: number | null
          precio_d?: number | null
          precio_e?: number | null
          precio_f?: number | null
          precio_g?: number | null
          revisar?: boolean | null
          revisar_motivo?: string | null
          tipo?: string | null
        }
        Update: {
          activo?: boolean | null
          anillo_mm?: number | null
          anillos_cant?: number | null
          carrera?: string | null
          categoria?: string | null
          codigo_barras?: string | null
          creado_en?: string | null
          descuento_maximo?: number | null
          es_servicio?: boolean | null
          foto_url?: string | null
          id?: string
          link_pdf?: string | null
          materia?: string | null
          nombre?: string
          origen_fila?: number | null
          paginas?: number | null
          precio?: number | null
          precio_compra?: number | null
          precio_d?: number | null
          precio_e?: number | null
          precio_f?: number | null
          precio_g?: number | null
          revisar?: boolean | null
          revisar_motivo?: string | null
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "productos_anillo_mm_fkey"
            columns: ["anillo_mm"]
            isOneToOne: false
            referencedRelation: "anillos"
            referencedColumns: ["medida_mm"]
          },
        ]
      }
      proveedor_articulos: {
        Row: {
          activo: boolean
          created_at: string
          descripcion: string | null
          id: string
          markup_pct: number
          nombre: string
          plancha_alto_cm: number | null
          plancha_ancho_cm: number | null
          precio_costo: number
          proveedor_id: string
          tiempo_entrega_dias: number
          unidad: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          descripcion?: string | null
          id?: string
          markup_pct?: number
          nombre: string
          plancha_alto_cm?: number | null
          plancha_ancho_cm?: number | null
          precio_costo?: number
          proveedor_id: string
          tiempo_entrega_dias?: number
          unidad?: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          descripcion?: string | null
          id?: string
          markup_pct?: number
          nombre?: string
          plancha_alto_cm?: number | null
          plancha_ancho_cm?: number | null
          precio_costo?: number
          proveedor_id?: string
          tiempo_entrega_dias?: number
          unidad?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proveedor_articulos_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id"]
          },
        ]
      }
      proveedores: {
        Row: {
          activo: boolean
          contacto: string | null
          created_at: string
          email: string | null
          id: string
          nombre: string
          notas: string | null
          telefono: string | null
        }
        Insert: {
          activo?: boolean
          contacto?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nombre: string
          notas?: string | null
          telefono?: string | null
        }
        Update: {
          activo?: boolean
          contacto?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nombre?: string
          notas?: string | null
          telefono?: string | null
        }
        Relationships: []
      }
      reclamos: {
        Row: {
          creado_en: string | null
          estado: string | null
          fecha: string | null
          id: string
          numero_reclamo: string
          pedido_numero: string
          sucursal: string | null
          texto: string | null
          url_ticket_reclamo: string | null
        }
        Insert: {
          creado_en?: string | null
          estado?: string | null
          fecha?: string | null
          id?: string
          numero_reclamo: string
          pedido_numero: string
          sucursal?: string | null
          texto?: string | null
          url_ticket_reclamo?: string | null
        }
        Update: {
          creado_en?: string | null
          estado?: string | null
          fecha?: string | null
          id?: string
          numero_reclamo?: string
          pedido_numero?: string
          sucursal?: string | null
          texto?: string | null
          url_ticket_reclamo?: string | null
        }
        Relationships: []
      }
      recordatorios_produccion: {
        Row: {
          destinatario: string | null
          enviado_en: string
          id: string
          motivo: string
          pedido_id: string
        }
        Insert: {
          destinatario?: string | null
          enviado_en?: string
          id?: string
          motivo?: string
          pedido_id: string
        }
        Update: {
          destinatario?: string | null
          enviado_en?: string
          id?: string
          motivo?: string
          pedido_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recordatorios_produccion_destinatario_fkey"
            columns: ["destinatario"]
            isOneToOne: false
            referencedRelation: "usuarios_sistema"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recordatorios_produccion_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      registro: {
        Row: {
          codigo: string | null
          fecha: string | null
          id: string
          mensaje: string | null
          referencia: string | null
          usuario_id: string | null
        }
        Insert: {
          codigo?: string | null
          fecha?: string | null
          id?: string
          mensaje?: string | null
          referencia?: string | null
          usuario_id?: string | null
        }
        Update: {
          codigo?: string | null
          fecha?: string | null
          id?: string
          mensaje?: string | null
          referencia?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "registro_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios_sistema"
            referencedColumns: ["id"]
          },
        ]
      }
      registros_ciclos: {
        Row: {
          ciclos_dia: number
          creado_en: string | null
          fecha: string
          id: string
          impresora_id: string
          nivel_toner: string | null
          observaciones: string | null
          usuario_id: string | null
        }
        Insert: {
          ciclos_dia?: number
          creado_en?: string | null
          fecha?: string
          id?: string
          impresora_id: string
          nivel_toner?: string | null
          observaciones?: string | null
          usuario_id?: string | null
        }
        Update: {
          ciclos_dia?: number
          creado_en?: string | null
          fecha?: string
          id?: string
          impresora_id?: string
          nivel_toner?: string | null
          observaciones?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "registros_ciclos_impresora_id_fkey"
            columns: ["impresora_id"]
            isOneToOne: false
            referencedRelation: "impresoras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registros_ciclos_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios_sistema"
            referencedColumns: ["id"]
          },
        ]
      }
      staging_clientes_migracion: {
        Row: {
          activo: string | null
          cargado_en: string
          cod_pais: string | null
          codigo: string | null
          codigo_origen: string | null
          grupos_dup: string | null
          mail: string | null
          nombre: string | null
          origen_fila: string
          origen_gid: string
          origen_hoja: string
          revisar: string | null
          revisar_motivo: string | null
          telefono: string | null
        }
        Insert: {
          activo?: string | null
          cargado_en?: string
          cod_pais?: string | null
          codigo?: string | null
          codigo_origen?: string | null
          grupos_dup?: string | null
          mail?: string | null
          nombre?: string | null
          origen_fila: string
          origen_gid: string
          origen_hoja: string
          revisar?: string | null
          revisar_motivo?: string | null
          telefono?: string | null
        }
        Update: {
          activo?: string | null
          cargado_en?: string
          cod_pais?: string | null
          codigo?: string | null
          codigo_origen?: string | null
          grupos_dup?: string | null
          mail?: string | null
          nombre?: string | null
          origen_fila?: string
          origen_gid?: string
          origen_hoja?: string
          revisar?: string | null
          revisar_motivo?: string | null
          telefono?: string | null
        }
        Relationships: []
      }
      stock: {
        Row: {
          actualizado_en: string | null
          cantidad: number | null
          id: string
          producto_id: string | null
        }
        Insert: {
          actualizado_en?: string | null
          cantidad?: number | null
          id?: string
          producto_id?: string | null
        }
        Update: {
          actualizado_en?: string | null
          cantidad?: number | null
          id?: string
          producto_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: true
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_sucursal: {
        Row: {
          cantidad: number
          id: string
          producto_id: string
          sucursal: string
          updated_at: string | null
        }
        Insert: {
          cantidad?: number
          id?: string
          producto_id: string
          sucursal: string
          updated_at?: string | null
        }
        Update: {
          cantidad?: number
          id?: string
          producto_id?: string
          sucursal?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_sucursal_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_utiles: {
        Row: {
          activo: boolean | null
          codigo: string
          id: string
          nombre: string
          precio_compra: number | null
          precio_venta: number | null
          stock: number | null
        }
        Insert: {
          activo?: boolean | null
          codigo: string
          id?: string
          nombre: string
          precio_compra?: number | null
          precio_venta?: number | null
          stock?: number | null
        }
        Update: {
          activo?: boolean | null
          codigo?: string
          id?: string
          nombre?: string
          precio_compra?: number | null
          precio_venta?: number | null
          stock?: number | null
        }
        Relationships: []
      }
      sucursales: {
        Row: {
          activo: boolean | null
          creado_en: string | null
          id: string
          nombre: string
        }
        Insert: {
          activo?: boolean | null
          creado_en?: string | null
          id?: string
          nombre: string
        }
        Update: {
          activo?: boolean | null
          creado_en?: string | null
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      sucursales_retiro: {
        Row: {
          activa: boolean
          codigo: string
          direccion: string
          horario: string | null
          nombre: string
        }
        Insert: {
          activa?: boolean
          codigo: string
          direccion: string
          horario?: string | null
          nombre: string
        }
        Update: {
          activa?: boolean
          codigo?: string
          direccion?: string
          horario?: string | null
          nombre?: string
        }
        Relationships: []
      }
      terciarizados: {
        Row: {
          anotacion: string | null
          cantidad: number | null
          cliente: string
          cliente_id: string | null
          creado_en: string | null
          estado: string | null
          fecha: string | null
          id: string
          item: string
          mensaje: string | null
          numero: string
          precio_costo: number | null
          proveedor: string | null
          proveedor_articulo_id: string | null
          senia: number | null
          sucursal: string | null
          telefono: string | null
          total: number | null
          url_comprobante: string | null
          usuario_id: string | null
        }
        Insert: {
          anotacion?: string | null
          cantidad?: number | null
          cliente: string
          cliente_id?: string | null
          creado_en?: string | null
          estado?: string | null
          fecha?: string | null
          id?: string
          item: string
          mensaje?: string | null
          numero: string
          precio_costo?: number | null
          proveedor?: string | null
          proveedor_articulo_id?: string | null
          senia?: number | null
          sucursal?: string | null
          telefono?: string | null
          total?: number | null
          url_comprobante?: string | null
          usuario_id?: string | null
        }
        Update: {
          anotacion?: string | null
          cantidad?: number | null
          cliente?: string
          cliente_id?: string | null
          creado_en?: string | null
          estado?: string | null
          fecha?: string | null
          id?: string
          item?: string
          mensaje?: string | null
          numero?: string
          precio_costo?: number | null
          proveedor?: string | null
          proveedor_articulo_id?: string | null
          senia?: number | null
          sucursal?: string | null
          telefono?: string | null
          total?: number | null
          url_comprobante?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "terciarizados_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "terciarizados_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes_a_revisar"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "terciarizados_proveedor_articulo_id_fkey"
            columns: ["proveedor_articulo_id"]
            isOneToOne: false
            referencedRelation: "proveedor_articulos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "terciarizados_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios_sistema"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets_pedido: {
        Row: {
          generado_en: string
          generado_por: string | null
          id: string
          impreso: boolean
          impreso_en: string | null
          impreso_por: string | null
          pedido_id: string
          tipo: string
        }
        Insert: {
          generado_en?: string
          generado_por?: string | null
          id?: string
          impreso?: boolean
          impreso_en?: string | null
          impreso_por?: string | null
          pedido_id: string
          tipo: string
        }
        Update: {
          generado_en?: string
          generado_por?: string | null
          id?: string
          impreso?: boolean
          impreso_en?: string | null
          impreso_por?: string | null
          pedido_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_pedido_generado_por_fkey"
            columns: ["generado_por"]
            isOneToOne: false
            referencedRelation: "usuarios_sistema"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_pedido_impreso_por_fkey"
            columns: ["impreso_por"]
            isOneToOne: false
            referencedRelation: "usuarios_sistema"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_pedido_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      usuarios_sistema: {
        Row: {
          activo: boolean | null
          codigo_personal: string | null
          creado_en: string | null
          email: string
          id: string
          nombre: string
          rol: string
          sucursal_default: string | null
        }
        Insert: {
          activo?: boolean | null
          codigo_personal?: string | null
          creado_en?: string | null
          email: string
          id: string
          nombre: string
          rol?: string
          sucursal_default?: string | null
        }
        Update: {
          activo?: boolean | null
          codigo_personal?: string | null
          creado_en?: string | null
          email?: string
          id?: string
          nombre?: string
          rol?: string
          sucursal_default?: string | null
        }
        Relationships: []
      }
      ventas: {
        Row: {
          creado_en: string | null
          fecha: string | null
          id: string
          medio_pago: string | null
          numero_venta: string
          sucursal: string | null
          total: number | null
          url_comprobante: string | null
          usuario_id: string | null
        }
        Insert: {
          creado_en?: string | null
          fecha?: string | null
          id?: string
          medio_pago?: string | null
          numero_venta: string
          sucursal?: string | null
          total?: number | null
          url_comprobante?: string | null
          usuario_id?: string | null
        }
        Update: {
          creado_en?: string | null
          fecha?: string | null
          id?: string
          medio_pago?: string | null
          numero_venta?: string
          sucursal?: string | null
          total?: number | null
          url_comprobante?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ventas_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios_sistema"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      clientes_a_revisar: {
        Row: {
          cod_pais: string | null
          codigo: string | null
          grupos_dup: string[] | null
          id: string | null
          mail: string | null
          nombre: string | null
          origen_fila: number | null
          revisar_motivo: string | null
          telefono: string | null
        }
        Insert: {
          cod_pais?: string | null
          codigo?: string | null
          grupos_dup?: string[] | null
          id?: string | null
          mail?: string | null
          nombre?: string | null
          origen_fila?: number | null
          revisar_motivo?: string | null
          telefono?: string | null
        }
        Update: {
          cod_pais?: string | null
          codigo?: string | null
          grupos_dup?: string[] | null
          id?: string | null
          mail?: string | null
          nombre?: string | null
          origen_fila?: number | null
          revisar_motivo?: string | null
          telefono?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      anillado_para: {
        Args: { p_paginas: number }
        Returns: {
          anillos: number
          medida_mm: number
          precio: number
        }[]
      }
      cotizar_trabajo: {
        Args: {
          p_anillado?: boolean
          p_apaisado?: boolean
          p_encuadernado?: boolean
          p_paginas: number
          p_tamano: string
          p_tipo_papel: string
        }
        Returns: Json
      }
      hojas_de: { Args: { p_paginas: number }; Returns: number }
      importar_catalogo_productos: { Args: { p_filas: Json }; Returns: Json }
      migrar_clientes_desde_staging: {
        Args: { p_origen_gid: string; p_origen_hoja: string }
        Returns: Json
      }
      migrar_pedidos_desde_staging: { Args: never; Returns: Json }
      next_counter: { Args: { p_nombre: string }; Returns: number }
      normalizar_texto: { Args: { p_texto: string }; Returns: string }
      precio_anillado_particular: {
        Args: { p_paginas: number }
        Returns: number
      }
      precio_impresion: {
        Args: { p_hojas: number; p_tamano: string; p_tipo_papel: string }
        Returns: number
      }
      reemplazar_staging_pedidos: {
        Args: { p_clientes_nuevos: Json; p_items: Json; p_pedidos: Json }
        Returns: Json
      }
      resolver_cliente_id_migracion: {
        Args: { p_nombre: string; p_numero_pedido: string; p_telefono: string }
        Returns: string
      }
      sumar_horas_habiles: {
        Args: { p_desde: string; p_horas: number; p_sucursal: string }
        Returns: string
      }
      tomar_pedido_en_produccion: {
        Args: { p_pedido_id: string; p_usuario_id: string }
        Returns: {
          vence_en: string
        }[]
      }
      validar_staging_pedidos: { Args: never; Returns: Json }
      verificar_migracion_pedidos: { Args: never; Returns: Json }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
