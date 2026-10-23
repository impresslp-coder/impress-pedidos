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

export type PresupuestoVentaInput = ItemVentaInput;

const totalDeItems = (items: ItemVentaInput[]) => items.reduce((acc, i) => {
  const base = Number(i.precio_venta) * Number(i.cantidad);
  return acc + Math.round(base * (1 - Number(i.descuento_pct) / 100));
}, 0);

const leerItems = (itemsJson: FormDataEntryValue | null): ItemVentaInput[] | null => {
  if (typeof itemsJson !== "string") return null;
  try {
    const items = JSON.parse(itemsJson) as ItemVentaInput[];
    if (!Array.isArray(items) || !items.length) return null;
    return items.every((item) =>
      typeof item.producto_nombre === "string"
      && Number.isFinite(Number(item.precio_venta))
      && Number.isInteger(Number(item.cantidad)) && Number(item.cantidad) > 0
      && Number.isFinite(Number(item.descuento_pct))
      && Number(item.descuento_pct) >= 0 && Number(item.descuento_pct) <= 100
    ) ? items : null;
  } catch {
    return null;
  }
};

export async function guardarPresupuestoDesdeVenta(formData: FormData) {
  const supabase = await createClient();
  const admin = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const clienteId = String(formData.get("cliente_id") ?? "").trim();
  const items = leerItems(formData.get("items"));
  if (!clienteId) return { error: "Seleccioná un cliente para guardar el presupuesto" };
  if (!items) return { error: "Agregá al menos un ítem" };

  const { data: counterData, error: counterError } = await admin.rpc("next_counter", { p_nombre: "presupuestos" });
  if (counterError) return { error: counterError.message };
  const numero = String(counterData).padStart(7, "0");
  const fechaVencimiento = new Date();
  fechaVencimiento.setDate(fechaVencimiento.getDate() + 5);

  const { data: presupuesto, error: presupuestoError } = await (admin.from("presupuestos") as any)
    .insert({
      numero,
      usuario_id: user.id,
      cliente_id: clienteId,
      total: totalDeItems(items),
      fecha_vencimiento: fechaVencimiento.toISOString().slice(0, 10),
      estado: "vigente",
    })
    .select("id")
    .single();
  if (presupuestoError || !presupuesto) return { error: presupuestoError?.message ?? "No se pudo guardar el presupuesto" };

  const { error: itemsError } = await (admin.from("items_presupuesto") as any).insert(
    items.map((item) => ({
      presupuesto_id: presupuesto.id,
      producto_id: item.producto_id,
      producto: item.producto_nombre,
      precio: Number(item.precio_venta),
      descuento: Number(item.descuento_pct),
      unidades: Number(item.cantidad),
    })),
  );
  if (itemsError) return { error: itemsError.message };

  revalidatePath("/ventas");
  return { ok: true, numero };
}

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
  const sucursal = ((formData.get("sucursal") as string) || "").trim();
  const items = leerItems(formData.get("items"));
  if (!items) return { error: "Sin productos" };

  const presupuestoId = String(formData.get("presupuesto_id") ?? "").trim() || null;
  if (presupuestoId) {
    const { data: presupuesto, error: presupuestoError } = await (admin.from("presupuestos") as any)
      .select("id, estado")
      .eq("id", presupuestoId)
      .maybeSingle();
    if (presupuestoError || !presupuesto || presupuesto.estado !== "vigente") {
      return { error: "Este presupuesto ya fue cobrado, venció o no está disponible" };
    }
  }

  // Número correlativo
  const { data: counterData } = await admin.rpc("next_counter", { p_nombre: "ventas" });
  const numero = String(counterData).padStart(7, "0");

  // Total con descuentos
  const total = totalDeItems(items);

  // Crear venta
  const { data: venta, error: ventaError } = await supabase
    .from("ventas")
    .insert({
      numero_venta: numero,
      usuario_id: user.id,
      total,
      medio_pago: medioPago,
      sucursal: sucursal || null,
      presupuesto_id: presupuestoId,
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

  if (presupuestoId) {
    const { error: presupuestoError } = await (admin.from("presupuestos") as any)
      .update({ estado: "convertido" })
      .eq("id", presupuestoId)
      .eq("estado", "vigente");
    if (presupuestoError) return { error: `La venta se registró, pero no se pudo cerrar el presupuesto: ${presupuestoError.message}` };
  }

  // Descontar stock de tabla stock (por producto_id)
  for (const item of items) {
    if (!item.producto_id) continue;
    const { data: producto } = await admin
      .from("productos")
      .select("tipo, es_servicio")
      .eq("id", item.producto_id)
      .single();
    // Los apuntes y servicios se producen/venden sin stock físico.
    if ((producto as any)?.tipo !== "producto" || (producto as any)?.es_servicio) continue;
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
