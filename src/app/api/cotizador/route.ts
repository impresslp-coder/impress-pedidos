import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const papeles = new Set(["comun", "fotografico", "chambril"]);
const tamanos = new Set(["A3", "A4", "A5"]);

export async function POST(request: NextRequest) {
  const body = await request.json();
  const paginas = Number(body.paginas);
  const tipoPapel = String(body.tipo_papel ?? "").toLowerCase();
  const tamano = String(body.tamano ?? "").toUpperCase();

  if (!Number.isInteger(paginas) || paginas < 1) {
    return NextResponse.json({ error: "Indicá una cantidad válida de páginas." }, { status: 400 });
  }
  if (!papeles.has(tipoPapel) || !tamanos.has(tamano)) {
    return NextResponse.json({ error: "Papel o tamaño inválido." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("cotizar_trabajo", {
    p_paginas: paginas,
    p_tipo_papel: tipoPapel,
    p_tamano: tamano,
    p_anillado: Boolean(body.anillado),
    p_encuadernado: Boolean(body.encuadernado),
    p_apaisado: Boolean(body.apaisado),
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 422 });
  return NextResponse.json({ cotizacion: data });
}
