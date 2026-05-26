"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type ItemPedidoInput = {
  producto: string;
  anotacion?: string;
  paginas?: number;
  modo?: string;
  pago?: string;
  precio: number;
  descuento?: number;
  lugar_entrega?: string;
  dia_entrega?: string;
  hora_entrega?: string;
};

function generarCodigoUnico(numero: string): string {
  const year = new Date().getFullYear();
  const rand = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `IMP-${year}-${numero}-${rand}`;
}

export async function crearPedido(formData: FormData) {
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const clienteId          = formData.get("cliente_id") as string;
  const itemsJson          = formData.get("items") as string;
  const comoPresupuesto    = formData.get("como_presupuesto") === "true";
  const senia              = parseFloat(formData.get("senia") as string) || 0;
  const medioPago          = formData.get("medio_pago") as string;
  const viaContacto        = formData.get("via_contacto") as string;
  const prioridad          = (formData.get("prioridad") as string) || "normal";
  const mensaje            = formData.get("mensaje") as string;
  const telefonoContacto   = formData.get("telefono_contacto") as string;
  const quienCargoCodigo   = formData.get("quien_cargo_codigo") as string;
  const sucursalProduccion = formData.get("sucursal_produccion") as string;
  const sucursalRetiro     = formData.get("sucursal_retiro") as string;

  if (!clienteId) return { error: "Seleccioná un cliente" };
  if (!itemsJson)  return { error: "Agregá al menos un producto" };

  let items: ItemPedidoInput[];
  try { items = JSON.parse(itemsJson); }
  catch { return { error: "Error en los productos" }; }
  if (!items.length) return { error: "Agregá al menos un producto" };

  const { data: counterData, error: counterError } = await admin.rpc("next_counter", { p_nombre: "pedidos" });
  if (counterError) return { error: `Error al generar número: ${counterError.message}` };

  const numero      = String(counterData).padStart(7, "0");
  const codigoUnico = generarCodigoUnico(numero);

  const { data: pedido, error: pedidoError } = await supabase
    .from("pedidos")
    .insert({
      numero,
      codigo_unico:        codigoUnico,
      usuario_id:          user.id,
      cliente_id:          clienteId,
      estado:              comoPresupuesto ? "Presupuesto" : "Encargo recibido",
      senia,
      medio_pago:          medioPago          || undefined,
      via_contacto:        viaContacto        || undefined,
      prioridad:           prioridad          || "normal",
      mensaje:             mensaje            || undefined,
      telefono_contacto:   telefonoContacto   || undefined,
      quien_cargo_codigo:  quienCargoCodigo   || undefined,
      sucursal_produccion: sucursalProduccion || undefined,
      sucursal_retiro:     sucursalRetiro     || undefined,
    })
    .select("id")
    .single();

  if (pedidoError || !pedido) return { error: `Error al crear pedido: ${pedidoError?.message}` };

  const itemsInsert = items.map((item) => ({
    pedido_id: pedido.id,
    producto:  item.producto,
    anotacion: item.anotacion || null,
    paginas:   item.paginas   || null,
    modo:      item.modo      || null,
    precio:    item.precio,
    descuento: item.descuento || 0,
    estado:    "Encargo recibido",
  }));

  const { error: itemsError } = await supabase.from("items_pedido").insert(itemsInsert);
  if (itemsError) return { error: `Error al guardar items: ${itemsError.message}` };

  await supabase.from("registro").insert({
    referencia: numero,
    mensaje: `${comoPresupuesto ? "Presupuesto" : "Pedido"} creado (${codigoUnico}) — ${items.length} item(s)`,
    usuario_id: user.id,
  });

  return { pedidoId: pedido.id, numero, codigoUnico };
}
