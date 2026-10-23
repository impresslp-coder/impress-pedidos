/**
 * Endpoint para recibir pedidos desde WooCommerce (impress.test).
 *
 * Auth: header `X-API-KEY` debe coincidir con `WC_API_KEY` del .env.
 * Flujo:
 *  1) Buscar cliente por email (mail). Si no existe, crearlo.
 *  2) Generar número de pedido y código único.
 *  3) Crear pedido con estado "Presupuesto" (operador confirma pago luego).
 *  4) Si viene archivo_url, descargarlo y subirlo a Supabase Storage.
 *  5) Insertar items_pedido.
 *  6) Devolver { ok, numero, codigoUnico, pedido_id }.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { uploadArchivoToStorage } from "@/lib/supabase-storage";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const MAX_ARCHIVO_BYTES = 50 * 1024 * 1024;

type WcItem = {
  producto: string;
  paginas?: number;
  modo?: string;
  anotacion?: string;
  precio: number;
};

type WcPayload = {
  wc_order_id: number;
  cliente: { nombre: string; email: string; telefono?: string };
  items: WcItem[];
  archivo_url?: string;
  archivo_nombre?: string;
  total?: number;
  medio_pago?: string;
  mensaje?: string;
};

function generarCodigoCliente(nombre: string, telefono: string): string {
  const nom = nombre.replace(/\s/g, "").toUpperCase();
  const tel = telefono.replace(/\D/g, "");
  return (
    nom.substring(0, 3).padEnd(3, "X") +
    (tel ? tel.slice(-3) : "000") +
    nom.slice(-3).padStart(3, "X")
  );
}

function generarCodigoUnico(numero: string): string {
  const year = new Date().getFullYear();
  const rand = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `IMP-${year}-${numero}-${rand}`;
}

async function descargarArchivo(urlRaw: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const url = new URL(urlRaw);
  if (url.protocol !== "https:") throw new Error("archivo_url debe usar HTTPS");

  const resp = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!resp.ok) throw new Error(`Descarga HTTP ${resp.status}`);

  const largo = Number(resp.headers.get("content-length") || 0);
  if (largo > MAX_ARCHIVO_BYTES) throw new Error("El archivo supera el límite de 50 MB");

  const buffer = Buffer.from(await resp.arrayBuffer());
  if (buffer.length > MAX_ARCHIVO_BYTES) throw new Error("El archivo supera el límite de 50 MB");

  return {
    buffer,
    mimeType: resp.headers.get("content-type")?.split(";")[0] || "application/octet-stream",
  };
}

function jsonError(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

export async function POST(req: NextRequest) {
  // 1) Validar API key
  const apiKey = req.headers.get("x-api-key");
  const expected = process.env.WC_API_KEY?.trim();
  if (!expected) return jsonError("WC_API_KEY no configurada en el servidor", 500);
  if (apiKey !== expected) return jsonError("API key inválida", 401);

  // 2) Validar body
  let body: WcPayload;
  try {
    body = await req.json();
  } catch {
    return jsonError("Body JSON inválido");
  }

  if (!body.cliente?.email) return jsonError("Falta cliente.email");
  if (!body.cliente?.nombre) return jsonError("Falta cliente.nombre");
  if (!Array.isArray(body.items) || !body.items.length) return jsonError("items vacío");
  if (!body.wc_order_id) return jsonError("Falta wc_order_id");

  const supabase = createAdminClient();

  // 3) Idempotencia: si ya existe un pedido con este wc_order_id en mensaje, devolverlo
  const tagWc = `[WC#${body.wc_order_id}]`;
  {
    const { data: existente } = await supabase
      .from("pedidos")
      .select("id, numero, codigo_unico")
      .like("mensaje", `%${tagWc}%`)
      .maybeSingle();
    if (existente) {
      return NextResponse.json({
        ok: true,
        pedido_id: existente.id,
        numero: existente.numero,
        codigoUnico: existente.codigo_unico,
        duplicado: true,
      });
    }
  }

  // 4) Buscar / crear cliente
  const email = body.cliente.email.trim().toLowerCase();
  let clienteId: string | null = null;

  const { data: clienteExistente } = await supabase
    .from("clientes")
    .select("id")
    .ilike("mail", email)
    .maybeSingle();

  if (clienteExistente) {
    clienteId = clienteExistente.id;
  } else {
    const nombre = body.cliente.nombre.trim();
    const telefono = (body.cliente.telefono || "").trim();
    let codigo = generarCodigoCliente(nombre, telefono);

    // Asegurar unicidad del código (sufijo numérico si choca)
    for (let i = 0; i < 5; i++) {
      const { data: choca } = await supabase
        .from("clientes")
        .select("id")
        .eq("codigo", codigo)
        .maybeSingle();
      if (!choca) break;
      codigo = generarCodigoCliente(nombre, telefono).slice(0, -1) + i;
    }

    const { data: nuevoCliente, error: errCli } = await supabase
      .from("clientes")
      .insert({
        codigo,
        nombre,
        telefono: telefono || null,
        mail: email,
        cod_pais: "54",
      })
      .select("id")
      .single();

    if (errCli || !nuevoCliente) return jsonError(`Error al crear cliente: ${errCli?.message}`, 500);
    clienteId = nuevoCliente.id;
  }

  // 5) Generar número de pedido
  const { data: counter, error: errCounter } = await supabase.rpc("next_counter", { p_nombre: "pedidos" });
  if (errCounter) return jsonError(`Error al generar número: ${errCounter.message}`, 500);

  const numero = String(counter).padStart(7, "0");
  const codigoUnico = generarCodigoUnico(numero);

  // 6) Crear pedido como "Presupuesto"
  const mensajeBase = body.mensaje?.trim() || "";
  const mensajeFinal = `${tagWc}${mensajeBase ? " " + mensajeBase : ""}`;

  const { data: pedido, error: errPedido } = await supabase
    .from("pedidos")
    .insert({
      numero,
      codigo_unico: codigoUnico,
      cliente_id: clienteId,
      estado: "Presupuesto",
      senia: 0,
      medio_pago: body.medio_pago || null,
      via_contacto: "Web",
      prioridad: "normal",
      mensaje: mensajeFinal,
      telefono_contacto: body.cliente.telefono || null,
    })
    .select("id")
    .single();

  if (errPedido || !pedido) return jsonError(`Error al crear pedido: ${errPedido?.message}`, 500);

  // 7) Insertar items
  const itemsInsert = body.items.map((it) => ({
    pedido_id: pedido.id,
    producto: it.producto,
    anotacion: it.anotacion || null,
    paginas: it.paginas || null,
    modo: it.modo || null,
    precio: it.precio,
    descuento: 0,
    estado: "Presupuesto",
  }));

  const { error: errItems } = await supabase.from("items_pedido").insert(itemsInsert);
  if (errItems) {
    // rollback manual del pedido
    await supabase.from("pedidos").delete().eq("id", pedido.id);
    return jsonError(`Error al guardar items: ${errItems.message}`, 500);
  }

  // 8) Descargar y registrar el archivo (opcional; el pedido no falla si la copia falla)
  let archivoCargado = false;
  if (body.archivo_url && body.archivo_nombre) {
    try {
      const { buffer, mimeType } = await descargarArchivo(body.archivo_url);
      const nombre = `${codigoUnico}-${body.archivo_nombre}`;
      const storagePath = await uploadArchivoToStorage(pedido.id, nombre, buffer, mimeType);
      const { error: errArchivo } = await supabase.from("archivos_pedido").insert({
        pedido_id: pedido.id,
        nombre_archivo: nombre,
        storage_path: storagePath,
      });
      if (errArchivo) throw errArchivo;
      archivoCargado = true;
    } catch (e) {
      console.error("[wc/pedido] Error copiando archivo a Storage:", e);
    }
  }

  // 9) Log
  await supabase.from("registro").insert({
    referencia: numero,
    mensaje: `Pedido recibido desde Web (WC #${body.wc_order_id}) — ${itemsInsert.length} item(s)`,
  });

  return NextResponse.json({
    ok: true,
    pedido_id: pedido.id,
    numero,
    codigoUnico,
    archivoCargado,
  });
}
