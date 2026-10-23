import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function esAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await createAdminClient().from("usuarios_sistema").select("rol").eq("id", user.id).single();
  return data?.rol === "admin";
}

export async function POST(request: NextRequest) {
  if (!await esAdmin()) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  const paginas = Number((await request.json()).paginas);
  if (!Number.isInteger(paginas) || paginas < 1) {
    return NextResponse.json({ error: "Indicá una cantidad válida de páginas." }, { status: 400 });
  }

  const admin = createAdminClient();
  const hojas = Math.ceil(paginas / 2);
  const [{ data: impresion, error: errorImpresion }, { data: datosAnillo, error: errorAnillo }] = await Promise.all([
    admin.rpc("precio_impresion", { p_tipo_papel: "comun", p_tamano: "A4", p_hojas: hojas }),
    admin.rpc("anillado_para", { p_paginas: paginas }),
  ]);
  if (errorImpresion || errorAnillo) {
    return NextResponse.json({ error: errorImpresion?.message ?? errorAnillo?.message }, { status: 422 });
  }
  const anillo = Array.isArray(datosAnillo) ? datosAnillo[0] : datosAnillo;
  if (!anillo) return NextResponse.json({ error: "No hay un anillo activo para esa cantidad." }, { status: 422 });

  return NextResponse.json({
    calculo: {
      paginas,
      hojas,
      precio: Math.round(Number(impresion) / 100) * 100,
      anillos_cant: Number(anillo.anillos),
      anillo_mm: Number(anillo.medida_mm),
      precio_anillado: Number(anillo.precio),
    },
  });
}
