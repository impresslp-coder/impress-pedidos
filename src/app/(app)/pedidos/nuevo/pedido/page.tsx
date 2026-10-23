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
  const cargarProductosActivos = async () => {
    const paginas = await Promise.all(
      Array.from({ length: 5 }, (_, pagina) =>
        admin
          .from("productos")
          .select("id, nombre, paginas, precio, categoria, tipo, es_servicio, anillo_mm, anillos_cant")
          .eq("activo", true)
          .order("nombre")
          .range(pagina * 1000, pagina * 1000 + 999),
      ),
    );
    return paginas.flatMap(({ data }) => data ?? []);
  };

  const [
    clientes, productosBase, { data: anillos }, { data: acabadosFijos },
    { data: configRows }, { data: sucursales }, { data: perfil },
  ] = await Promise.all([
    cargarClientesActivos(),
    cargarProductosActivos(),
    (admin as any).from("anillos").select("medida_mm, precio").eq("activo", true),
    (admin as any).from("acabados_fijos").select("acabado, tamano, precio").eq("acabado", "encuadernado").eq("tamano", "A4").eq("activo", true).maybeSingle(),
    supabase.from("configuracion").select("clave, valor"),
    supabase.from("sucursales").select("id, nombre").eq("activo", true).order("nombre"),
    user ? admin.from("usuarios_sistema").select("codigo_personal").eq("id", user.id).single() : Promise.resolve({ data: null }),
  ]);

  const config: Record<string, string> = {};
  for (const row of configRows ?? []) config[row.clave] = row.valor;
  const descuentoCatalogoPct = Math.max(0, Math.min(100, Number(config.catalogo_descuento_registrado_pct ?? 0) || 0));
  const precioPorAnillo = new Map<number, number>(
    (anillos ?? []).map((a: any) => [Number(a.medida_mm), Number(a.precio ?? 0)]),
  );
  const productos = ((productosBase as any[]) ?? []).map((producto) => {
    const esApunte = producto.tipo === "encargo" && !producto.es_servicio;
    const anillado = esApunte
      ? (precioPorAnillo.get(Number(producto.anillo_mm)) ?? 0) * Number(producto.anillos_cant ?? 0)
      : 0;
    const precioSinAnillado = Number(producto.precio ?? 0);
    return {
      ...producto,
      precio: precioSinAnillado,
      precio_sin_anillado: precioSinAnillado,
      precio_anillo: anillado,
      precio_anillado: precioSinAnillado + anillado,
    };
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const codigoPersonal: string | null = (perfil as any)?.codigo_personal ?? null;

  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-800 mb-6">Nuevo pedido</h1>
      <PedidoForm
        clientes={clientes ?? []}
        productos={productos}
        config={config}
        sucursales={sucursales ?? []}
        codigoPersonal={codigoPersonal}
        precioEncuadernado={acabadosFijos?.precio != null ? Number(acabadosFijos.precio) : null}
        descuentoCatalogoPct={descuentoCatalogoPct}
      />
    </div>
  );
}
