import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const admin = createAdminClient();
  const { data: perfil } = await admin
    .from("usuarios_sistema").select("rol").eq("id", user.id).single();
  if ((perfil as any)?.rol !== "admin") {
    return NextResponse.json({ error: "Solo admins pueden cambiar prioridad" }, { status: 403 });
  }

  const { prioridad } = await req.json();
  if (!prioridad) return NextResponse.json({ error: "Falta prioridad" }, { status: 400 });

  const { error } = await admin
    .from("pedidos")
    .update({ prioridad })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  revalidatePath(`/pedidos/${id}`);
  revalidatePath("/pedidos");
  return NextResponse.json({ ok: true });
}
