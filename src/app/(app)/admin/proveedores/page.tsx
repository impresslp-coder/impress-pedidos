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

  const { data: configs } = await supabase
    .from("config_proveedores")
    .select("*")
    .order("proveedor");

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-zinc-800">Config. proveedores terciarizados</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Precio base y porcentaje de markup para el cálculo automático del total en encargos.
          Esta pantalla es solo visible para administradores.
        </p>
      </div>
      <ProveedoresManager configs={configs ?? []} />
    </div>
  );
}
