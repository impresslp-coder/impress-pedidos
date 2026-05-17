import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function checkAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data: perfil } = await admin.from("usuarios_sistema").select("rol").eq("id", user.id).single();
  return perfil?.rol === "admin" ? admin : null;
}

export async function PATCH(req: NextRequest) {
  const admin = await checkAdmin();
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { id, rol, sucursal_default, codigo_personal, activo } = await req.json();
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });

  const { error } = await admin
    .from("usuarios_sistema")
    .update({
      ...(rol              !== undefined && { rol }),
      ...(sucursal_default !== undefined && { sucursal_default: sucursal_default || null }),
      ...(codigo_personal  !== undefined && { codigo_personal: codigo_personal || null }),
      ...(activo           !== undefined && { activo }),
    })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
