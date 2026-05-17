import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import EncargosView from "./encargos-view";

export default async function EncargosPage() {
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: perfil } = user
    ? await admin.from("usuarios_sistema").select("rol").eq("id", user.id).single()
    : { data: null };
  const esAdmin = (perfil as any)?.rol === "admin";

  const { data: productos } = await supabase
    .from("productos")
    .select("id, nombre, categoria, paginas, precio, descuento_maximo, foto_url, activo")
    .or("tipo.eq.encargo,tipo.is.null")
    .eq("activo", true)
    .order("nombre");

  const { data: stockRows } = await supabase
    .from("stock")
    .select("producto_id, cantidad");

  const { data: parametros } = await supabase
    .from("parametros_precio")
    .select("id, nombre, precio, divisor")
    .eq("activo", true)
    .order("nombre");

  const stockMap: Record<string, number> = {};
  for (const s of stockRows ?? []) {
    stockMap[(s as any).producto_id] = (s as any).cantidad ?? 0;
  }

  return (
    <EncargosView
      productos={(productos as any[]) ?? []}
      stockMap={stockMap}
      parametros={(parametros as any[]) ?? []}
      esAdmin={esAdmin}
    />
  );
}
