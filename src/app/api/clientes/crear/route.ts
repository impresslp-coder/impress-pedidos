import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const formData = await req.formData();
  const nombre = (formData.get("nombre") as string ?? "").trim();
  const telefono = (formData.get("telefono") as string ?? "").trim();
  const mail = (formData.get("mail") as string ?? "").trim();
  const codPais = (formData.get("cod_pais") as string ?? "54").trim();

  if (!nombre) return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });

  const nombreLimpio = nombre.replace(/\s/g, "").toUpperCase();
  const cod = (
    nombreLimpio.substring(0, 3) +
    (telefono ? telefono.slice(-3) : "000") +
    nombreLimpio.slice(-3)
  ).toUpperCase();

  if (telefono) {
    const { data: existe } = await supabase
      .from("clientes").select("id").eq("telefono", telefono).single();
    if (existe) return NextResponse.json({ error: "Teléfono ya registrado" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("clientes")
    .insert({ codigo: cod, nombre, cod_pais: codPais, telefono: telefono || null, mail: mail || null })
    .select("id, nombre, telefono, cod_pais")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ cliente: data });
}
