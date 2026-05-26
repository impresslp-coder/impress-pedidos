import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import ProveedoresManager from "./proveedores-manager";

export const dynamic = "force-dynamic";

export default async function AdminProveedoresPage() {
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

  const { data: proveedores } = await admin
    .from("proveedores")
    .select("*, proveedor_articulos(*)")
    .order("nombre")
    .order("nombre", { referencedTable: "proveedor_articulos" });

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-zinc-800">Proveedores</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Listado de proveedores con sus artículos, precios de costo, markup y tiempos de entrega.
        </p>
      </div>
      <ProveedoresManager proveedores={proveedores ?? []} />
    </div>
  );
}
