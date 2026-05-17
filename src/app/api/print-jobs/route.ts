import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPrintToken } from "@/lib/print-token";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { pedidoId, archivoId } = await req.json();
  if (!pedidoId || !archivoId) {
    return NextResponse.json({ error: "Faltan datos del trabajo" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: archivo } = await admin
    .from("archivos_pedido")
    .select("id")
    .eq("id", archivoId)
    .eq("pedido_id", pedidoId)
    .single();

  if (!archivo) return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });

  const token = createPrintToken(pedidoId, archivoId);
  const base = req.nextUrl.origin;
  const key = process.env.PRINT_QUEUE_KEY ?? "";
  const protocolUrl = `impress-print://open?job=${encodeURIComponent(token)}&base=${encodeURIComponent(base)}&key=${encodeURIComponent(key)}`;

  return NextResponse.json({ protocolUrl });
}
