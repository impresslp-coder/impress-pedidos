import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function checkAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data: perfil } = await admin
    .from("usuarios_sistema").select("rol").eq("id", user.id).single();
  if (perfil?.rol !== "admin") return null;
  return supabase;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data, error } = await supabase
    .from("parametros_precio")
    .select("*")
    .order("nombre");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ parametros: data });
}

export async function POST(req: NextRequest) {
  const supabase = await checkAdmin();
  if (!supabase) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const { nombre, precio, divisor } = await req.json();
  if (!nombre) return NextResponse.json({ error: "Falta nombre" }, { status: 400 });

  const { data, error } = await supabase
    .from("parametros_precio")
    .insert({ nombre, precio: precio ?? 0, divisor: divisor ?? 1, activo: true })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ parametro: data });
}

export async function PATCH(req: NextRequest) {
  const supabase = await checkAdmin();
  if (!supabase) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const body = await req.json();
  const { id, ...fields } = body;

  const { data, error } = await supabase
    .from("parametros_precio")
    .update(fields)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ parametro: data });
}

export async function DELETE(req: NextRequest) {
  const supabase = await checkAdmin();
  if (!supabase) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const { id } = await req.json();
  const { error } = await supabase
    .from("parametros_precio")
    .update({ activo: false })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
