import "server-only";

const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION?.trim() || "v26.0";
const META_FETCH_TIMEOUT_MS = 15_000;

export type ResultadoEnvioWhatsApp = {
  ok: boolean;
  proveedorId?: string;
  error?: string;
  data?: unknown;
};

export function normalizarTelefonoWhatsApp(telefono: string): string {
  let digitos = telefono.replace(/\D/g, "");
  if (digitos.startsWith("00")) digitos = digitos.slice(2);

  const prefijo = process.env.WHATSAPP_DEFAULT_COUNTRY_CODE?.replace(/\D/g, "") || "549";
  if (digitos.startsWith("549")) return digitos;
  if (digitos.startsWith("54")) {
    const nacional = digitos.slice(2);
    return nacional.startsWith("9") ? `54${nacional}` : `549${nacional}`;
  }

  digitos = digitos.replace(/^0+/, "");
  return `${prefijo}${digitos}`;
}

export function telefonoWhatsAppValido(telefono: string): boolean {
  return /^\d{10,15}$/.test(normalizarTelefonoWhatsApp(telefono));
}

function mensajeErrorMeta(data: unknown, fallback: string): string {
  if (!data || typeof data !== "object") return fallback;
  const error = (data as { error?: { message?: unknown; error_user_msg?: unknown } }).error;
  if (typeof error?.error_user_msg === "string") return error.error_user_msg;
  if (typeof error?.message === "string") return error.message;
  return fallback;
}

export async function enviarTextoWhatsApp(
  telefonoEntrada: string,
  contenido: string,
): Promise<ResultadoEnvioWhatsApp> {
  const token = process.env.META_WHATSAPP_TOKEN?.trim();
  const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID?.trim();
  if (!token || !phoneNumberId) {
    return { ok: false, error: "Faltan META_WHATSAPP_TOKEN o META_WHATSAPP_PHONE_NUMBER_ID." };
  }

  const telefono = normalizarTelefonoWhatsApp(telefonoEntrada);
  if (!telefonoWhatsAppValido(telefono)) {
    return { ok: false, error: "El teléfono no tiene un formato internacional válido." };
  }

  let response: Response;
  try {
    response = await fetch(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: telefono,
          type: "text",
          text: { preview_url: true, body: contenido },
        }),
        signal: AbortSignal.timeout(META_FETCH_TIMEOUT_MS),
      },
    );
  } catch (error) {
    const timeout = error instanceof DOMException && error.name === "TimeoutError";
    return {
      ok: false,
      error: timeout
        ? "Meta no respondió a tiempo. Podés reintentar el envío."
        : `No se pudo contactar a Meta: ${error instanceof Error ? error.message : "error desconocido"}`,
    };
  }

  const raw = await response.text();
  let data: unknown = null;
  if (raw) {
    try {
      data = JSON.parse(raw) as unknown;
    } catch {
      data = raw;
    }
  }

  if (!response.ok) {
    return { ok: false, error: mensajeErrorMeta(data, "Meta rechazó el mensaje."), data };
  }

  const proveedorId = (data as { messages?: Array<{ id?: string }> } | null)?.messages?.[0]?.id;
  return { ok: true, proveedorId, data };
}

export function describirMensajeMeta(mensaje: Record<string, unknown>): {
  tipoContenido: string;
  contenido: string;
} {
  const tipo = typeof mensaje.type === "string" ? mensaje.type : "unknown";
  const objeto = mensaje[tipo] as Record<string, unknown> | undefined;

  if (tipo === "text") {
    return { tipoContenido: "texto", contenido: String(objeto?.body || "") };
  }
  if (tipo === "button") {
    return { tipoContenido: "boton", contenido: String(objeto?.text || objeto?.payload || "Respuesta") };
  }
  if (tipo === "interactive") {
    const buttonReply = objeto?.button_reply as Record<string, unknown> | undefined;
    const listReply = objeto?.list_reply as Record<string, unknown> | undefined;
    return {
      tipoContenido: "interactivo",
      contenido: String(buttonReply?.title || listReply?.title || "Respuesta interactiva"),
    };
  }
  if (tipo === "image") {
    return { tipoContenido: "imagen", contenido: String(objeto?.caption || "Imagen recibida") };
  }
  if (tipo === "document") {
    return { tipoContenido: "documento", contenido: String(objeto?.filename || objeto?.caption || "Documento recibido") };
  }
  if (tipo === "audio" || tipo === "voice") {
    return { tipoContenido: "audio", contenido: "Audio recibido" };
  }
  if (tipo === "sticker") {
    return { tipoContenido: "sticker", contenido: "Sticker recibido" };
  }
  if (tipo === "location") {
    const latitud = objeto?.latitude;
    const longitud = objeto?.longitude;
    const ubicacion = latitud && longitud ? ` (${latitud}, ${longitud})` : "";
    return { tipoContenido: "ubicacion", contenido: `Ubicación recibida${ubicacion}` };
  }
  if (tipo === "contacts") {
    return { tipoContenido: "contacto", contenido: "Contacto recibido" };
  }

  return { tipoContenido: tipo, contenido: `Mensaje recibido (${tipo})` };
}
