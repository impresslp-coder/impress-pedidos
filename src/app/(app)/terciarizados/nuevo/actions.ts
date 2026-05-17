"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function crearTerciarizado(_prev: unknown, formData: FormData) {
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const cliente  = (formData.get("cliente")   as string).trim();
  const telefono = (formData.get("telefono")  as string).trim();
  const item     = (formData.get("item")      as string).trim();
  const anotacion = (formData.get("anotacion") as string).trim();
  const total    = parseFloat(formData.get("total")   as string) || 0;
  const senia    = parseFloat(formData.get("senia")   as string) || 0;
  const sucursal = (formData.get("sucursal")  as string).trim();

  if (!cliente || !item) return { error: "Cliente e item son obligatorios" };

  const { data: counterData } = await admin.rpc("next_counter", { p_nombre: "terciarizados" });
  const numero = String(counterData).padStart(5, "0") + "_E";

  const { error } = await supabase.from("terciarizados").insert({
    numero,
    usuario_id: user.id,
    cliente,
    telefono:  telefono  || null,
    item,
    anotacion: anotacion || null,
    total,
    senia,
    sucursal:  sucursal  || null,
    estado:    "Encargo recibido",
  });

  if (error) return { error: error.message };

  redirect("/terciarizados");
}
