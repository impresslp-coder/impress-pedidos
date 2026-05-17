import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

async function requireAdmin(supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data: perfil } = await admin.from("usuarios_sistema").select("rol").eq("id", user.id).single();
  return (perfil as any)?.rol === "admin" ? user : null;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await requireAdmin(supabase);
  if (!user) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const body = await req.json();
  const allowed = ["nombre", "categoria", "codigo_barras", "paginas", "precio", "precio_compra", "descuento_maximo", "foto_url", "activo"];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key] === "" ? null : body[key];
  }
  const stock = "stock" in body ? parseInt(String(body.stock)) : null;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("productos").update(updates).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (stock !== null && Number.isFinite(stock)) {
    await admin
      .from("stock")
      .upsert({ producto_id: id, cantidad: stock } as any, { onConflict: "producto_id" });
  }

  return NextResponse.json({ producto: data, stock });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await requireAdmin(supabase);
  if (!user) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const { error } = await createAdminClient()
    .from("productos").update({ activo: false }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
