import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// POST — sube certificado a Google Drive y actualiza asistencia.certificado_url
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const admin = createAdminClient();
  const { data: perfil } = await admin
    .from("usuarios_sistema").select("rol").eq("id", user.id).single();
  if ((perfil as any)?.rol !== "admin") {
    return NextResponse.json({ error: "Solo admins pueden subir certificados" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const asistenciaId = formData.get("asistencia_id") as string | null;

  if (!file || !asistenciaId) {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }

  // Subir a la API interna de archivos (Google Drive proxy)
  const uploadForm = new FormData();
  uploadForm.set("file", file);
  uploadForm.set("folder", "certificados");

  const origin = req.nextUrl.origin;
  const uploadRes = await fetch(`${origin}/api/archivos/upload`, {
    method: "POST",
    body: uploadForm,
    headers: { cookie: req.headers.get("cookie") ?? "" },
  });

  if (!uploadRes.ok) {
    const err = await uploadRes.text();
    return NextResponse.json({ error: `Error al subir: ${err}` }, { status: 500 });
  }

  const uploadJson = await uploadRes.json();
  const url = uploadJson.url ?? uploadJson.webViewLink ?? uploadJson.id ?? null;

  if (!url) {
    return NextResponse.json({ error: "No se obtuvo URL del archivo" }, { status: 500 });
  }

  // Actualizar el registro de asistencia
  const { error: upErr } = await admin
    .from("asistencia")
    .update({ certificado_url: url })
    .eq("id", asistenciaId);

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
  return NextResponse.json({ ok: true, url });
}
