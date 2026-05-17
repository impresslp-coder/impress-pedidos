import { createClient } from "@/lib/supabase/server";
import VentasForm from "./ventas-form";

export default async function VentasPage() {
  const supabase = await createClient();

  let { data: productos, error: productosError } = await supabase
    .from("productos")
    .select("id, nombre, categoria, precio, descuento_maximo, foto_url, codigo_barras")
    .eq("tipo", "producto")
    .eq("activo", true)
    .order("nombre");

  if (productosError) {
    const fallback = await supabase
      .from("productos")
      .select("id, nombre, categoria, precio, descuento_maximo, foto_url")
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

  const { data: ventasRecientes } = await supabase
    .from("ventas")
    .select("id, numero_venta, fecha, total, medio_pago, items_venta(producto_nombre, cantidad)")
    .order("creado_en", { ascending: false })
    .limit(20);

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

  const { data: configRows } = await supabase
    .from("configuracion")
    .select("clave, valor")
    .in("clave", [
      "ventas_tipos_papel",
      "ventas_extra_abrochado",
      "ventas_extra_anillado",
      "ventas_extra_encuadernado",
    ]);

  const configVentas: Record<string, string> = {};
  for (const row of configRows ?? []) configVentas[row.clave] = row.valor;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-800">Ventas</h1>
        <p className="text-xs text-zinc-400 mt-0.5">Punto de venta</p>
      </div>

      <VentasForm productos={(productos as any[]) ?? []} topIds={topIds} stockMap={stockMap} config={configVentas} />

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
