import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function adminAutorizado() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await createAdminClient().from("usuarios_sistema").select("rol").eq("id", user.id).single();
  return data?.rol === "admin";
}

export async function PATCH(request: NextRequest) {
  if (!await adminAutorizado()) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  const body = await request.json();
  const ids = Array.isArray(body.ids) ? body.ids.filter((id: unknown) => typeof id === "string") : [];
  if (!ids.length) return NextResponse.json({ error: "Seleccioná al menos un producto." }, { status: 400 });
  const fields: Record<string, unknown> = {};
  for (const key of ["carrera", "materia", "revisar", "revisar_motivo", "activo"]) {
    if (key in body) fields[key] = body[key] === "" ? null : body[key];
  }
  if (!Object.keys(fields).length) return NextResponse.json({ error: "No hay cambios para aplicar." }, { status: 400 });
  const { error } = await createAdminClient().from("productos").update(fields).in("id", ids);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
