import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSignedUploadUrl } from "@/lib/supabase-storage";

// Devuelve una signed URL de Supabase Storage para que el browser suba el archivo
// directamente al bucket, sin pasar el buffer por nuestro servidor.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { fileName, pedidoId } = await req.json();
  if (!fileName || !pedidoId) {
    return NextResponse.json({ error: "Falta fileName o pedidoId" }, { status: 400 });
  }

  try {
    const { path, token, signedUrl } = await createSignedUploadUrl(pedidoId, fileName);
    return NextResponse.json({ uploadUrl: signedUrl, token, storagePath: path, pedidoId, fileName });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[archivos/init-upload] Storage error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
