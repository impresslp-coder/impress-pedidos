import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function checkAdmin() {
  const admin = createAdminClient();
  // Solo admin puede gestionar sucursales
  return admin;
}

export async function GET() {
  const admin = await checkAdmin();
  const { data, error } = await admin.from("sucursales").select("*").order("nombre");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sucursales: data });
}

export async function POST(req: NextRequest) {
  const admin = await checkAdmin();
  const { nombre } = await req.json();
  if (!nombre) return NextResponse.json({ error: "Falta nombre" }, { status: 400 });
  const { data, error } = await admin.from("sucursales").insert({ nombre }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sucursal: data });
}

export async function PATCH(req: NextRequest) {
  const admin = await checkAdmin();
  const { id, ...fields } = await req.json();
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });
  const { data, error } = await admin.from("sucursales").update(fields).eq("id", id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sucursal: data });
}

export async function DELETE(req: NextRequest) {
  const admin = await checkAdmin();
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });
  await admin.from("sucursales").update({ activo: false }).eq("id", id);
  return NextResponse.json({ ok: true });
}
