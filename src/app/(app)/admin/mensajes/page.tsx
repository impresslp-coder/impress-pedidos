import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import PlantillasMensajeClient from "./plantillas-mensaje-client";

export const dynamic = "force-dynamic";

export default async function MensajesAdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const admin = createAdminClient();
  const { data: perfil } = await admin.from("usuarios_sistema").select("rol").eq("id", user.id).maybeSingle();
  if (perfil?.rol !== "admin") redirect("/pedidos");
  const { data: plantillas } = await admin
    .from("plantillas_mensaje")
    .select("codigo, nombre, cuerpo, activo")
    .in("codigo", ["retiro", "envio"])
    .order("orden");
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-zinc-800">Mensajes de WhatsApp</h1>
        <p className="mt-1 text-sm text-zinc-500">Editá las plantillas que se abren cuando un pedido queda listo.</p>
      </div>
      <PlantillasMensajeClient plantillas={(plantillas as any[]) ?? []} />
    </div>
  );
}
