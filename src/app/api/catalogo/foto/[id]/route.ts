import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const admin = createAdminClient();
  const { data: perfil } = await admin.from("usuarios_sistema").select("rol").eq("id", user.id).single();
  if ((perfil as any)?.rol !== "admin") return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "Sin archivo" }, { status: 400 });

  // Upload to Google Drive
  const { uploadPDF } = await import("@/lib/google-drive");
  let driveId: string;
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    driveId = await uploadPDF(buf, `foto_producto_${id}_${Date.now()}_${file.name}`);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }

  const fotoUrl = `https://drive.google.com/uc?export=view&id=${driveId}`;
  const { error } = await admin.from("productos").update({ foto_url: fotoUrl }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ foto_url: fotoUrl });
}
