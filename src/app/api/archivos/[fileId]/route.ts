import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { downloadArchivoFromStorage } from "@/lib/supabase-storage";
import { downloadPDF } from "@/lib/google-drive";

// El parámetro [fileId] puede ser:
// - un UUID de archivos_pedido.id (formato nuevo, resuelto internamente a Storage o Drive)
// - un google_file_id de Drive (formato legacy — se descarga directo de Drive)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { fileId } = await params;

  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  let storagePath: string | null = null;
  let googleFileId: string | null = null;
  let nombre = "archivo.pdf";

  if (uuidRe.test(fileId)) {
    const admin = createAdminClient();
    const { data: archivo, error } = await admin
      .from("archivos_pedido")
      .select("storage_path, google_file_id, nombre_archivo")
      .eq("id", fileId)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!archivo) return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
    storagePath = (archivo as any).storage_path ?? null;
    googleFileId = (archivo as any).google_file_id ?? null;
    nombre = (archivo as any).nombre_archivo ?? nombre;
  } else {
    // Legacy: interpretar el parámetro como google_file_id
    googleFileId = fileId;
  }

  let buffer: Buffer;
  try {
    if (storagePath) {
      buffer = await downloadArchivoFromStorage(storagePath);
    } else if (googleFileId) {
      buffer = await downloadPDF(googleFileId);
    } else {
      return NextResponse.json({ error: "Archivo sin origen (ni storage ni drive)" }, { status: 404 });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[archivos/${fileId}] Descarga:`, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return new NextResponse(buffer as any, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${encodeURIComponent(nombre)}"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
