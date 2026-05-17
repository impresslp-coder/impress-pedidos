import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import CatalogoView from "./catalogo-view";

export const dynamic = "force-dynamic";

export default async function CatalogoPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();

  const [
    { data: productos },
    { data: stockRows },
    { data: parametros },
    { data: perfil },
  ] = await Promise.all([
    supabase.from("productos").select("*").eq("activo", true).order("nombre"),
    supabase.from("stock").select("producto_id, cantidad"),
    supabase.from("parametros_precio").select("id, nombre, precio, divisor, descuento_maximo").eq("activo", true).order("nombre"),
    admin.from("usuarios_sistema").select("rol").eq("id", user.id).single(),
  ]);

  const stockMap = Object.fromEntries(
    (stockRows ?? []).map((s: any) => [s.producto_id, s.cantidad])
  );

  const esAdmin = (perfil?.data as any)?.rol === "admin" || (perfil as any)?.rol === "admin";

  return (
    <CatalogoView
      productos={(productos ?? []) as any[]}
      stockMap={stockMap}
      parametros={(parametros ?? []) as any[]}
      esAdmin={esAdmin}
    />
  );
}
