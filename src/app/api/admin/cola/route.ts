import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function checkAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado", status: 401, admin: null };
  const admin = createAdminClient();
  const { data: perfil } = await admin.from("usuarios_sistema").select("rol").eq("id", user.id).single();
  if ((perfil as any)?.rol !== "admin") return { error: "Sin permiso", status: 403, admin: null };
  return { error: null, status: 200, admin };
}

// PATCH — actualizar orden_produccion de un pedido
export async function PATCH(req: NextRequest) {
  const { error, status, admin } = await checkAdmin();
  if (error || !admin) return NextResponse.json({ error }, { status });

  const { id, orden_produccion } = await req.json();
  if (!id || orden_produccion === undefined) {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }

  const { error: err } = await admin
    .from("pedidos")
    .update({ orden_produccion })
    .eq("id", id);

  if (err) return NextResponse.json({ error: err.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
