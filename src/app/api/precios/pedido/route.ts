import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const papeles = new Set(["comun", "fotografico", "chambril"]);
const tamanos = new Set(["A3", "A4", "A5"]);

// Cotización para el formulario de pedidos. La cantidad de hojas ya contempla
// faz y páginas por hoja; los importes y acabados siempre se resuelven en SQL.
export async function POST(request: NextRequest) {
  const body = await request.json();
  const paginas = Number(body.paginas);
  const hojas = Number(body.hojas);
  const tipoPapel = String(body.tipo_papel ?? "").toLowerCase();
  const tamano = String(body.tamano ?? "").toUpperCase();
  const anillado = Boolean(body.anillado);
  const encuadernado = Boolean(body.encuadernado);

  if (!Number.isInteger(paginas) || paginas < 1 || !Number.isInteger(hojas) || hojas < 1) {
    return NextResponse.json({ error: "Indicá una cantidad válida de páginas y hojas." }, { status: 400 });
  }
  if (!papeles.has(tipoPapel) || !tamanos.has(tamano)) {
    return NextResponse.json({ error: "Papel o tamaño inválido." }, { status: 400 });
  }
  if (encuadernado && tamano !== "A4") {
    return NextResponse.json({ error: "El encuadernado solo está disponible en A4." }, { status: 400 });
  }

  const db = createAdminClient();
  const [{ data: precioImpresion, error: errorImpresion }, { data: acabados, error: errorAcabados }] = await Promise.all([
    db.rpc("precio_impresion", { p_tipo_papel: tipoPapel, p_tamano: tamano, p_hojas: hojas }),
    db.rpc("cotizar_trabajo", {
      p_paginas: paginas,
      p_tipo_papel: tipoPapel,
      p_tamano: tamano,
      p_anillado: anillado,
      p_encuadernado: encuadernado,
      p_apaisado: false,
    }),
  ]);

  if (errorImpresion) return NextResponse.json({ error: errorImpresion.message }, { status: 422 });
  if (errorAcabados) return NextResponse.json({ error: errorAcabados.message }, { status: 422 });

  const precioAnillado = Number((acabados as any)?.precio_anillado ?? 0);
  const precioEncuadernado = Number((acabados as any)?.precio_encuadernado ?? 0);
  const total = Number(precioImpresion) + precioAnillado + precioEncuadernado;

  return NextResponse.json({
    paginas,
    hojas,
    tipo_papel: tipoPapel,
    tamano,
    precio_impresion: Number(precioImpresion),
    precio_anillado: precioAnillado,
    precio_encuadernado: precioEncuadernado,
    total,
  });
}
