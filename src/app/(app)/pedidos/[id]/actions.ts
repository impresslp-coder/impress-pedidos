"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function convertirEnPedido(pedidoId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("pedidos")
    .update({ estado: "Encargo recibido" })
    .eq("id", pedidoId)
    .eq("estado", "Presupuesto");

  if (error) return { error: error.message };

  revalidatePath(`/pedidos/${pedidoId}`);
  revalidatePath("/pedidos");
  return { ok: true };
}

export async function actualizarEstado(pedidoId: string, nuevoEstado: string) {
  if (nuevoEstado === "En producción") {
    return { error: "Para iniciar Producción usá la acción de tomar el pedido." };
  }
  const supabase = await createClient();
  if (nuevoEstado === "Listo para entregar") {
    const { data: pedido, error: pedidoError } = await supabase
      .from("pedidos")
      .select("ubicacion")
      .eq("id", pedidoId)
      .single();
    if (pedidoError) return { error: pedidoError.message };
    if (!pedido?.ubicacion?.trim()) {
      return { error: "Indicá la ubicación física antes de pasar el pedido a Listo para entregar." };
    }
  }
  const { error } = await supabase
    .from("pedidos")
    .update({ estado: nuevoEstado })
    .eq("id", pedidoId);

  if (error) return { error: error.message };

  revalidatePath(`/pedidos/${pedidoId}`);
  revalidatePath("/pedidos");
  return { ok: true };
}

export async function tomarPedidoEnProduccion(pedidoId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const { data, error } = await supabase.rpc("tomar_pedido_en_produccion", {
    p_pedido_id: pedidoId,
    p_usuario_id: user.id,
  });
  if (error) return { error: error.message };

  const { data: perfil } = await supabase
    .from("usuarios_sistema")
    .select("nombre")
    .eq("id", user.id)
    .maybeSingle();

  revalidatePath(`/pedidos/${pedidoId}`);
  revalidatePath("/pedidos");
  const row = Array.isArray(data) ? data[0] : data;
  return {
    ok: true,
    venceEn: (row as { vence_en?: string } | null)?.vence_en ?? null,
    iniciadoEn: new Date().toISOString(),
    responsable: perfil?.nombre ?? null,
  };
}

export async function registrarMensajeWhatsApp(pedidoId: string, plantilla: "retiro" | "envio") {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const { data: pedido, error: pedidoError } = await supabase
    .from("pedidos")
    .select("estado")
    .eq("id", pedidoId)
    .single();
  if (pedidoError) return { error: pedidoError.message };
  if (!["Listo para entregar", "Entregado"].includes(String(pedido?.estado ?? ""))) {
    return { error: "El aviso de WhatsApp solo se registra cuando el pedido está listo para entregar." };
  }

  const { data: plantillaActiva, error: plantillaError } = await supabase
    .from("plantillas_mensaje")
    .select("codigo")
    .eq("codigo", plantilla)
    .eq("activo", true)
    .maybeSingle();
  if (plantillaError) return { error: plantillaError.message };
  if (!plantillaActiva) return { error: "La plantilla de WhatsApp no está disponible." };

  const { data: perfil } = await supabase
    .from("usuarios_sistema")
    .select("nombre")
    .eq("id", user.id)
    .maybeSingle();
  const { data, error } = await supabase
    .from("mensajes_enviados")
    .insert({ pedido_id: pedidoId, plantilla, enviado_por: user.id })
    .select("id, enviado_en, plantilla")
    .single();
  if (error || !data) return { error: error?.message ?? "No pude registrar el aviso." };

  revalidatePath(`/pedidos/${pedidoId}`);
  return { ok: true, mensaje: { ...data, enviado_por_nombre: perfil?.nombre ?? null } };
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

const PRIORIDADES_VALIDAS = ["baja", "normal", "alta"] as const;

async function puedeGestionarPrioridad() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: perfil } = await supabase
    .from("usuarios_sistema")
    .select("rol")
    .eq("id", user.id)
    .maybeSingle();
  return perfil?.rol === "admin";
}

export async function guardarDetallePedido(pedidoId: string, formData: FormData) {
  const supabase = await createClient();
  const esSupervisor = await puedeGestionarPrioridad();
  const estadoSolicitado = String(formData.get("estado") ?? "").trim();

  if (estadoSolicitado === "En producción") {
    return { error: "Para iniciar Producción usá la acción de tomar el pedido." };
  }
  if (estadoSolicitado === "Listo para entregar") {
    const { data: pedido, error } = await supabase
      .from("pedidos")
      .select("ubicacion")
      .eq("id", pedidoId)
      .single();
    if (error) return { error: error.message };
    if (!pedido?.ubicacion?.trim()) {
      return { error: "Indicá la ubicación física antes de pasar el pedido a Listo para entregar." };
    }
  }

  const pedidoUpdate = {
    fecha: emptyToNull(formData.get("fecha")),
    estado: emptyToNull(formData.get("estado")),
    senia: numOrNull(formData.get("senia")) ?? 0,
    medio_pago: emptyToNull(formData.get("medio_pago")),
    via_contacto: emptyToNull(formData.get("via_contacto")),
    mensaje: emptyToNull(formData.get("mensaje")),
    telefono_contacto: emptyToNull(formData.get("telefono_contacto")),
    quien_cargo_codigo: emptyToNull(formData.get("quien_cargo_codigo")),
    sucursal_produccion: emptyToNull(formData.get("sucursal_produccion")),
    sucursal_retiro: emptyToNull(formData.get("sucursal_retiro")),
    ubicacion: emptyToNull(formData.get("ubicacion")),
    ubicacion_actualizada_en: new Date().toISOString(),
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

    const prioridadSolicitada = String(item.prioridad ?? "normal").trim().toLowerCase();
    if (esSupervisor && !PRIORIDADES_VALIDAS.includes(prioridadSolicitada as typeof PRIORIDADES_VALIDAS[number])) {
      return { error: "La prioridad del ítem no es válida." };
    }
    const itemUpdate: Record<string, unknown> = {
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
    };
    if (esSupervisor) itemUpdate.prioridad = prioridadSolicitada;

    const { error } = await supabase
      .from("items_pedido")
      .update(itemUpdate as any)
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
  "En producción",
  "Listo para entregar",
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
