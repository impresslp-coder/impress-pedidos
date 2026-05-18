"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

type MovimientoSucursal = { pedidoId: string; sucursal: string | null };
type UbicacionUpdate = { pedidoId: string; ubicacion: string };
type MercadoPagoMovimiento = { id: string; amount: number; date_approved?: string | null; date_created?: string | null };

async function validarOperador(codigoPersonal: string) {
  const admin = createAdminClient();
  const codigo = codigoPersonal.trim();
  if (!codigo) return { error: "Ingresa tu codigo personal" } as const;

  const { data, error } = await admin
    .from("usuarios_sistema")
    .select("id, nombre, codigo_personal, activo")
    .eq("codigo_personal", codigo)
    .eq("activo", true)
    .maybeSingle();

  if (error) return { error: error.message } as const;
  if (!data) return { error: "Codigo personal incorrecto" } as const;
  return { admin, operador: data as { id: string; nombre?: string | null } } as const;
}

function missingColumn(error: { message?: string } | null | undefined, column: string) {
  return !!error?.message?.includes(`'${column}' column`);
}

function revalidarPedidos(ids: string[] = []) {
  revalidatePath("/pedidos");
  for (const id of ids) revalidatePath(`/pedidos/${id}`);
}

function mpFallbackText(mercadoPago: MercadoPagoMovimiento) {
  const hora = mercadoPago.date_approved ?? mercadoPago.date_created ?? "";
  return `MP: ${mercadoPago.id} | Monto: ${mercadoPago.amount} | Hora: ${hora}`;
}

function stripMpFallback(message: string) {
  return message
    .split("\n")
    .filter((line) => !line.trim().startsWith("MP:"))
    .join("\n")
    .trim();
}

export async function entregarPedidoRapido(
  pedidoId: string,
  medioPagoRestante: string,
  codigoPersonal: string,
  mercadoPago?: MercadoPagoMovimiento | null,
) {
  const validacion = await validarOperador(codigoPersonal);
  if ("error" in validacion) return { error: validacion.error };
  const { admin, operador } = validacion;

  const { data: pedido, error: pedidoError } = await admin
    .from("pedidos")
    .select("id, estado, mensaje, items_pedido(precio)")
    .eq("id", pedidoId)
    .single();

  if (pedidoError || !pedido) return { error: pedidoError?.message ?? "Pedido no encontrado" };
  if ((pedido as any).estado !== "Listo para retirar") {
    return { error: "El pedido no esta listo para entregar" };
  }

  const total = ((pedido as any).items_pedido ?? []).reduce(
    (acc: number, item: any) => acc + (Number(item.precio) || 0),
    0,
  );

  const { error } = await admin
    .from("pedidos")
    .update({
      estado: "Entregado",
      senia: total,
      medio_pago: medioPagoRestante || null,
    } as any)
    .eq("id", pedidoId);

  if (error) return { error: error.message };

  if (mercadoPago?.id) {
    let mpUpdate = await admin
      .from("pedidos")
      .update({
        mercado_pago_payment_id: mercadoPago.id,
        mercado_pago_monto: Number(mercadoPago.amount) || null,
        mercado_pago_hora: mercadoPago.date_approved ?? mercadoPago.date_created ?? null,
      } as any)
      .eq("id", pedidoId);
    if (mpUpdate.error && missingColumn(mpUpdate.error, "mercado_pago_hora")) {
      mpUpdate = await admin
        .from("pedidos")
        .update({
          mercado_pago_payment_id: mercadoPago.id,
          mercado_pago_monto: Number(mercadoPago.amount) || null,
        } as any)
        .eq("id", pedidoId);
    }
    if (mpUpdate.error && missingColumn(mpUpdate.error, "mercado_pago_monto")) {
      mpUpdate = await admin
        .from("pedidos")
        .update({ mercado_pago_payment_id: mercadoPago.id } as any)
        .eq("id", pedidoId);
    }
    if (mpUpdate.error && missingColumn(mpUpdate.error, "mercado_pago_payment_id")) {
      const currentMsg = stripMpFallback(String((pedido as any).mensaje ?? ""));
      const nextMsg = currentMsg.includes(`MP: ${mercadoPago.id}`)
        ? currentMsg
        : [currentMsg, mpFallbackText(mercadoPago)].filter(Boolean).join("\n");
      mpUpdate = await admin
        .from("pedidos")
        .update({ mensaje: nextMsg } as any)
        .eq("id", pedidoId);
    }
    if (mpUpdate.error) {
      return { error: mpUpdate.error.message };
    }
  }

  revalidarPedidos([pedidoId]);
  return { ok: true, operador: operador.nombre ?? "" };
}

export async function moverPedidosSucursal(movimientos: MovimientoSucursal[], codigoPersonal: string) {
  const validacion = await validarOperador(codigoPersonal);
  if ("error" in validacion) return { error: validacion.error };
  const { admin } = validacion;

  const ids: string[] = [];
  for (const mov of movimientos) {
    if (!mov.pedidoId) continue;
    ids.push(mov.pedidoId);
    const { error } = await admin
      .from("pedidos")
      .update({
        sucursal: mov.sucursal || null,
      } as any)
      .eq("id", mov.pedidoId);
    if (error) return { error: error.message };
  }

  revalidarPedidos(ids);
  return { ok: true };
}

export async function guardarUbicacionesPedido(updates: UbicacionUpdate[], codigoPersonal: string) {
  const validacion = await validarOperador(codigoPersonal);
  if ("error" in validacion) return { error: validacion.error };
  const { admin } = validacion;

  const ids: string[] = [];
  for (const update of updates) {
    if (!update.pedidoId) continue;
    ids.push(update.pedidoId);
    const { error } = await admin
      .from("pedidos")
      .update({
        ubicacion: update.ubicacion.trim() || null,
      } as any)
      .eq("id", update.pedidoId);
    if (error) return { error: error.message };
  }

  revalidarPedidos(ids);
  return { ok: true };
}

export async function eliminarPedidoOperacion(pedidoId: string, codigoPersonal: string) {
  const validacion = await validarOperador(codigoPersonal);
  if ("error" in validacion) return { error: validacion.error };
  const { admin } = validacion;

  let { error } = await admin
    .from("pedidos")
    .update({
      eliminado: true,
    } as any)
    .eq("id", pedidoId);

  if (missingColumn(error, "eliminado")) {
    const fallback = await admin
      .from("pedidos")
      .update({ estado: "Eliminado" } as any)
      .eq("id", pedidoId);
    error = fallback.error;
  }

  if (error) return { error: error.message };
  revalidarPedidos([pedidoId]);
  return { ok: true };
}

export async function registrarQuejaPedido(pedidoId: string, motivo: string, codigoPersonal: string) {
  const validacion = await validarOperador(codigoPersonal);
  if ("error" in validacion) return { error: validacion.error };
  const { admin } = validacion;
  const cleanMotivo = motivo.trim();
  if (!cleanMotivo) return { error: "Ingresa el motivo de la queja" };

  const { error } = await admin
    .from("pedidos")
    .update({
      prioridad: "queja",
      queja_motivo: cleanMotivo,
    } as any)
    .eq("id", pedidoId);

  if (error) return { error: error.message };
  revalidarPedidos([pedidoId]);
  return { ok: true };
}
