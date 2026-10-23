import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import MantenimientoProductos from "./mantenimiento-productos";

export const dynamic = "force-dynamic";

export default async function MantenimientoProductosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const admin = createAdminClient();
  const { data: perfil } = await admin.from("usuarios_sistema").select("rol").eq("id", user.id).single();
  if (perfil?.rol !== "admin") redirect("/");
  const { data: productos } = await admin.from("productos")
    .select("id,nombre,codigo_barras,carrera,materia,paginas,precio,activo,es_servicio,revisar,revisar_motivo,anillo_mm,anillos_cant")
    .or("tipo.eq.encargo,es_servicio.eq.true").order("nombre");
  return <MantenimientoProductos productos={productos ?? []} />;
}
