"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function actualizarEstado(pedidoId: string, nuevoEstado: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("pedidos")
    .update({ estado: nuevoEstado })
    .eq("id", pedidoId);

  if (error) return { error: error.message };

  revalidatePath(`/pedidos/${pedidoId}`);
  revalidatePath("/pedidos");
  return { ok: true };
}

const emptyToNull = (value: FormDataEntryValue | null) => {
  const text = String(value ?? "").trim();
  return text === "" ? null : text;
};

const numOrNull = (value: FormDataEntryValue | null) => {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const num = Number(text);
  return Number.isFinite(num) ? num : null;
};

export async function guardarDetallePedido(pedidoId: string, formData: FormData) {
  const supabase = await createClient();

  const pedidoUpdate = {
    fecha: emptyToNull(formData.get("fecha")),
    estado: emptyToNull(formData.get("estado")),
    senia: numOrNull(formData.get("senia")) ?? 0,
    medio_pago: emptyToNull(formData.get("medio_pago")),
    via_contacto: emptyToNull(formData.get("via_contacto")),
    prioridad: emptyToNull(formData.get("prioridad")),
    mensaje: emptyToNull(formData.get("mensaje")),
    telefono_contacto: emptyToNull(formData.get("telefono_contacto")),
    quien_cargo_codigo: emptyToNull(formData.get("quien_cargo_codigo")),
    sucursal_produccion: emptyToNull(formData.get("sucursal_produccion")),
    sucursal_retiro: emptyToNull(formData.get("sucursal_retiro")),
  };

  const { error: pedidoError } = await supabase
    .from("pedidos")
    .update(pedidoUpdate as any)
    .eq("id", pedidoId);

  if (pedidoError) return { error: pedidoError.message };

  const itemsJson = String(formData.get("items") ?? "[]");
  let items: Array<Record<string, unknown>>;
  try {
    items = JSON.parse(itemsJson);
  } catch {
    return { error: "No pude leer los items del pedido" };
  }

  for (const item of items) {
    const id = String(item.id ?? "");
    if (!id) continue;

    const { error } = await supabase
      .from("items_pedido")
      .update({
        producto: emptyToNull(String(item.producto ?? "")) ?? "",
        anotacion: emptyToNull(String(item.anotacion ?? "")),
        paginas: numOrNull(String(item.paginas ?? "")),
        modo: emptyToNull(String(item.modo ?? "")),
        pago: emptyToNull(String(item.pago ?? "")),
        precio: numOrNull(String(item.precio ?? "")),
        descuento: numOrNull(String(item.descuento ?? "")) ?? 0,
        lugar_entrega: emptyToNull(String(item.lugar_entrega ?? "")),
        dia_entrega: emptyToNull(String(item.dia_entrega ?? "")),
        hora_entrega: emptyToNull(String(item.hora_entrega ?? "")),
        estado: emptyToNull(String(item.estado ?? "")),
      } as any)
      .eq("id", id)
      .eq("pedido_id", pedidoId);

    if (error) return { error: error.message };
  }

  revalidatePath(`/pedidos/${pedidoId}`);
  revalidatePath("/pedidos");
  return { ok: true };
}

const ESTADO_ORDEN = [
  "Encargo recibido",
  "En proceso",
  "Listo para retirar",
  "Entregado",
  "Cancelado",
];

function estadoMenosDesarrollado(estados: string[]) {
  const validos = estados.filter(Boolean);
  if (!validos.length) return "Encargo recibido";
  return validos.reduce((min, estado) => {
    const minIdx = ESTADO_ORDEN.indexOf(min);
    const estadoIdx = ESTADO_ORDEN.indexOf(estado);
    if (estadoIdx === -1) return min;
    if (minIdx === -1) return estado;
    return estadoIdx < minIdx ? estado : min;
  }, validos[0]);
}

export async function actualizarEstadoArchivo(pedidoId: string, archivoId: string, nuevoEstado: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("archivos_pedido")
    .update({ estado: nuevoEstado } as any)
    .eq("id", archivoId)
    .eq("pedido_id", pedidoId);

  if (error) {
    const faltaColumnaEstado = error.message.includes("'estado' column of 'archivos_pedido'");
    if (!faltaColumnaEstado) return { error: error.message };

    const { error: pedidoError } = await supabase
      .from("pedidos")
      .update({ estado: nuevoEstado })
      .eq("id", pedidoId);

    if (pedidoError) return { error: pedidoError.message };

    revalidatePath(`/pedidos/${pedidoId}`);
    revalidatePath("/pedidos");
    return {
      ok: true,
      estadoPedido: nuevoEstado,
      warning: "Falta migrar archivos_pedido.estado; guarde el estado del pedido completo.",
    };
  }

  const { data: archivos, error: archivosError } = await supabase
    .from("archivos_pedido")
    .select("estado")
    .eq("pedido_id", pedidoId);

  if (archivosError) return { error: archivosError.message };

  const estados = (archivos ?? []).map((archivo: any) => archivo.estado || "Encargo recibido");
  const todosIguales = estados.length > 0 && estados.every((estado) => estado === estados[0]);
  const estadoPedido = todosIguales ? estados[0] : estadoMenosDesarrollado(estados);

  const { error: pedidoError } = await supabase
    .from("pedidos")
    .update({ estado: estadoPedido })
    .eq("id", pedidoId);

  if (pedidoError) return { error: pedidoError.message };

  revalidatePath(`/pedidos/${pedidoId}`);
  revalidatePath("/pedidos");
  return { ok: true, estadoPedido };
}
