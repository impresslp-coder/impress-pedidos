import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function checkAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado", status: 401, user: null, admin: null };

  const admin = createAdminClient();
  const { data: perfil } = await admin
    .from("usuarios_sistema")
    .select("rol")
    .eq("id", user.id)
    .single();
  if (perfil?.rol !== "admin") return { error: "Sin permiso", status: 403, user: null, admin: null };

  return { error: null, status: 200, user, admin };
}

// GET — lista proveedores con sus artículos (cualquier usuario autenticado)
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data, error } = await supabase
    .from("proveedores")
    .select("*, proveedor_articulos(*)")
    .order("nombre")
    .order("nombre", { referencedTable: "proveedor_articulos" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ proveedores: data });
}

// POST — crear proveedor
export async function POST(req: NextRequest) {
  const { error, status, admin } = await checkAdmin();
  if (error || !admin) return NextResponse.json({ error }, { status });

  const { nombre, contacto, telefono, email, notas } = await req.json();
  if (!nombre?.trim()) return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });

  const { data, error: err } = await admin
    .from("proveedores")
    .insert({ nombre: nombre.trim(), contacto, telefono, email, notas })
    .select("*, proveedor_articulos(*)")
    .single();

  if (err) return NextResponse.json({ error: err.message }, { status: 500 });
  return NextResponse.json({ proveedor: data });
}

// PATCH — actualizar proveedor
export async function PATCH(req: NextRequest) {
  const { error, status, admin } = await checkAdmin();
  if (error || !admin) return NextResponse.json({ error }, { status });

  const { id, nombre, contacto, telefono, email, notas, activo } = await req.json();
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });

  const updates: Record<string, unknown> = {};
  if (nombre     !== undefined) updates.nombre    = nombre;
  if (contacto   !== undefined) updates.contacto  = contacto;
  if (telefono   !== undefined) updates.telefono  = telefono;
  if (email      !== undefined) updates.email     = email;
  if (notas      !== undefined) updates.notas     = notas;
  if (activo     !== undefined) updates.activo    = activo;

  const { data, error: err } = await admin
    .from("proveedores")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (err) return NextResponse.json({ error: err.message }, { status: 500 });
  return NextResponse.json({ proveedor: data });
}

// DELETE — eliminar proveedor (en cascada elimina sus artículos)
export async function DELETE(req: NextRequest) {
  const { error, status, admin } = await checkAdmin();
  if (error || !admin) return NextResponse.json({ error }, { status });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });

  const { error: err } = await admin
    .from("proveedores")
    .delete()
    .eq("id", id);

  if (err) return NextResponse.json({ error: err.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
