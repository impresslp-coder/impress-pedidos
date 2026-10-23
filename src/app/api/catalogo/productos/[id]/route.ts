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
  const allowed = ["nombre", "categoria", "codigo_barras", "paginas", "precio", "precio_compra", "descuento_maximo", "foto_url", "activo", "carrera", "materia", "revisar", "revisar_motivo", "anillo_mm", "anillos_cant"];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key] === "" ? null : body[key];
  }

  // Los apuntes del catálogo no conservan un precio manual: al corregir sus
  // páginas se vuelve a consultar el motor vigente y se actualiza también el
  // anillo físico que corresponde. Los servicios no usan este flujo.
  if (body.recalcular_catalogo === true) {
    const paginas = Number(updates.paginas ?? body.paginas);
    if (!Number.isInteger(paginas) || paginas < 1) {
      return NextResponse.json({ error: "Indicá una cantidad válida de páginas para recalcular." }, { status: 400 });
    }

    const hojas = Math.ceil(paginas / 2);
    const admin = createAdminClient();
    const { data: impresion, error: errorImpresion } = await admin.rpc("precio_impresion", {
      p_tipo_papel: "comun",
      p_tamano: "A4",
      p_hojas: hojas,
    });
    if (errorImpresion) return NextResponse.json({ error: errorImpresion.message }, { status: 422 });

    const { data: anillado, error: errorAnillado } = await admin.rpc("anillado_para", { p_paginas: paginas });
    if (errorAnillado) return NextResponse.json({ error: errorAnillado.message }, { status: 422 });
    const anillo = Array.isArray(anillado) ? anillado[0] : anillado;
    if (!anillo) return NextResponse.json({ error: "No se encontró un anillo activo para esa cantidad." }, { status: 422 });

    // Se redondea al centenar, como los precios del catálogo importado.
    updates.precio = Math.round(Number(impresion) / 100) * 100;
    updates.anillos_cant = Number(anillo.anillos);
    updates.anillo_mm = Number(anillo.medida_mm);
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
