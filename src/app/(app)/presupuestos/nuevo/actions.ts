"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type ItemPresupuestoInput = {
  producto: string;
  modo?: string;
  paginas?: number;
  precio: number;
  descuento?: number;
  unidades: number;
};

export async function crearPresupuesto(formData: FormData) {
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const clienteId = formData.get("cliente_id") as string;
  const medioContacto = formData.get("medio_contacto") as string;
  const itemsJson = formData.get("items") as string;

  if (!clienteId) return { error: "Seleccioná un cliente" };
  if (!itemsJson) return { error: "Agregá al menos un producto" };

  const items: ItemPresupuestoInput[] = JSON.parse(itemsJson);
  if (!items.length) return { error: "Sin productos" };

  const { data: counterData } = await admin.rpc("next_counter", { p_nombre: "presupuestos" });
  const numero = String(counterData).padStart(7, "0");

  const total = items.reduce((acc, i) => {
    const desc = i.descuento ?? 0;
    return acc + i.precio * (1 - desc / 100) * i.unidades;
  }, 0);

  const fechaVenc = new Date();
  fechaVenc.setDate(fechaVenc.getDate() + 5);

  const { data: presupuesto, error: presError } = await supabase
    .from("presupuestos")
    .insert({
      numero,
      usuario_id: user.id,
      cliente_id: clienteId,
      total,
      medio_contacto: medioContacto || null,
      fecha_vencimiento: fechaVenc.toISOString().split("T")[0],
    })
    .select("id")
    .single();

  if (presError || !presupuesto) return { error: presError?.message };

  await supabase.from("items_presupuesto").insert(
    items.map((i) => ({
      presupuesto_id: presupuesto.id,
      producto: i.producto,
      modo: i.modo || null,
      paginas: i.paginas || null,
      precio: i.precio,
      descuento: i.descuento || 0,
      unidades: i.unidades,
    }))
  );

  redirect(`/presupuestos/${presupuesto.id}`);
}
