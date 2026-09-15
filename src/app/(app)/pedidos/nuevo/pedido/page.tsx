import { createClient } from "@/lib/supabase/server";
import PedidoForm from "../pedido-form";

export default async function NuevoPedidoFormPage() {
  const supabase = await createClient();

  // El máximo de filas de la API de Supabase es 1.000, aun si se solicita un
  // rango mayor. Se cargan páginas para que la búsqueda del selector abarque
  // todos los clientes activos, incluidos los que llegaron por migración.
  const cargarClientesActivos = async () => {
    const paginas = await Promise.all(
      Array.from({ length: 5 }, (_, pagina) =>
        supabase
          .from("clientes")
          .select("id, nombre, telefono, cod_pais")
          .eq("activo", true)
          .order("nombre")
          .range(pagina * 1000, pagina * 1000 + 999)
      )
    );

    return paginas.flatMap(({ data }) => data ?? []);
  };

  const { data: { user } } = await supabase.auth.getUser();
  const admin = (await import("@/lib/supabase/admin")).createAdminClient();

  const [
    clientes, { data: productos }, { data: parametros },
    { data: configRows }, { data: sucursales }, { data: perfil },
  ] = await Promise.all([
    cargarClientesActivos(),
    supabase.from("productos").select("id, nombre, paginas, precio_d, precio_e, precio_f, precio_g, categoria").eq("activo", true).order("nombre"),
    supabase.from("parametros_precio").select("id, nombre, precio, divisor, descuento_maximo").eq("activo", true).order("nombre"),
    supabase.from("configuracion").select("clave, valor"),
    supabase.from("sucursales").select("id, nombre").eq("activo", true).order("nombre"),
    user ? admin.from("usuarios_sistema").select("codigo_personal").eq("id", user.id).single() : Promise.resolve({ data: null }),
  ]);

  const config: Record<string, string> = {};
  for (const row of configRows ?? []) config[row.clave] = row.valor;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const codigoPersonal: string | null = (perfil as any)?.codigo_personal ?? null;

  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-800 mb-6">Nuevo pedido</h1>
      <PedidoForm
        clientes={clientes ?? []}
        productos={productos ?? []}
        parametros={parametros ?? []}
        config={config}
        sucursales={sucursales ?? []}
        codigoPersonal={codigoPersonal}
      />
    </div>
  );
}
