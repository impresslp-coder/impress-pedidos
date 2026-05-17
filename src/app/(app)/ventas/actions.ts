"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type ItemVentaInput = {
  producto_id: string | null;
  producto_nombre: string;
  precio_venta: number;
  cantidad: number;
  descuento_pct: number;
};

export async function registrarVenta(formData: FormData) {
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  // Validar código de operador
  const codigoIngresado = (formData.get("codigo_personal") as string)?.trim();
  if (!codigoIngresado) return { error: "Ingresá tu código de operador" };

  const { data: perfil } = await admin
    .from("usuarios_sistema")
    .select("codigo_personal")
    .eq("id", user.id)
    .single();

  const codigoGuardado = (perfil as any)?.codigo_personal;
  if (codigoGuardado && codigoGuardado !== codigoIngresado) {
    return { error: "Código de operador incorrecto" };
  }

  const medioPago = (formData.get("medio_pago") as string) || "efectivo";
  const itemsJson = formData.get("items") as string;
  if (!itemsJson) return { error: "Sin productos" };

  const items: ItemVentaInput[] = JSON.parse(itemsJson);
  if (!items.length) return { error: "Sin productos" };

  // Número correlativo
  const { data: counterData } = await admin.rpc("next_counter", { p_nombre: "ventas" });
  const numero = String(counterData).padStart(7, "0");

  // Total con descuentos
  const total = items.reduce((acc, i) => {
    const base = i.precio_venta * i.cantidad;
    return acc + Math.round(base * (1 - i.descuento_pct / 100));
  }, 0);

  // Crear venta
  const { data: venta, error: ventaError } = await supabase
    .from("ventas")
    .insert({
      numero_venta: numero,
      usuario_id: user.id,
      total,
      medio_pago: medioPago,
    } as any)
    .select("id")
    .single();

  if (ventaError || !venta) return { error: ventaError?.message ?? "Error al crear venta" };

  // Items de la venta
  await supabase.from("items_venta").insert(
    items.map((i) => ({
      venta_id: (venta as any).id,
      producto_id: i.producto_id,
      producto_nombre: i.producto_nombre,
      cantidad: i.cantidad,
      precio_unitario: i.precio_venta,
      precio_venta: i.precio_venta,
      descuento_pct: i.descuento_pct,
      total: Math.round(i.precio_venta * i.cantidad * (1 - i.descuento_pct / 100)),
    } as any))
  );

  // Descontar stock de tabla stock (por producto_id)
  for (const item of items) {
    if (!item.producto_id) continue;
    const { data: st } = await supabase
      .from("stock")
      .select("cantidad")
      .eq("producto_id", item.producto_id)
      .single();
    if (st) {
      await supabase
        .from("stock")
        .update({ cantidad: Math.max(0, ((st as any).cantidad ?? 0) - item.cantidad) } as any)
        .eq("producto_id", item.producto_id);
    }
  }

  revalidatePath("/ventas");
  return { ok: true, numero };
}
