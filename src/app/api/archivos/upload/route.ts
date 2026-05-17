import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { uploadPDF } from "@/lib/google-drive";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const pedidoId = formData.get("pedido_id") as string | null;

  if (!file || !pedidoId) return NextResponse.json({ error: "Falta archivo o pedido_id" }, { status: 400 });
  if (file.type && file.type !== "application/pdf") return NextResponse.json({ error: "Solo PDFs" }, { status: 400 });

  let googleFileId: string;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    googleFileId = await uploadPDF(buffer, `${pedidoId}_${Date.now()}_${file.name}`);
  } catch (driveErr: unknown) {
    const msg = driveErr instanceof Error ? driveErr.message : String(driveErr);
    console.error("[upload] Google Drive error:", msg);
    return NextResponse.json({ error: `Drive: ${msg}` }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("archivos_pedido")
    .insert({ pedido_id: pedidoId, nombre_archivo: file.name, google_file_id: googleFileId })
    .select("*")
    .single();

  if (error) {
    console.error("[upload] Supabase error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ archivo: data });
}
