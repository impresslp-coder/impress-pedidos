"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function agregarCliente(_prev: unknown, formData: FormData) {
  const nombre = (formData.get("nombre") as string).trim();
  const codPais = (formData.get("cod_pais") as string).trim() || "54";
  const telefono = (formData.get("telefono") as string).trim();
  const mail = (formData.get("mail") as string).trim();

  if (!nombre) return { error: "El nombre es obligatorio" };

  // Generar código único: primeras 3 letras + últimas 3 del teléfono + últimas 3 del nombre
  const nombreLimpio = nombre.replace(/\s/g, "").toUpperCase();
  const cod = (
    nombreLimpio.substring(0, 3) +
    (telefono ? telefono.slice(-3) : "000") +
    nombreLimpio.slice(-3)
  ).toUpperCase();

  const supabase = await createClient();

  // Verificar teléfono duplicado
  if (telefono) {
    const { data: existe } = await supabase
      .from("clientes")
      .select("id")
      .eq("telefono", telefono)
      .single();
    if (existe) return { error: "Este teléfono ya está registrado" };
  }

  const { error } = await supabase.from("clientes").insert({
    codigo: cod,
    nombre,
    cod_pais: codPais,
    telefono: telefono || null,
    mail: mail || null,
  });

  if (error) return { error: `Error al guardar: ${error.message}` };

  revalidatePath("/clientes");
  return { ok: true };
}
