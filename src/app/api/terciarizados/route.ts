import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const admin    = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await req.json();

  const cliente              = (body.cliente   ?? "").trim();
  const telefono             = (body.telefono  ?? "").trim();
  const item                 = (body.item      ?? "").trim();
  const cantidad             = body.cantidad ? parseInt(body.cantidad) : null;
  const anotacion            = (body.anotacion ?? "").trim();
  const proveedor            = (body.proveedor ?? "").trim();
  const sucursal             = (body.sucursal  ?? "").trim();
  const total                = parseFloat(body.total) || 0;
  const senia                = parseFloat(body.senia) || 0;
  const proveedor_articulo_id = body.proveedor_articulo_id?.trim() || null;
  const precio_costo         = body.precio_costo != null ? parseFloat(body.precio_costo) : null;

  if (!cliente || !item || !proveedor) {
    return NextResponse.json(
      { error: "Cliente, item y proveedor son obligatorios" },
      { status: 400 }
    );
  }

  const { data: counterData, error: counterError } = await admin.rpc("next_counter", { p_nombre: "terciarizados" });
  if (counterError) return NextResponse.json({ error: `Error al generar número: ${counterError.message}` }, { status: 500 });

  const numero = `E-${String(counterData).padStart(4, "0")}`;

  // Mensaje estandarizado para copiar y pegar
  const partes: string[] = [];
  partes.push(`Solicitamos presupuesto para ${item}`);
  if (cantidad) partes.push(`por la cantidad de ${cantidad} unidades`);
  if (anotacion) partes.push(`detallando: ${anotacion}`);
  const mensaje = partes.join(" ");

  const { data, error } = await supabase
    .from("terciarizados")
    .insert({
      numero,
      usuario_id: user.id,
      cliente,
      telefono:              telefono              || null,
      item,
      cantidad:              cantidad              || null,
      anotacion:             anotacion             || null,
      proveedor,
      sucursal:              sucursal              || null,
      total,
      senia,
      mensaje,
      estado:                "Encargo recibido",
      proveedor_articulo_id: proveedor_articulo_id || null,
      precio_costo:          precio_costo          ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, encargo: data });
}
