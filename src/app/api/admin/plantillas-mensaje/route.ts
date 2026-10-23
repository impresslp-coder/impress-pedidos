import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function adminAutorizado() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data: perfil } = await admin.from("usuarios_sistema").select("rol").eq("id", user.id).maybeSingle();
  return perfil?.rol === "admin" ? admin : null;
}

export async function PATCH(req: NextRequest) {
  const admin = await adminAutorizado();
  if (!admin) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  const body = await req.json().catch(() => null);
  const codigo = String(body?.codigo ?? "").trim();
  const cuerpo = String(body?.cuerpo ?? "").trim();
  const activo = Boolean(body?.activo);
  if (!["retiro", "envio"].includes(codigo) || !cuerpo) {
    return NextResponse.json({ error: "Plantilla inválida" }, { status: 400 });
  }
  const { error } = await admin.from("plantillas_mensaje").update({ cuerpo, activo } as any).eq("codigo", codigo);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
