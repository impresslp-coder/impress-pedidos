"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  enviarTextoWhatsApp,
  normalizarTelefonoWhatsApp,
  telefonoWhatsAppValido,
} from "@/lib/whatsapp";

export type ResultadoAccionWhatsapp = {
  ok: boolean;
  error?: string;
  telefono?: string;
};

async function exigirUsuario() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sesión vencida.");
  return user;
}

async function buscarCliente(admin: ReturnType<typeof createAdminClient>, telefono: string) {
  const sufijo = telefono.slice(-8);
  const { data } = await admin
    .from("clientes")
    .select("id, telefono, cod_pais")
    .ilike("telefono", `%${sufijo}%`)
    .limit(20);
  const coincidencias = (data ?? []).filter((cliente: { telefono?: string | null; cod_pais?: string | null }) => {
    const guardado = `${cliente.cod_pais ?? ""}${cliente.telefono ?? ""}`.replace(/\D/g, "");
    return guardado.endsWith(sufijo);
  });
  return coincidencias.length === 1 ? coincidencias[0] : null;
}

async function obtenerOCrearConversacion(telefono: string) {
  const admin = createAdminClient();
  const { data: existente } = await admin
    .from("whatsapp_conversaciones")
    .select("id, cliente_id")
    .eq("telefono", telefono)
    .maybeSingle();
  if (existente) return existente as { id: string; cliente_id: string | null };

  const cliente = await buscarCliente(admin, telefono);
  const { data, error } = await admin
    .from("whatsapp_conversaciones")
    .insert({ telefono, cliente_id: cliente?.id ?? null })
    .select("id, cliente_id")
    .single();
  if (error) throw new Error(error.message);
  return data as { id: string; cliente_id: string | null };
}

export async function abrirConversacionWhatsapp(telefonoEntrada: string): Promise<ResultadoAccionWhatsapp> {
  try {
    await exigirUsuario();
    const telefono = normalizarTelefonoWhatsApp(telefonoEntrada);
    if (!telefonoWhatsAppValido(telefono)) {
      return { ok: false, error: "Ingresá un teléfono válido con código de área." };
    }
    await obtenerOCrearConversacion(telefono);
    revalidatePath("/whatsapp");
    return { ok: true, telefono };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "No se pudo abrir la conversación." };
  }
}

export async function marcarConversacionWhatsappLeida(conversacionId: string) {
  await exigirUsuario();
  const admin = createAdminClient();
  await admin
    .from("whatsapp_conversaciones")
    .update({ no_leidos: 0, actualizado_en: new Date().toISOString() })
    .eq("id", conversacionId);
  revalidatePath("/whatsapp");
}

export async function enviarMensajeWhatsapp(
  conversacionId: string,
  telefonoEntrada: string,
  contenidoEntrada: string,
): Promise<ResultadoAccionWhatsapp> {
  try {
    await exigirUsuario();
    const contenido = contenidoEntrada.trim();
    const telefono = normalizarTelefonoWhatsApp(telefonoEntrada);
    if (!contenido) return { ok: false, error: "Escribí un mensaje antes de enviar." };
    if (contenido.length > 4096) return { ok: false, error: "El mensaje supera los 4096 caracteres." };
    if (!telefonoWhatsAppValido(telefono)) return { ok: false, error: "El teléfono no es válido." };

    const admin = createAdminClient();
    const { data: conversacion } = await admin
      .from("whatsapp_conversaciones")
      .select("id, cliente_id")
      .eq("id", conversacionId)
      .eq("telefono", telefono)
      .maybeSingle();
    if (!conversacion) return { ok: false, error: "La conversación ya no existe." };

    const resultado = await enviarTextoWhatsApp(telefono, contenido);
    const ahora = new Date().toISOString();
    const { error: errorRegistro } = await admin.from("whatsapp_mensajes").insert({
      conversacion_id: conversacion.id,
      cliente_id: conversacion.cliente_id,
      tipo: "saliente",
      tipo_contenido: "texto",
      contenido,
      estado: resultado.ok ? "enviado" : "error",
      proveedor_id: resultado.proveedorId ?? null,
      error_mensaje: resultado.error ?? null,
      metadata: {},
      enviado_en: resultado.ok ? ahora : null,
      creado_en: ahora,
    });

    if (errorRegistro) {
      return { ok: false, error: `Meta procesó el envío, pero no se pudo guardar: ${errorRegistro.message}` };
    }
    revalidatePath("/whatsapp");
    return resultado.ok ? { ok: true, telefono } : { ok: false, error: resultado.error };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "No se pudo enviar el mensaje." };
  }
}
