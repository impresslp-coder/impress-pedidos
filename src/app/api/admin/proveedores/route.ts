import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET — cualquier usuario autenticado puede leer los configs (los necesita el formulario)
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data, error } = await supabase
    .from("config_proveedores")
    .select("*")
    .order("proveedor");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ configs: data });
}

// PATCH — solo admin puede modificar
export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: perfil } = await supabase
    .from("usuarios_sistema")
    .select("rol")
    .eq("id", user.id)
    .single();
  if (perfil?.rol !== "admin") return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const { id, precio_base, porcentaje } = await req.json();
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });

  const { data, error } = await supabase
    .from("config_proveedores")
    .update({ precio_base, porcentaje })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ config: data });
}
