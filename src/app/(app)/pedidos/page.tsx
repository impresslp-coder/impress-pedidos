import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const ESTADOS = [
  "Todos",
  "Encargo recibido",
  "En proceso",
  "Listo para retirar",
  "Entregado",
  "Cancelado",
];

export default async function PedidosPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; cliente?: string; q?: string }>;
}) {
  const { estado, cliente, q } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("pedidos")
    .select(`
      id, numero, fecha, estado, sucursal, medio_contacto,
      clientes ( nombre, telefono, cod_pais )
    `)
    .order("creado_en", { ascending: false })
    .limit(200);

  if (estado && estado !== "Todos") query = query.eq("estado", estado);
  if (cliente) query = query.eq("clientes.nombre", cliente);

  const { data: pedidos } = await query;

  // Filtro texto en cliente (side filter ya que Supabase no filtra relaciones fácil)
  const filtrados = pedidos?.filter((p) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nombreCliente = (p.clientes as any)?.nombre ?? "";
    if (q) return nombreCliente.toLowerCase().includes(q.toLowerCase()) || p.numero.includes(q);
    return true;
  }) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-800">Pedidos</h1>
        <Link
          href="/pedidos/nuevo"
          className="px-4 py-2 rounded-lg bg-[#f5a623] text-[#1a1a2e] font-semibold text-sm hover:bg-[#d4881a] transition"
        >
          + Nuevo pedido
        </Link>
      </div>

      {/* Filtros */}
      <form method="get" className="flex flex-wrap gap-2 items-end">
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar nro o cliente..."
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#f5a623] w-52"
        />
        <select
          name="estado"
          defaultValue={estado || "Todos"}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#f5a623]"
        >
          {ESTADOS.map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
        <button
          type="submit"
          className="px-4 py-2 rounded-lg bg-[#1a1a2e] text-white text-sm font-medium hover:bg-[#16213e] transition"
        >
          Filtrar
        </button>
        {(estado || q) && (
          <Link href="/pedidos" className="px-4 py-2 rounded-lg bg-zinc-200 text-zinc-700 text-sm hover:bg-zinc-300 transition">
            ✕ Limpiar
          </Link>
        )}
      </form>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-x-auto">
        {filtrados.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-zinc-600">Nro</th>
                <th className="text-left px-4 py-3 font-semibold text-zinc-600">Cliente</th>
                <th className="text-left px-4 py-3 font-semibold text-zinc-600">Estado</th>
                <th className="text-left px-4 py-3 font-semibold text-zinc-600">Sucursal</th>
                <th className="text-left px-4 py-3 font-semibold text-zinc-600">Contacto</th>
                <th className="text-left px-4 py-3 font-semibold text-zinc-600">Fecha</th>
                <th className="text-left px-4 py-3 font-semibold text-zinc-600"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filtrados.map((p) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const cli = p.clientes as any;
                return (
                  <tr key={p.id} className="hover:bg-zinc-50 transition">
                    <td className="px-4 py-3 font-mono font-bold text-[#1a1a2e]">
                      {p.numero}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-zinc-800">{cli?.nombre ?? "—"}</div>
                      {cli?.telefono && (
                        <a
                          href={`https://wa.me/${cli.cod_pais}${cli.telefono}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-emerald-600 hover:underline"
                        >
                          💬 {cli.telefono}
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <EstadoBadge estado={p.estado} />
                    </td>
                    <td className="px-4 py-3 text-zinc-500">{p.sucursal || "—"}</td>
                    <td className="px-4 py-3 text-zinc-500">{p.medio_contacto || "—"}</td>
                    <td className="px-4 py-3 text-zinc-500">
                      {p.fecha ? new Date(p.fecha).toLocaleDateString("es-AR") : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/pedidos/${p.id}`}
                        className="text-blue-600 hover:underline text-xs font-medium"
                      >
                        Ver →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="text-zinc-400 text-center py-12">Sin pedidos</p>
        )}
      </div>

      <p className="text-xs text-zinc-400">Mostrando {filtrados.length} pedidos</p>
    </div>
  );
}

function EstadoBadge({ estado }: { estado: string | null }) {
  const colores: Record<string, string> = {
    "Encargo recibido": "bg-blue-100 text-blue-700",
    "En proceso": "bg-amber-100 text-amber-700",
    "Listo para retirar": "bg-emerald-100 text-emerald-700",
    "Entregado": "bg-zinc-100 text-zinc-500",
    "Cancelado": "bg-red-100 text-red-600",
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${colores[estado ?? ""] ?? "bg-zinc-100 text-zinc-500"}`}>
      {estado ?? "—"}
    </span>
  );
}
