import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import MotorPrecios from "./motor-precios";

export const dynamic = "force-dynamic";

export default async function PreciosAdminPage() {
  const supabase = await import("@/lib/supabase/server").then(({ createClient }) => createClient());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: perfil } = await admin
    .from("usuarios_sistema")
    .select("rol")
    .eq("id", user.id)
    .single();

  if (perfil?.rol !== "admin") redirect("/");

  const [{ data: impresion }, { data: anillos }, { data: tramos }, { data: fijos }, { data: descuentoCatalogo }] = await Promise.all([
    admin.from("precios_impresion").select("*").order("tipo_papel").order("tamano").order("hojas_desde"),
    admin.from("anillos").select("*").order("medida_mm"),
    admin.from("acabados_tramos").select("*").order("paginas_desde"),
    admin.from("acabados_fijos").select("*").order("acabado"),
    admin.from("configuracion").select("clave,valor").eq("clave", "catalogo_descuento_registrado_pct").maybeSingle(),
  ]);

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-zinc-800">Precios</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Las tablas son la única fuente de los importes usados por el cotizador.
        </p>
      </div>
      <MotorPrecios impresion={impresion ?? []} anillos={anillos ?? []} tramos={tramos ?? []} fijos={fijos ?? []} descuentoCatalogoPct={Number(descuentoCatalogo?.valor ?? 0) || 0} />
    </div>
  );
}
