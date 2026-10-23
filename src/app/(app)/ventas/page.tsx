import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import VentasForm from "./ventas-form";

export default async function VentasPage() {
  const supabase = await createClient();
  const admin = createAdminClient();

  // PostgREST limita cada respuesta a 1.000 filas. El catálogo supera ese
  // límite, así que se leen todas las páginas antes de pasarlas al buscador.
  const paginasProductos = await Promise.all(
    Array.from({ length: 5 }, (_, pagina) =>
      admin
        .from("productos")
        .select("id, nombre, categoria, precio, descuento_maximo, foto_url, codigo_barras, tipo, es_servicio, anillo_mm, anillos_cant")
        .in("tipo", ["producto", "encargo"])
        .eq("activo", true)
        .order("nombre")
        .range(pagina * 1000, pagina * 1000 + 999),
    ),
  );
  const productosBase = paginasProductos.flatMap(({ data }) => data ?? []);

  // En el POS, un apunte se cobra con su impresión más el anillado físico
  // calculado. No consume stock: se produce al momento de la venta.
  const { data: anillos } = await (admin as any)
    .from("anillos")
    .select("medida_mm, precio")
    .eq("activo", true);
  const precioAnillo = new Map<number, number>(
    (anillos ?? []).map((a: any) => [Number(a.medida_mm), Number(a.precio ?? 0)]),
  );
  const { data: descuentoCatalogo } = await supabase
    .from("configuracion")
    .select("valor")
    .eq("clave", "catalogo_descuento_registrado_pct")
    .maybeSingle();
  const descuentoCatalogoPct = Math.max(0, Math.min(100, Number(descuentoCatalogo?.valor ?? 0) || 0));
  const productos = ((productosBase as any[]) ?? []).map((producto) => {
    const esApunte = producto.tipo === "encargo" && !producto.es_servicio;
    const extraAnillado = esApunte
      ? (precioAnillo.get(Number(producto.anillo_mm)) ?? 0) * Number(producto.anillos_cant ?? 0)
      : 0;
    const precioLista = Number(producto.precio ?? 0) + extraAnillado;
    return {
      ...producto,
      precio: esApunte ? Math.round(precioLista * (1 - descuentoCatalogoPct / 100)) : precioLista,
      precio_lista: precioLista,
      descuento_registrado_pct: esApunte ? descuentoCatalogoPct : 0,
    };
  });

  const { data: stockRows } = await supabase
    .from("stock")
    .select("producto_id, cantidad");

  const stockMap: Record<string, number> = {};
  for (const s of stockRows ?? []) {
    stockMap[(s as any).producto_id] = (s as any).cantidad ?? 0;
  }

  const [{ data: ventasRecientes }, { data: clientes }, { data: presupuestosPendientes }] = await Promise.all([
    supabase
    .from("ventas")
    .select("id, numero_venta, fecha, total, medio_pago, items_venta(producto_nombre, cantidad)")
    .order("creado_en", { ascending: false })
    .limit(20),
    supabase.from("clientes").select("id, nombre").eq("activo", true).order("nombre"),
    (supabase.from("presupuestos") as any)
      .select("id, numero, total, fecha_vencimiento, cliente_id, clientes(nombre), items_presupuesto(producto_id, producto, precio, descuento, unidades)")
      .eq("estado", "vigente")
      .order("creado_en", { ascending: false })
      .limit(30),
  ]);

  const { data: itemsVendidos } = await supabase
    .from("items_venta")
    .select("producto_id, cantidad")
    .not("producto_id", "is", null);

  const vendidosMap = new Map<string, number>();
  for (const item of itemsVendidos ?? []) {
    const id = (item as any).producto_id as string | null;
    if (!id) continue;
    vendidosMap.set(id, (vendidosMap.get(id) ?? 0) + ((item as any).cantidad ?? 0));
  }

  const topIds = [...vendidosMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([id]) => id);

  const { data: sucursales } = await supabase
    .from("sucursales")
    .select("id, nombre")
    .eq("activo", true)
    .order("nombre");

  return (
    <div className="space-y-6">
      <VentasForm
        productos={(productos as any[]) ?? []}
        topIds={topIds}
        stockMap={stockMap}
        sucursales={(sucursales as any[]) ?? []}
        clientes={(clientes as any[]) ?? []}
        presupuestosPendientes={(presupuestosPendientes as any[]) ?? []}
      />

      <div>
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-3">Ultimas ventas</h2>
        <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-x-auto">
          {ventasRecientes && ventasRecientes.length > 0 ? (
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 border-b border-zinc-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-zinc-600">Nro</th>
                  <th className="text-left px-4 py-3 font-semibold text-zinc-600">Productos</th>
                  <th className="text-left px-4 py-3 font-semibold text-zinc-600">Pago</th>
                  <th className="text-right px-4 py-3 font-semibold text-zinc-600">Total</th>
                  <th className="text-left px-4 py-3 font-semibold text-zinc-600">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {ventasRecientes.map((v) => {
                  const items = (v.items_venta as any[]) ?? [];
                  return (
                    <tr key={v.id} className="hover:bg-zinc-50 transition">
                      <td className="px-4 py-3 font-mono font-bold text-[#1a1a2e]">{v.numero_venta}</td>
                      <td className="px-4 py-3 text-zinc-600 max-w-[240px] truncate">
                        {items.map((i: any) => `${i.producto_nombre} x${i.cantidad}`).join(", ")}
                      </td>
                      <td className="px-4 py-3 text-zinc-500 capitalize">{(v as any).medio_pago || "-"}</td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {v.total != null
                          ? new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(v.total)
                          : "-"}
                      </td>
                      <td className="px-4 py-3 text-zinc-500">
                        {v.fecha ? new Date(v.fecha).toLocaleDateString("es-AR") : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p className="text-zinc-400 text-center py-10 text-sm">Sin ventas aun</p>
          )}
        </div>
      </div>
    </div>
  );
}
