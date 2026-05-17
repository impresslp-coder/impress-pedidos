import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPrintToken } from "@/lib/print-token";
import { downloadPDF } from "@/lib/google-drive";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const payload = verifyPrintToken(token);
  if (!payload) return NextResponse.json({ error: "Trabajo vencido o invalido" }, { status: 401 });

  const admin = createAdminClient();
  const { data: archivo } = await admin
    .from("archivos_pedido")
    .select("google_file_id")
    .eq("id", payload.archivoId)
    .eq("pedido_id", payload.pedidoId)
    .single();

  if (!archivo?.google_file_id) {
    return NextResponse.json({ error: "Archivo no encontrado en la base de datos" }, { status: 404 });
  }

  let buffer: Buffer;
  try {
    buffer = await downloadPDF((archivo as any).google_file_id);
  } catch (err) {
    console.error("[print-jobs/pdf] downloadPDF failed:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Error descargando de Google Drive: ${msg}` }, { status: 500 });
  }

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline",
      "Cache-Control": "private, max-age=300",
    },
  });
}
