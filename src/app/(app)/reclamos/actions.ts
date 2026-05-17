"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function registrarReclamo(
  _prev: { error?: string; ok?: boolean; numero?: string } | undefined,
  formData: FormData
) {
  const pedidoNumero = (formData.get("pedido_numero") as string).trim();
  const texto = (formData.get("texto") as string).trim();
  const sucursal = (formData.get("sucursal") as string).trim();

  if (!pedidoNumero || !texto) return { error: "Pedido y descripción son obligatorios" };

  const supabase = await createClient();

  const numeroReclamo = pedidoNumero + "_R";

  const { error } = await supabase.from("reclamos").insert({
    numero_reclamo: numeroReclamo,
    pedido_numero: pedidoNumero,
    texto,
    sucursal: sucursal || null,
    estado: "Reclamo recibido",
  });

  if (error) return { error: error.message };

  revalidatePath("/reclamos");
  return { ok: true, numero: numeroReclamo };
}
