import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPrintToken } from "@/lib/print-token";
import { downloadArchivoFromStorage } from "@/lib/supabase-storage";
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
    .select("storage_path, google_file_id")
    .eq("id", payload.archivoId)
    .eq("pedido_id", payload.pedidoId)
    .single();

  const storagePath: string | null = (archivo as any)?.storage_path ?? null;
  const googleFileId: string | null = (archivo as any)?.google_file_id ?? null;

  if (!storagePath && !googleFileId) {
    return NextResponse.json({ error: "Archivo no encontrado en la base de datos" }, { status: 404 });
  }

  let buffer: Buffer;
  try {
    buffer = storagePath
      ? await downloadArchivoFromStorage(storagePath)
      : await downloadPDF(googleFileId!);
  } catch (err) {
    console.error("[print-jobs/pdf] descarga falló:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Error descargando el archivo: ${msg}` }, { status: 500 });
  }

  return new NextResponse(buffer as any, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store",
    },
  });
}
