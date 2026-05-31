import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// GET ?producto_id=xxx — stock por sucursal de un producto
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const productoId = req.nextUrl.searchParams.get("producto_id");
  if (!productoId) return NextResponse.json({ error: "Falta producto_id" }, { status: 400 });

  const { data, error } = await supabase
    .from("stock_sucursal")
    .select("id, sucursal, cantidad, updated_at")
    .eq("producto_id", productoId)
    .order("sucursal");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ stock: data ?? [] });
}

// POST — crear o actualizar stock de un producto en una sucursal (upsert)
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  // Solo admins pueden editar stock por sucursal
  const admin = createAdminClient();
  const { data: perfil } = await admin
    .from("usuarios_sistema").select("rol").eq("id", user.id).single();
  if ((perfil as any)?.rol !== "admin") {
    return NextResponse.json({ error: "Solo admins pueden editar stock por sucursal" }, { status: 403 });
  }

  const { producto_id, sucursal, cantidad } = await req.json();
  if (!producto_id || !sucursal || cantidad === undefined) {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("stock_sucursal")
    .upsert(
      { producto_id, sucursal, cantidad: parseInt(cantidad) || 0, updated_at: new Date().toISOString() },
      { onConflict: "producto_id,sucursal" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, row: data });
}
