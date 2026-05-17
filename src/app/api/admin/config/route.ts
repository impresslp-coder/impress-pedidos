import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function checkAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data: perfil } = await admin.from("usuarios_sistema").select("rol").eq("id", user.id).single();
  if (perfil?.rol !== "admin") return null;
  return supabase;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const { data } = await supabase.from("configuracion").select("clave, valor");
  const config: Record<string, string> = {};
  for (const row of data ?? []) config[row.clave] = row.valor;
  return NextResponse.json({ config });
}

export async function PATCH(req: NextRequest) {
  const supabase = await checkAdmin();
  if (!supabase) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const body = await req.json() as Record<string, string>;
  for (const [clave, valor] of Object.entries(body)) {
    await supabase.from("configuracion").upsert({ clave, valor }, { onConflict: "clave" });
  }
  return NextResponse.json({ ok: true });
}
