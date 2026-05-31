import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function checkAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado", status: 401, admin: null };
  const admin = createAdminClient();
  const { data: p } = await admin.from("usuarios_sistema").select("rol").eq("id", user.id).single();
  if ((p as any)?.rol !== "admin") return { error: "Sin permiso", status: 403, admin: null };
  return { error: null, status: 200, admin, userId: user.id };
}

// GET — listado de impresoras con último registro del día
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const admin = createAdminClient();
  const hoy = new Date().toISOString().split("T")[0];

  const [{ data: impresoras }, { data: registros }] = await Promise.all([
    admin.from("impresoras").select("*").eq("activo", true).order("sucursal").order("nombre"),
    admin.from("registros_ciclos").select("*").eq("fecha", hoy),
  ]);

  return NextResponse.json({ impresoras: impresoras ?? [], registros_hoy: registros ?? [] });
}

// POST — crear impresora
export async function POST(req: NextRequest) {
  const { error, status, admin } = await checkAdmin();
  if (error || !admin) return NextResponse.json({ error }, { status });
  const { nombre, modelo, sucursal } = await req.json();
  if (!nombre) return NextResponse.json({ error: "Falta nombre" }, { status: 400 });
  const { data, error: err } = await admin
    .from("impresoras").insert({ nombre, modelo: modelo || null, sucursal: sucursal || null }).select().single();
  if (err) return NextResponse.json({ error: err.message }, { status: 500 });
  return NextResponse.json({ impresora: data });
}

// PATCH — actualizar ciclos del día
export async function PATCH(req: NextRequest) {
  const { error, status, admin, userId } = await checkAdmin() as any;
  if (error || !admin) return NextResponse.json({ error }, { status });

  const { impresora_id, ciclos_dia, nivel_toner, observaciones } = await req.json();
  if (!impresora_id) return NextResponse.json({ error: "Falta impresora_id" }, { status: 400 });

  const hoy = new Date().toISOString().split("T")[0];
  const { data, error: err } = await admin
    .from("registros_ciclos")
    .upsert(
      { impresora_id, fecha: hoy, ciclos_dia: parseInt(ciclos_dia) || 0, nivel_toner: nivel_toner || null, observaciones: observaciones || null, usuario_id: userId },
      { onConflict: "impresora_id,fecha" }
    )
    .select().single();

  if (err) return NextResponse.json({ error: err.message }, { status: 500 });
  return NextResponse.json({ ok: true, registro: data });
}

// DELETE — desactivar impresora
export async function DELETE(req: NextRequest) {
  const { error, status, admin } = await checkAdmin();
  if (error || !admin) return NextResponse.json({ error }, { status });
  const { id } = await req.json();
  await admin.from("impresoras").update({ activo: false }).eq("id", id);
  return NextResponse.json({ ok: true });
}
