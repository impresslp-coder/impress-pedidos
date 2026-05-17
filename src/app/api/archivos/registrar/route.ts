import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Registra en Supabase un archivo ya subido directamente a Drive
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { pedidoId, fileName, googleFileId } = await req.json();
  if (!pedidoId || !fileName || !googleFileId) {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("archivos_pedido")
    .insert({ pedido_id: pedidoId, nombre_archivo: fileName, google_file_id: googleFileId })
    .select("*")
    .single();

  if (error) {
    console.error("[registrar] Supabase error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ archivo: data });
}
