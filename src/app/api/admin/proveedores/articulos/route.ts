import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function checkAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado", status: 401, admin: null };

  const admin = createAdminClient();
  const { data: perfil } = await admin
    .from("usuarios_sistema")
    .select("rol")
    .eq("id", user.id)
    .single();
  if (perfil?.rol !== "admin") return { error: "Sin permiso", status: 403, admin: null };

  return { error: null, status: 200, admin };
}

// POST — crear artículo para un proveedor
export async function POST(req: NextRequest) {
  const { error, status, admin } = await checkAdmin();
  if (error || !admin) return NextResponse.json({ error }, { status });

  const { proveedor_id, nombre, descripcion, unidad, precio_costo, markup_pct, tiempo_entrega_dias,
          plancha_ancho_cm, plancha_alto_cm } = await req.json();

  if (!proveedor_id) return NextResponse.json({ error: "Falta proveedor_id" }, { status: 400 });
  if (!nombre?.trim()) return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });

  const { data, error: err } = await admin
    .from("proveedor_articulos")
    .insert({
      proveedor_id,
      nombre: nombre.trim(),
      descripcion: descripcion ?? null,
      unidad: unidad?.trim() || "unidad",
      precio_costo: parseFloat(precio_costo) || 0,
      markup_pct: parseFloat(markup_pct) || 0,
      tiempo_entrega_dias: parseInt(tiempo_entrega_dias) || 1,
      plancha_ancho_cm: plancha_ancho_cm ? parseFloat(plancha_ancho_cm) : null,
      plancha_alto_cm:  plancha_alto_cm  ? parseFloat(plancha_alto_cm)  : null,
    })
    .select()
    .single();

  if (err) return NextResponse.json({ error: err.message }, { status: 500 });
  return NextResponse.json({ articulo: data });
}

// PATCH — actualizar artículo
export async function PATCH(req: NextRequest) {
  const { error, status, admin } = await checkAdmin();
  if (error || !admin) return NextResponse.json({ error }, { status });

  const { id, nombre, descripcion, unidad, precio_costo, markup_pct, tiempo_entrega_dias, activo,
          plancha_ancho_cm, plancha_alto_cm } = await req.json();
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });

  const updates: Record<string, unknown> = {};
  if (nombre               !== undefined) updates.nombre               = nombre;
  if (descripcion          !== undefined) updates.descripcion          = descripcion;
  if (unidad               !== undefined) updates.unidad               = unidad;
  if (precio_costo         !== undefined) updates.precio_costo         = parseFloat(precio_costo) || 0;
  if (markup_pct           !== undefined) updates.markup_pct           = parseFloat(markup_pct) || 0;
  if (tiempo_entrega_dias  !== undefined) updates.tiempo_entrega_dias  = parseInt(tiempo_entrega_dias) || 1;
  if (activo               !== undefined) updates.activo               = activo;
  if (plancha_ancho_cm     !== undefined) updates.plancha_ancho_cm     = plancha_ancho_cm ? parseFloat(plancha_ancho_cm) : null;
  if (plancha_alto_cm      !== undefined) updates.plancha_alto_cm      = plancha_alto_cm  ? parseFloat(plancha_alto_cm)  : null;

  const { data, error: err } = await admin
    .from("proveedor_articulos")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (err) return NextResponse.json({ error: err.message }, { status: 500 });
  return NextResponse.json({ articulo: data });
}

// DELETE — eliminar artículo
export async function DELETE(req: NextRequest) {
  const { error, status, admin } = await checkAdmin();
  if (error || !admin) return NextResponse.json({ error }, { status });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });

  const { error: err } = await admin
    .from("proveedor_articulos")
    .delete()
    .eq("id", id);

  if (err) return NextResponse.json({ error: err.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
