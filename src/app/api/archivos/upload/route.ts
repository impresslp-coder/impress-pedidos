import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { uploadArchivoToStorage } from "@/lib/supabase-storage";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const pedidoId = formData.get("pedido_id") as string | null;
  const copias = Math.max(1, Math.floor(Number(formData.get("copias")) || 1));
  const color = formData.get("color") === "true";
  const dobleFaz = formData.get("doble_faz") === "true";
  const tamanoPapel = String(formData.get("tamano_papel") || "A4");

  if (!file || !pedidoId) return NextResponse.json({ error: "Falta archivo o pedido_id" }, { status: 400 });
  if (file.type && file.type !== "application/pdf") return NextResponse.json({ error: "Solo PDFs" }, { status: 400 });

  let storagePath: string;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    storagePath = await uploadArchivoToStorage(pedidoId, file.name, buffer, "application/pdf");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[archivos/upload] Storage error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("archivos_pedido")
    .insert({
      pedido_id: pedidoId,
      nombre_archivo: file.name,
      storage_path: storagePath,
      google_file_id: null,
      copias,
      color,
      doble_faz: dobleFaz,
      tamano_papel: tamanoPapel,
    })
    .select("*")
    .single();

  if (error) {
    console.error("[archivos/upload] Supabase insert error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ archivo: data });
}
