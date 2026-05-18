import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function validateKey(req: NextRequest, bodyKey?: string): boolean {
  const key = bodyKey || req.nextUrl.searchParams.get("key") || req.headers.get("x-print-key") || "";
  const expected = process.env.PRINT_QUEUE_KEY ?? "";
  return !!expected && key === expected;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (!validateKey(req, String(body.key ?? ""))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const code = String(body.code ?? "").trim();
  if (!code) return NextResponse.json({ error: "Ingrese codigo de usuario" }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("usuarios_sistema")
    .select("id, nombre, rol, codigo_personal, activo")
    .eq("codigo_personal", code)
    .eq("activo", true)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Codigo de usuario incorrecto" }, { status: 403 });

  return NextResponse.json({
    ok: true,
    operator: {
      id: data.id,
      nombre: data.nombre,
      rol: data.rol,
    },
  });
}
