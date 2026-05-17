import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("clientes")
    .select("*")
    .eq("activo", true)
    .order("nombre");

  if (q) {
    query = query.or(`nombre.ilike.%${q}%,telefono.ilike.%${q}%,mail.ilike.%${q}%`);
  }

  const { data: clientes } = await query.limit(100);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-800">Clientes</h1>
        <Link
          href="/clientes/nuevo"
          className="px-4 py-2 rounded-lg bg-[#f5a623] text-[#1a1a2e] font-semibold text-sm hover:bg-[#d4881a] transition"
        >
          + Agregar cliente
        </Link>
      </div>

      {/* Buscador */}
      <form method="get" className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar por nombre, teléfono o email..."
          className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#f5a623]"
        />
        <button
          type="submit"
          className="px-4 py-2 rounded-lg bg-[#1a1a2e] text-white text-sm font-medium hover:bg-[#16213e] transition"
        >
          Buscar
        </button>
        {q && (
          <Link href="/clientes" className="px-4 py-2 rounded-lg bg-zinc-200 text-zinc-700 text-sm hover:bg-zinc-300 transition">
            ✕
          </Link>
        )}
      </form>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-x-auto">
        {clientes && clientes.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-zinc-600">Nombre</th>
                <th className="text-left px-4 py-3 font-semibold text-zinc-600">Teléfono</th>
                <th className="text-left px-4 py-3 font-semibold text-zinc-600">Email</th>
                <th className="text-left px-4 py-3 font-semibold text-zinc-600">WhatsApp</th>
                <th className="text-left px-4 py-3 font-semibold text-zinc-600">Pedidos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {clientes.map((c) => (
                <tr key={c.id} className="hover:bg-zinc-50 transition">
                  <td className="px-4 py-3 font-medium text-zinc-800">{c.nombre}</td>
                  <td className="px-4 py-3 text-zinc-600">{c.telefono || "—"}</td>
                  <td className="px-4 py-3 text-zinc-500">{c.mail || "—"}</td>
                  <td className="px-4 py-3">
                    {c.telefono ? (
                      <a
                        href={`https://wa.me/${c.cod_pais}${c.telefono}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-600 hover:text-emerald-700 font-medium text-xs"
                      >
                        💬 WhatsApp
                      </a>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/pedidos?cliente=${encodeURIComponent(c.nombre)}`}
                      className="text-blue-600 hover:underline text-xs"
                    >
                      Ver pedidos
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-zinc-400 text-center py-12">
            {q ? `Sin resultados para "${q}"` : "No hay clientes todavía"}
          </p>
        )}
      </div>
    </div>
  );
}
