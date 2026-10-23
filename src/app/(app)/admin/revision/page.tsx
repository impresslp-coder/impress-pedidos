import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import ColaRevision from "./cola-revision";

export const dynamic = "force-dynamic";

export default async function RevisionPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const admin = createAdminClient();
  const { data: perfil } = await admin.from("usuarios_sistema").select("rol").eq("id", user.id).single();
  if (perfil?.rol !== "admin") redirect("/");
  const { data } = await admin.from("productos")
    .select("id,nombre,codigo_barras,carrera,materia,paginas,precio,revisar_motivo")
    .eq("revisar", true).order("revisar_motivo").order("nombre");
  return <ColaRevision productos={data ?? []} />;
}
