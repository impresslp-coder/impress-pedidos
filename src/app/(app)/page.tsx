import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const ESTADOS_ACTIVOS = [
  "Encargo recibido",
  "En proceso",
  "Listo para retirar",
];

export default async function DashboardPage() {
  const supabase = await createClient();

  const [{ data: pedidosActivos }, { data: pedidosHoy }, { data: ultimosPedidos }] =
    await Promise.all([
      supabase
        .from("pedidos")
        .select("id", { count: "exact", head: true })
        .in("estado", ESTADOS_ACTIVOS),
      supabase
        .from("pedidos")
        .select("id", { count: "exact", head: true })
        .gte("fecha", new Date().toISOString().split("T")[0]),
      supabase
        .from("pedidos")
        .select(`
          id, numero, fecha, estado, sucursal,
          clientes ( nombre )
        `)
        .order("creado_en", { ascending: false })
        .limit(10),
    ]);

  const acciones = [
    { href: "/pedidos/nuevo", label: "➕ Nuevo pedido", color: "bg-[#f5a623] text-[#1a1a2e]" },
    { href: "/presupuestos/nuevo", label: "📄 Nuevo presupuesto", color: "bg-blue-600 text-white" },
    { href: "/ventas", label: "🛒 Venta de útiles", color: "bg-emerald-600 text-white" },
    { href: "/terciarizados/nuevo", label: "📦 Encargo terciarizado", color: "bg-purple-600 text-white" },
    { href: "/clientes/nuevo", label: "👤 Agregar cliente", color: "bg-zinc-700 text-white" },
    { href: "/reclamos", label: "⚠️ Reclamos", color: "bg-red-600 text-white" },
  ];

  return (
    <div className="space-y-8">
      {/* Título */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-800">Dashboard</h1>
        <p className="text-zinc-500 text-sm mt-1">Panel principal de Impress</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2">
        <div className="bg-white rounded-xl border border-zinc-200 p-5 shadow-sm">
          <p className="text-sm text-zinc-500">Pedidos activos</p>
          <p className="text-3xl font-black text-[#1a1a2e] mt-1">
            {pedidosActivos ?? "—"}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-zinc-200 p-5 shadow-sm">
          <p className="text-sm text-zinc-500">Pedidos hoy</p>
          <p className="text-3xl font-black text-[#f5a623] mt-1">
            {pedidosHoy ?? "—"}
          </p>
        </div>
      </div>

      {/* Acciones rápidas */}
      <div>
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-3">
          Acciones rápidas
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {acciones.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className={`${a.color} rounded-xl px-4 py-3 text-sm font-semibold shadow-sm hover:opacity-90 transition text-center`}
            >
              {a.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Últimos pedidos */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide">
            Últimos pedidos
          </h2>
          <Link href="/pedidos" className="text-sm text-blue-600 hover:underline">
            Ver todos →
          </Link>
        </div>

        <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
          {ultimosPedidos && ultimosPedidos.length > 0 ? (
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 border-b border-zinc-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-zinc-600">Nro</th>
                  <th className="text-left px-4 py-3 font-semibold text-zinc-600">Cliente</th>
                  <th className="text-left px-4 py-3 font-semibold text-zinc-600">Estado</th>
                  <th className="text-left px-4 py-3 font-semibold text-zinc-600">Sucursal</th>
                  <th className="text-left px-4 py-3 font-semibold text-zinc-600">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {ultimosPedidos.map((p) => (
                  <tr key={p.id} className="hover:bg-zinc-50 transition">
                    <td className="px-4 py-3">
                      <Link href={`/pedidos/${p.id}`} className="font-mono font-bold text-[#1a1a2e] hover:text-[#f5a623]">
                        {p.numero}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-zinc-700">
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {(p.clientes as any)?.nombre ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <EstadoBadge estado={p.estado} />
                    </td>
                    <td className="px-4 py-3 text-zinc-500">{p.sucursal || "—"}</td>
                    <td className="px-4 py-3 text-zinc-500">
                      {p.fecha
                        ? new Date(p.fecha).toLocaleDateString("es-AR")
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-zinc-400 text-center py-10">Sin pedidos aún</p>
          )}
        </div>
      </div>
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
  const clase = colores[estado ?? ""] ?? "bg-zinc-100 text-zinc-500";
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${clase}`}>
      {estado ?? "—"}
    </span>
  );
}
