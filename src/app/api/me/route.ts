import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const admin = createAdminClient();
  const { data: perfil } = await admin
    .from("usuarios_sistema")
    .select("nombre, rol, codigo_personal")
    .eq("id", user.id)
    .single();

  return NextResponse.json({
    id: user.id,
    email: user.email,
    nombre: perfil?.nombre ?? null,
    rol: perfil?.rol ?? "operador",
    codigo_personal: perfil?.codigo_personal ?? null,
  });
}
