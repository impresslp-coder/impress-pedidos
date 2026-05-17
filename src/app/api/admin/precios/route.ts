import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: perfil } = await supabase
    .from("usuarios_sistema").select("rol").eq("id", user.id).single();
  if (perfil?.rol !== "admin") return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const body = await req.json();
  const { id, ...fields } = body;

  const { data, error } = await supabase
    .from("productos")
    .update(fields)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ producto: data });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: perfil } = await supabase
    .from("usuarios_sistema").select("rol").eq("id", user.id).single();
  if (perfil?.rol !== "admin") return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const { nombre, categoria } = await req.json();
  if (!nombre) return NextResponse.json({ error: "Falta nombre" }, { status: 400 });

  const { data, error } = await supabase
    .from("productos")
    .insert({ nombre, categoria: categoria || null, activo: true })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ producto: data });
}
