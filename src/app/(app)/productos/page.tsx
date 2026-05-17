import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import ProductosView from "./productos-view";

export default async function ProductosPage() {
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: perfil } = user
    ? await admin.from("usuarios_sistema").select("rol").eq("id", user.id).single()
    : { data: null };
  const esAdmin = (perfil as any)?.rol === "admin";

  let { data: productos, error: productosError } = await supabase
    .from("productos")
    .select("id, nombre, categoria, codigo_barras, precio, precio_compra, descuento_maximo, foto_url, activo")
    .eq("tipo", "producto")
    .eq("activo", true)
    .order("nombre");

  if (productosError) {
    const fallback = await supabase
      .from("productos")
      .select("id, nombre, categoria, precio, descuento_maximo, foto_url, activo")
      .eq("tipo", "producto")
      .eq("activo", true)
      .order("nombre");
    productos = fallback.data;
  }

  const { data: stockRows } = await supabase
    .from("stock")
    .select("producto_id, cantidad");

  const stockMap: Record<string, number> = {};
  for (const s of stockRows ?? []) {
    stockMap[(s as any).producto_id] = (s as any).cantidad ?? 0;
  }

  return (
    <ProductosView
      productos={(productos as any[]) ?? []}
      stockMap={stockMap}
      esAdmin={esAdmin}
    />
  );
}
