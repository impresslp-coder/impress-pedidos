import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { describirMensajeMeta, normalizarTelefonoWhatsApp } from "@/lib/whatsapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type JsonRecord = Record<string, unknown>;

function registro(valor: unknown): JsonRecord | null {
  return valor && typeof valor === "object" && !Array.isArray(valor) ? valor as JsonRecord : null;
}

function lista(valor: unknown): unknown[] {
  return Array.isArray(valor) ? valor : [];
}

function firmaValida(cuerpo: string, firma: string | null): boolean {
  const secreto = process.env.META_APP_SECRET?.trim();
  if (!secreto || !firma?.startsWith("sha256=")) return false;
  const hexadecimal = firma.slice("sha256=".length).trim();
  if (!/^[0-9a-f]{64}$/i.test(hexadecimal)) return false;

  const esperada = createHmac("sha256", secreto).update(cuerpo, "utf8").digest();
  const recibida = Buffer.from(hexadecimal, "hex");
  return esperada.length === recibida.length && timingSafeEqual(esperada, recibida);
}

async function buscarClientePorTelefono(admin: ReturnType<typeof createAdminClient>, telefono: string) {
  const sufijo = telefono.slice(-8);
  const { data } = await admin
    .from("clientes")
    .select("id, nombre, telefono, cod_pais")
    .ilike("telefono", `%${sufijo}%`)
    .limit(20);

  const coincidencias = (data ?? []).filter((cliente: { telefono?: string | null; cod_pais?: string | null }) => {
    const guardado = `${cliente.cod_pais ?? ""}${cliente.telefono ?? ""}`.replace(/\D/g, "");
    return guardado.endsWith(sufijo);
  });
  return coincidencias.length === 1 ? coincidencias[0] : null;
}

async function obtenerConversacion(
  admin: ReturnType<typeof createAdminClient>,
  telefono: string,
  nombreContacto: string | null,
) {
  const { data: existente } = await admin
    .from("whatsapp_conversaciones")
    .select("id, cliente_id")
    .eq("telefono", telefono)
    .maybeSingle();

  const cliente = existente?.cliente_id ? null : await buscarClientePorTelefono(admin, telefono);
  if (existente) {
    const cambios: Record<string, unknown> = {};
    if (nombreContacto) cambios.nombre_contacto = nombreContacto;
    if (cliente?.id) cambios.cliente_id = cliente.id;
    if (Object.keys(cambios).length) {
      await admin.from("whatsapp_conversaciones").update(cambios).eq("id", existente.id);
    }
    return { id: existente.id as string, clienteId: (existente.cliente_id ?? cliente?.id ?? null) as string | null };
  }

  const { data: creada, error } = await admin
    .from("whatsapp_conversaciones")
    .insert({
      telefono,
      nombre_contacto: nombreContacto,
      cliente_id: cliente?.id ?? null,
    })
    .select("id, cliente_id")
    .single();

  if (!error && creada) return { id: creada.id as string, clienteId: creada.cliente_id as string | null };

  // Dos eventos simultáneos pueden intentar abrir la misma conversación.
  const { data: recuperada } = await admin
    .from("whatsapp_conversaciones")
    .select("id, cliente_id")
    .eq("telefono", telefono)
    .single();
  if (!recuperada) throw error ?? new Error("No se pudo crear la conversación de WhatsApp.");
  return { id: recuperada.id as string, clienteId: recuperada.cliente_id as string | null };
}

async function procesarEstados(admin: ReturnType<typeof createAdminClient>, value: JsonRecord) {
  const equivalencias: Record<string, string> = {
    sent: "enviado",
    delivered: "entregado",
    read: "leido",
    failed: "error",
  };

  for (const estadoRaw of lista(value.statuses)) {
    const estado = registro(estadoRaw);
    if (!estado || typeof estado.id !== "string" || typeof estado.status !== "string") continue;
    const nuevoEstado = equivalencias[estado.status];
    if (!nuevoEstado) continue;
    const errores = lista(estado.errors);
    const primerError = registro(errores[0]);
    const titulo = typeof primerError?.title === "string" ? primerError.title : null;

    await admin
      .from("whatsapp_mensajes")
      .update({
        estado: nuevoEstado,
        error_mensaje: nuevoEstado === "error" ? titulo || "Meta informó un error de entrega." : null,
      })
      .eq("proveedor_id", estado.id);
  }
}

async function procesarMensajes(admin: ReturnType<typeof createAdminClient>, value: JsonRecord) {
  const contacts = lista(value.contacts).map(registro).filter(Boolean) as JsonRecord[];
  const nombres = new Map<string, string>();
  for (const contacto of contacts) {
    const profile = registro(contacto.profile);
    if (typeof contacto.wa_id === "string" && typeof profile?.name === "string") {
      nombres.set(contacto.wa_id, profile.name);
    }
  }

  for (const mensajeRaw of lista(value.messages)) {
    const mensaje = registro(mensajeRaw);
    if (!mensaje || typeof mensaje.id !== "string" || typeof mensaje.from !== "string") continue;
    const telefono = normalizarTelefonoWhatsApp(mensaje.from);
    const conversacion = await obtenerConversacion(admin, telefono, nombres.get(mensaje.from) ?? null);
    const detalle = describirMensajeMeta(mensaje);
    const timestamp = typeof mensaje.timestamp === "string"
      ? new Date(Number(mensaje.timestamp) * 1000).toISOString()
      : new Date().toISOString();

    const { error } = await admin.from("whatsapp_mensajes").upsert({
      conversacion_id: conversacion.id,
      cliente_id: conversacion.clienteId,
      tipo: "entrante",
      tipo_contenido: detalle.tipoContenido,
      contenido: detalle.contenido,
      estado: "recibido",
      proveedor_id: mensaje.id,
      metadata: { meta: mensaje },
      recibido_en: timestamp,
      creado_en: timestamp,
    }, { onConflict: "proveedor_id", ignoreDuplicates: true });

    if (error) console.error("[WhatsApp] No se pudo registrar un mensaje entrante", error.message);
  }
}

export async function POST(request: NextRequest) {
  const cuerpo = await request.text();
  const modoFirma = process.env.WHATSAPP_WEBHOOK_FIRMA?.trim()
    || (process.env.NODE_ENV === "production" ? "exigir" : "registrar");
  const esFirmaValida = firmaValida(cuerpo, request.headers.get("x-hub-signature-256"));

  if (!esFirmaValida && modoFirma === "exigir") {
    return NextResponse.json({ error: "Firma de webhook inválida." }, { status: 401 });
  }
  if (!esFirmaValida) console.warn("[WhatsApp] Webhook recibido sin una firma válida (modo registrar)." );

  let body: JsonRecord;
  try {
    body = JSON.parse(cuerpo) as JsonRecord;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    for (const entryRaw of lista(body.entry)) {
      const entry = registro(entryRaw);
      if (!entry) continue;
      for (const changeRaw of lista(entry.changes)) {
        const change = registro(changeRaw);
        const value = registro(change?.value);
        if (!value) continue;
        await procesarEstados(admin, value);
        await procesarMensajes(admin, value);
      }
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[WhatsApp] Error procesando webhook", error);
    return NextResponse.json({ error: "No se pudo procesar el webhook." }, { status: 500 });
  }
}

export function GET(request: NextRequest) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const esperado = process.env.META_WEBHOOK_VERIFY_TOKEN?.trim();

  if (mode === "subscribe" && challenge && esperado && token === esperado) {
    return new NextResponse(challenge, { status: 200 });
  }
  if (challenge) return NextResponse.json({ error: "Verify token inválido." }, { status: 403 });
  return NextResponse.json({ ok: true, webhook: "impress-whatsapp" });
}
