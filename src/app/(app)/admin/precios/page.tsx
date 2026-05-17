import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import PreciosManager from "./precios-manager";

export const dynamic = "force-dynamic";

export default async function PreciosAdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: perfil } = await admin
    .from("usuarios_sistema")
    .select("rol")
    .eq("id", user.id)
    .single();

  if (perfil?.rol !== "admin") redirect("/");

  const [{ data: productos }, { data: parametros }, { data: configRows }, { data: sucursales }] = await Promise.all([
    supabase.from("productos").select("*").order("nombre"),
    supabase.from("parametros_precio").select("*").order("nombre"),
    supabase.from("configuracion").select("clave, valor"),
    supabase.from("sucursales").select("*").order("nombre"),
  ]);

  const config: Record<string, string> = {};
  for (const row of configRows ?? []) config[row.clave] = row.valor;

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-zinc-800">Precios</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Configurá los parámetros de precio, defaults, sucursales y el catálogo de productos.
        </p>
      </div>
      <PreciosManager productos={productos ?? []} parametros={parametros ?? []} config={config} sucursales={sucursales ?? []} />
    </div>
  );
}
