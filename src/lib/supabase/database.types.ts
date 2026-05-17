export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      usuarios_sistema: {
        Row: {
          id: string
          nombre: string
          email: string
          rol: string
          sucursal_default: string | null
          codigo_personal: string | null
          activo: boolean | null
          creado_en: string | null
        }
        Insert: {
          id: string
          nombre: string
          email: string
          rol?: string
          sucursal_default?: string | null
          codigo_personal?: string | null
          activo?: boolean | null
          creado_en?: string | null
        }
        Update: {
          id?: string
          nombre?: string
          email?: string
          rol?: string
          sucursal_default?: string | null
          codigo_personal?: string | null
          activo?: boolean | null
          creado_en?: string | null
        }
      }
      clientes: {
        Row: {
          id: string
          codigo: string
          nombre: string
          cod_pais: string | null
          telefono: string | null
          mail: string | null
          activo: boolean | null
          creado_en: string | null
        }
        Insert: {
          id?: string
          codigo: string
          nombre: string
          cod_pais?: string | null
          telefono?: string | null
          mail?: string | null
          activo?: boolean | null
          creado_en?: string | null
        }
        Update: {
          id?: string
          codigo?: string
          nombre?: string
          cod_pais?: string | null
          telefono?: string | null
          mail?: string | null
          activo?: boolean | null
          creado_en?: string | null
        }
      }
      productos: {
        Row: {
          id: string
          nombre: string
          paginas: number | null
          precio_d: number | null
          precio_e: number | null
          precio_f: number | null
          precio_g: number | null
          categoria: string | null
          link_pdf: string | null
          activo: boolean | null
          creado_en: string | null
        }
        Insert: {
          id?: string
          nombre: string
          paginas?: number | null
          precio_d?: number | null
          precio_e?: number | null
          precio_f?: number | null
          precio_g?: number | null
          categoria?: string | null
          link_pdf?: string | null
          activo?: boolean | null
          creado_en?: string | null
        }
        Update: {
          id?: string
          nombre?: string
          paginas?: number | null
          precio_d?: number | null
          precio_e?: number | null
          precio_f?: number | null
          precio_g?: number | null
          categoria?: string | null
          link_pdf?: string | null
          activo?: boolean | null
          creado_en?: string | null
        }
      }
      parametros_precio: {
        Row: {
          id: string
          nombre: string
          precio: number
          divisor: number
          descuento_maximo: number | null
          activo: boolean | null
          creado_en: string | null
        }
        Insert: {
          id?: string
          nombre: string
          precio: number
          divisor?: number
          descuento_maximo?: number | null
          activo?: boolean | null
          creado_en?: string | null
        }
        Update: {
          id?: string
          nombre?: string
          precio?: number
          divisor?: number
          descuento_maximo?: number | null
          activo?: boolean | null
          creado_en?: string | null
        }
      }
      configuracion: {
        Row: {
          clave: string
          valor: string
        }
        Insert: {
          clave: string
          valor: string
        }
        Update: {
          clave?: string
          valor?: string
        }
      }
      sucursales: {
        Row: {
          id: string
          nombre: string
          activo: boolean | null
          creado_en: string | null
        }
        Insert: {
          id?: string
          nombre: string
          activo?: boolean | null
          creado_en?: string | null
        }
        Update: {
          id?: string
          nombre?: string
          activo?: boolean | null
          creado_en?: string | null
        }
      }
      stock: {
        Row: {
          id: string
          producto_id: string
          cantidad: number
          actualizado_en: string | null
        }
        Insert: {
          id?: string
          producto_id: string
          cantidad?: number
          actualizado_en?: string | null
        }
        Update: {
          id?: string
          producto_id?: string
          cantidad?: number
          actualizado_en?: string | null
        }
      }
      pedidos: {
        Row: {
          id: string
          numero: string
          codigo_unico: string | null
          usuario_id: string | null
          fecha: string | null
          cliente_id: string | null
          estado: string | null
          senia: number | null
          medio_pago: string | null
          via_contacto: string | null
          prioridad: string | null
          mensaje: string | null
          telefono_contacto: string | null
          quien_cargo_codigo: string | null
          sucursal_produccion: string | null
          sucursal_retiro: string | null
          creado_en: string | null
        }
        Insert: {
          id?: string
          numero: string
          codigo_unico?: string | null
          usuario_id?: string | null
          fecha?: string | null
          cliente_id?: string | null
          estado?: string | null
          senia?: number | null
          medio_pago?: string | null
          via_contacto?: string | null
          prioridad?: string | null
          mensaje?: string | null
          telefono_contacto?: string | null
          quien_cargo_codigo?: string | null
          sucursal_produccion?: string | null
          sucursal_retiro?: string | null
          creado_en?: string | null
        }
        Update: {
          id?: string
          numero?: string
          codigo_unico?: string | null
          usuario_id?: string | null
          fecha?: string | null
          cliente_id?: string | null
          estado?: string | null
          senia?: number | null
          medio_pago?: string | null
          via_contacto?: string | null
          prioridad?: string | null
          mensaje?: string | null
          telefono_contacto?: string | null
          quien_cargo_codigo?: string | null
          sucursal_produccion?: string | null
          sucursal_retiro?: string | null
          creado_en?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_cliente_id_fkey"
            columns: ["cliente_id"]
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          }
        ]
      }
      items_pedido: {
        Row: {
          id: string
          pedido_id: string
          producto: string
          anotacion: string | null
          paginas: number | null
          modo: string | null
          pago: string | null
          precio: number | null
          descuento: number | null
          lugar_entrega: string | null
          dia_entrega: string | null
          hora_entrega: string | null
          url_pdf: string | null
          estado: string | null
          creado_en: string | null
        }
        Insert: {
          id?: string
          pedido_id: string
          producto: string
          anotacion?: string | null
          paginas?: number | null
          modo?: string | null
          pago?: string | null
          precio?: number | null
          descuento?: number | null
          lugar_entrega?: string | null
          dia_entrega?: string | null
          hora_entrega?: string | null
          url_pdf?: string | null
          estado?: string | null
          creado_en?: string | null
        }
        Update: {
          id?: string
          pedido_id?: string
          producto?: string
          anotacion?: string | null
          paginas?: number | null
          modo?: string | null
          pago?: string | null
          precio?: number | null
          descuento?: number | null
          lugar_entrega?: string | null
          dia_entrega?: string | null
          hora_entrega?: string | null
          url_pdf?: string | null
          estado?: string | null
          creado_en?: string | null
        }
      }
      archivos_pedido: {
        Row: {
          id: string
          pedido_id: string
          nombre_archivo: string
          google_file_id: string
          copias: number
          color: boolean
          doble_faz: boolean
          tamano_papel: string
          orientacion: string
          paginas_por_hoja: number
          rango_paginas: string | null
          estado: string | null
          impreso: boolean
          creado_en: string | null
        }
        Insert: {
          id?: string
          pedido_id: string
          nombre_archivo: string
          google_file_id: string
          copias?: number
          color?: boolean
          doble_faz?: boolean
          tamano_papel?: string
          orientacion?: string
          paginas_por_hoja?: number
          rango_paginas?: string | null
          estado?: string | null
          impreso?: boolean
          creado_en?: string | null
        }
        Update: {
          id?: string
          pedido_id?: string
          nombre_archivo?: string
          google_file_id?: string
          copias?: number
          color?: boolean
          doble_faz?: boolean
          tamano_papel?: string
          orientacion?: string
          paginas_por_hoja?: number
          rango_paginas?: string | null
          estado?: string | null
          impreso?: boolean
          creado_en?: string | null
        }
      }
      presupuestos: {
        Row: {
          id: string
          numero: string
          usuario_id: string | null
          cliente_id: string | null
          fecha: string | null
          fecha_vencimiento: string | null
          total: number | null
          medio_contacto: string | null
          url_pdf: string | null
          creado_en: string | null
        }
        Insert: {
          id?: string
          numero: string
          usuario_id?: string | null
          cliente_id?: string | null
          fecha?: string | null
          fecha_vencimiento?: string | null
          total?: number | null
          medio_contacto?: string | null
          url_pdf?: string | null
          creado_en?: string | null
        }
        Update: {
          id?: string
          numero?: string
          usuario_id?: string | null
          cliente_id?: string | null
          fecha?: string | null
          fecha_vencimiento?: string | null
          total?: number | null
          medio_contacto?: string | null
          url_pdf?: string | null
          creado_en?: string | null
        }
      }
      items_presupuesto: {
        Row: {
          id: string
          presupuesto_id: string
          producto: string
          modo: string | null
          paginas: number | null
          precio: number | null
          descuento: number | null
          unidades: number | null
        }
        Insert: {
          id?: string
          presupuesto_id: string
          producto: string
          modo?: string | null
          paginas?: number | null
          precio?: number | null
          descuento?: number | null
          unidades?: number | null
        }
        Update: {
          id?: string
          presupuesto_id?: string
          producto?: string
          modo?: string | null
          paginas?: number | null
          precio?: number | null
          descuento?: number | null
          unidades?: number | null
        }
      }
      catalogo_encargos: {
        Row: {
          id: string
          nombre: string
          precio: number | null
          activo: boolean | null
        }
        Insert: {
          id?: string
          nombre: string
          precio?: number | null
          activo?: boolean | null
        }
        Update: {
          id?: string
          nombre?: string
          precio?: number | null
          activo?: boolean | null
        }
      }
      terciarizados: {
        Row: {
          id: string
          numero: string
          usuario_id: string | null
          fecha: string | null
          cliente: string
          item: string
          anotacion: string | null
          total: number | null
          senia: number | null
          estado: string | null
          telefono: string | null
          sucursal: string | null
          url_comprobante: string | null
          creado_en: string | null
        }
        Insert: {
          id?: string
          numero: string
          usuario_id?: string | null
          fecha?: string | null
          cliente: string
          item: string
          anotacion?: string | null
          total?: number | null
          senia?: number | null
          estado?: string | null
          telefono?: string | null
          sucursal?: string | null
          url_comprobante?: string | null
          creado_en?: string | null
        }
        Update: {
          id?: string
          numero?: string
          usuario_id?: string | null
          fecha?: string | null
          cliente?: string
          item?: string
          anotacion?: string | null
          total?: number | null
          senia?: number | null
          estado?: string | null
          telefono?: string | null
          sucursal?: string | null
          url_comprobante?: string | null
          creado_en?: string | null
        }
      }
      reclamos: {
        Row: {
          id: string
          numero_reclamo: string
          pedido_numero: string
          fecha: string | null
          texto: string | null
          sucursal: string | null
          estado: string | null
          creado_en: string | null
        }
        Insert: {
          id?: string
          numero_reclamo: string
          pedido_numero: string
          fecha?: string | null
          texto?: string | null
          sucursal?: string | null
          estado?: string | null
          creado_en?: string | null
        }
        Update: {
          id?: string
          numero_reclamo?: string
          pedido_numero?: string
          fecha?: string | null
          texto?: string | null
          sucursal?: string | null
          estado?: string | null
          creado_en?: string | null
        }
      }
      stock_utiles: {
        Row: {
          id: string
          codigo: string
          nombre: string
          precio_compra: number | null
          precio_venta: number | null
          stock: number | null
          activo: boolean | null
        }
        Insert: {
          id?: string
          codigo: string
          nombre: string
          precio_compra?: number | null
          precio_venta?: number | null
          stock?: number | null
          activo?: boolean | null
        }
        Update: {
          id?: string
          codigo?: string
          nombre?: string
          precio_compra?: number | null
          precio_venta?: number | null
          stock?: number | null
          activo?: boolean | null
        }
      }
      ventas: {
        Row: {
          id: string
          numero_venta: string
          usuario_id: string | null
          fecha: string | null
          sucursal: string | null
          total: number | null
          url_comprobante: string | null
          creado_en: string | null
        }
        Insert: {
          id?: string
          numero_venta: string
          usuario_id?: string | null
          fecha?: string | null
          sucursal?: string | null
          total?: number | null
          url_comprobante?: string | null
          creado_en?: string | null
        }
        Update: {
          id?: string
          numero_venta?: string
          usuario_id?: string | null
          fecha?: string | null
          sucursal?: string | null
          total?: number | null
          url_comprobante?: string | null
          creado_en?: string | null
        }
      }
      items_venta: {
        Row: {
          id: string
          venta_id: string
          producto_codigo: string | null
          producto_nombre: string
          cantidad: number | null
          precio_unitario: number | null
          precio_venta: number | null
          total: number | null
          creado_en: string | null
        }
        Insert: {
          id?: string
          venta_id: string
          producto_codigo?: string | null
          producto_nombre: string
          cantidad?: number | null
          precio_unitario?: number | null
          precio_venta?: number | null
          total?: number | null
          creado_en?: string | null
        }
        Update: {
          id?: string
          venta_id?: string
          producto_codigo?: string | null
          producto_nombre?: string
          cantidad?: number | null
          precio_unitario?: number | null
          precio_venta?: number | null
          total?: number | null
          creado_en?: string | null
        }
      }
      registro: {
        Row: {
          id: string
          codigo: string | null
          referencia: string | null
          fecha: string | null
          mensaje: string | null
          usuario_id: string | null
        }
        Insert: {
          id?: string
          codigo?: string | null
          referencia?: string | null
          fecha?: string | null
          mensaje?: string | null
          usuario_id?: string | null
        }
        Update: {
          id?: string
          codigo?: string | null
          referencia?: string | null
          fecha?: string | null
          mensaje?: string | null
          usuario_id?: string | null
        }
      }
      counters: {
        Row: {
          nombre: string
          valor: number
        }
        Insert: {
          nombre: string
          valor?: number
        }
        Update: {
          nombre?: string
          valor?: number
        }
      }
    }
    Views: Record<string, never>
    Functions: {
      next_counter: {
        Args: { p_nombre: string }
        Returns: number
      }
    }
    Enums: Record<string, never>
  }
}
