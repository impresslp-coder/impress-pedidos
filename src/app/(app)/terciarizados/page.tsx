import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const ESTADOS = ["Todos", "Encargo recibido", "En proceso", "Listo", "Entregado", "Cancelado"];

export default async function TerciarizadosPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const { estado } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("terciarizados")
    .select("*")
    .order("creado_en", { ascending: false })
    .limit(100);

  if (estado && estado !== "Todos") query = query.eq("estado", estado);

  const { data: encargos } = await query;

  const fmt = (n: number | null) =>
    n != null
      ? new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(n)
      : "—";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-800">Terciarizados</h1>
        <Link
          href="/terciarizados/nuevo"
          className="px-4 py-2 rounded-lg bg-[#f5a623] text-[#1a1a2e] font-semibold text-sm hover:bg-[#d4881a] transition"
        >
          + Nuevo encargo
        </Link>
      </div>

      <form method="get" className="flex gap-2">
        <select
          name="estado"
          defaultValue={estado || "Todos"}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#f5a623]"
        >
          {ESTADOS.map((e) => <option key={e}>{e}</option>)}
        </select>
        <button type="submit" className="px-4 py-2 rounded-lg bg-[#1a1a2e] text-white text-sm font-medium hover:bg-[#16213e] transition">
          Filtrar
        </button>
      </form>

      <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-x-auto">
        {encargos && encargos.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-zinc-600">Nro</th>
                <th className="text-left px-4 py-3 font-semibold text-zinc-600">Cliente</th>
                <th className="text-left px-4 py-3 font-semibold text-zinc-600">Item</th>
                <th className="text-left px-4 py-3 font-semibold text-zinc-600">Proveedor</th>
                <th className="text-left px-4 py-3 font-semibold text-zinc-600">Estado</th>
                <th className="text-left px-4 py-3 font-semibold text-zinc-600">Sucursal</th>
                <th className="text-right px-4 py-3 font-semibold text-zinc-600">Total</th>
                <th className="text-left px-4 py-3 font-semibold text-zinc-600">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {encargos.map((e) => (
                <tr key={e.id} className="hover:bg-zinc-50 transition">
                  <td className="px-4 py-3 font-mono font-bold text-[#1a1a2e]">{e.numero}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-zinc-800">{e.cliente}</p>
                    {e.telefono && (
                      <a href={`https://wa.me/${e.telefono}`} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-emerald-600 hover:underline">
                        💬 {e.telefono}
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">
                    <p>{e.item}</p>
                    {e.anotacion && <p className="text-xs text-zinc-400 italic">{e.anotacion}</p>}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{e.proveedor || "—"}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                      {e.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{e.sucursal || "—"}</td>
                  <td className="px-4 py-3 text-right font-semibold">{fmt(e.total)}</td>
                  <td className="px-4 py-3 text-zinc-500">
                    {e.fecha ? new Date(e.fecha).toLocaleDateString("es-AR") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-zinc-400 text-center py-12">Sin encargos</p>
        )}
      </div>
    </div>
  );
}
