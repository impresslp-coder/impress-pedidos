import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const papeles = new Set(["comun", "fotografico", "chambril"]);

// Punto único para las pantallas de mostrador: el tramo y el redondeo se
// resuelven en PostgreSQL mediante precio_impresion(), nunca en el navegador.
export async function POST(request: NextRequest) {
  const body = await request.json();
  const hojas = Number(body.hojas);
  const papel = String(body.papel ?? "").toLowerCase();

  if (!Number.isInteger(hojas) || hojas < 1 || !papeles.has(papel)) {
    return NextResponse.json({ error: "Cantidad de hojas o papel inválido." }, { status: 400 });
  }

  const { data, error } = await createAdminClient().rpc("precio_impresion", {
    p_tipo_papel: papel,
    p_tamano: "A4",
    p_hojas: hojas,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 422 });
  return NextResponse.json({ hojas, papel, total: Number(data) });
}
