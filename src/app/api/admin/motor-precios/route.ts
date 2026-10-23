import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const tablas = new Set(["precios_impresion", "anillos", "acabados_tramos", "acabados_fijos", "configuracion"]);

async function esAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await createAdminClient().from("usuarios_sistema").select("rol").eq("id", user.id).single();
  return data?.rol === "admin";
}

export async function POST(request: NextRequest) {
  if (!await esAdmin()) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  const { tabla, fila } = await request.json();
  if (!tablas.has(tabla) || !fila) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  const { data, error } = await createAdminClient().from(tabla).insert(fila).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 422 });
  return NextResponse.json({ fila: data });
}

export async function PATCH(request: NextRequest) {
  if (!await esAdmin()) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  const { tabla, id, fila } = await request.json();
  if (!tablas.has(tabla) || !id || !fila) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  const admin = createAdminClient();
  if (tabla !== "precios_impresion") {
    const key = tabla === "anillos" ? "medida_mm" : tabla === "configuracion" ? "clave" : "id";
    const { data, error } = await admin.from(tabla).update(fila).eq(key, id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 422 });
    return NextResponse.json({ fila: data });
  }
  const { data: anterior, error: lectura } = await admin.from(tabla).select("*").eq("id", id).single();
  if (lectura || !anterior) return NextResponse.json({ error: lectura?.message ?? "Tramo inexistente" }, { status: 404 });
  const cambiaPrecio = Number(anterior.precio_por_hoja) !== Number(fila.precio_por_hoja);
  if (!cambiaPrecio) {
    const { data, error } = await admin.from(tabla).update(fila).eq("id", id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 422 });
    return NextResponse.json({ fila: data });
  }
  const ayer = new Date(); ayer.setDate(ayer.getDate() - 1);
  const { error: cierre } = await admin.from(tabla).update({ activo: false, vigente_hasta: ayer.toISOString().slice(0, 10) }).eq("id", id);
  if (cierre) return NextResponse.json({ error: cierre.message }, { status: 422 });
  const { id: _id, vigente_desde: _desde, vigente_hasta: _hasta, ...base } = anterior;
  const { data, error } = await admin.from(tabla).insert({ ...base, ...fila, activo: true, vigente_desde: new Date().toISOString().slice(0, 10), vigente_hasta: null }).select().single();
  if (error) {
    // Si todavía no se aplicó la migración de historial, el índice viejo puede
    // rechazar la nueva versión. Se restaura el tramo cerrado para no perder
    // el precio vigente por una operación a medio terminar.
    await admin.from(tabla).update({ activo: anterior.activo, vigente_hasta: anterior.vigente_hasta }).eq("id", id);
    return NextResponse.json({ error: error.message }, { status: 422 });
  }
  return NextResponse.json({ fila: data, historial: true });
}
