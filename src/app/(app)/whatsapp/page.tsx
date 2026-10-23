import { createAdminClient } from "@/lib/supabase/admin";
import { normalizarTelefonoWhatsApp } from "@/lib/whatsapp";
import {
  CrmClient,
  type ClienteWhatsapp,
  type ConversacionWhatsapp,
  type MensajeWhatsapp,
  type PedidoWhatsapp,
} from "./crm-client";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ telefono?: string }> };

function relacionUno<T>(valor: T | T[] | null | undefined): T | null {
  if (Array.isArray(valor)) return valor[0] ?? null;
  return valor ?? null;
}

function inicioDiaArgentina() {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return new Date(`${partes}T00:00:00-03:00`).toISOString();
}

export default async function WhatsAppPage({ searchParams }: PageProps) {
  const { telefono: telefonoParam } = await searchParams;
  const admin = createAdminClient();

  const { data: filasConversacion, error: errorConversaciones } = await admin
    .from("whatsapp_conversaciones")
    .select("id, telefono, nombre_contacto, ultimo_mensaje, ultimo_mensaje_en, ultimo_mensaje_tipo, no_leidos, clientes(id, nombre, telefono, cod_pais, mail)")
    .eq("estado", "abierta")
    .order("ultimo_mensaje_en", { ascending: false, nullsFirst: false })
    .limit(200);

  if (errorConversaciones) {
    const faltaTabla = errorConversaciones.code === "42P01" || errorConversaciones.message.includes("schema cache");
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-amber-200 bg-amber-50 p-8 shadow-sm">
        <h1 className="text-xl font-black text-zinc-900">WhatsApp CRM todavía no está activado en Supabase</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          {faltaTabla
            ? "El frontend ya está preparado. Falta ejecutar la migración del CRM en el SQL Editor del proyecto de IMPRESS."
            : `Supabase respondió: ${errorConversaciones.message}`}
        </p>
        <code className="mt-4 block rounded-xl bg-zinc-900 px-4 py-3 text-xs text-zinc-100">
          supabase/migrations/20261023_whatsapp_crm.sql
        </code>
      </div>
    );
  }

  const conversaciones: ConversacionWhatsapp[] = (filasConversacion ?? []).map((fila: Record<string, any>) => ({
    id: fila.id,
    telefono: fila.telefono,
    nombreContacto: fila.nombre_contacto,
    ultimoMensaje: fila.ultimo_mensaje,
    ultimoMensajeEn: fila.ultimo_mensaje_en,
    ultimoMensajeTipo: fila.ultimo_mensaje_tipo,
    noLeidos: Number(fila.no_leidos) || 0,
    cliente: relacionUno(fila.clientes) as ClienteWhatsapp | null,
  }));

  const telefonoSeleccionado = telefonoParam ? normalizarTelefonoWhatsApp(telefonoParam) : conversaciones[0]?.telefono;
  const seleccionada = conversaciones.find((conversacion) => conversacion.telefono === telefonoSeleccionado) ?? null;

  let mensajes: MensajeWhatsapp[] = [];
  let pedidos: PedidoWhatsapp[] = [];
  let ventanaAbierta = false;

  if (seleccionada) {
    const [{ data: filasMensaje }, { data: ultimoEntrante }] = await Promise.all([
      admin
        .from("whatsapp_mensajes")
        .select("id, tipo, tipo_contenido, contenido, estado, error_mensaje, creado_en")
        .eq("conversacion_id", seleccionada.id)
        .order("creado_en", { ascending: false })
        .limit(120),
      admin
        .from("whatsapp_mensajes")
        .select("recibido_en, creado_en")
        .eq("conversacion_id", seleccionada.id)
        .eq("tipo", "entrante")
        .order("creado_en", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    mensajes = (filasMensaje ?? []).reverse().map((fila: Record<string, any>) => ({
      id: fila.id,
      tipo: fila.tipo,
      tipoContenido: fila.tipo_contenido,
      contenido: fila.contenido,
      estado: fila.estado,
      errorMensaje: fila.error_mensaje,
      creadoEn: fila.creado_en,
    }));

    const fechaEntrante = ultimoEntrante?.recibido_en || ultimoEntrante?.creado_en;
    ventanaAbierta = Boolean(fechaEntrante && Date.now() - new Date(fechaEntrante).getTime() < 24 * 60 * 60 * 1000);

    if (seleccionada.cliente?.id) {
      const { data: filasPedido } = await admin
        .from("pedidos")
        .select("id, numero, estado, fecha")
        .eq("cliente_id", seleccionada.cliente.id)
        .order("creado_en", { ascending: false })
        .limit(6);
      pedidos = (filasPedido ?? []).map((fila: Record<string, any>) => ({
        id: fila.id,
        numero: fila.numero,
        estado: fila.estado,
        fecha: fila.fecha,
      }));
    }
  }

  const { count: mensajesHoy } = await admin
    .from("whatsapp_mensajes")
    .select("id", { count: "exact", head: true })
    .gte("creado_en", inicioDiaArgentina());

  return (
    <CrmClient
      conversaciones={conversaciones}
      seleccionada={seleccionada}
      mensajes={mensajes}
      pedidos={pedidos}
      configurada={Boolean(process.env.META_WHATSAPP_TOKEN && process.env.META_WHATSAPP_PHONE_NUMBER_ID)}
      ventanaAbierta={ventanaAbierta}
      stats={{
        conversaciones: conversaciones.length,
        noLeidos: conversaciones.reduce((total, conversacion) => total + conversacion.noLeidos, 0),
        mensajesHoy: mensajesHoy ?? 0,
      }}
    />
  );
}
