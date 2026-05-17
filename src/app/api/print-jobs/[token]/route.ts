import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPrintToken } from "@/lib/print-token";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const payload = verifyPrintToken(token);
  if (!payload) return NextResponse.json({ error: "Trabajo vencido o invalido" }, { status: 401 });

  const admin = createAdminClient();
  const { data: pedido } = await admin
    .from("pedidos")
    .select("id, numero, estado, clientes(nombre, telefono)")
    .eq("id", payload.pedidoId)
    .single();

  const { data: archivo } = await admin
    .from("archivos_pedido")
    .select("*")
    .eq("id", payload.archivoId)
    .eq("pedido_id", payload.pedidoId)
    .single();

  if (!pedido || !archivo) {
    return NextResponse.json({ error: "Trabajo no encontrado" }, { status: 404 });
  }

  const base = req.nextUrl.origin;
  return NextResponse.json({
    pedido,
    archivo,
    pdfUrl: `${base}/api/print-jobs/${encodeURIComponent(token)}/pdf`,
    printedUrl: `${base}/api/print-jobs/${encodeURIComponent(token)}/printed`,
  });
}
