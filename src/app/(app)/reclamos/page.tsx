import { createClient } from "@/lib/supabase/server";
import ReclamoForm from "./reclamo-form";

export const dynamic = "force-dynamic";

export default async function ReclamosPage() {
  const supabase = await createClient();

  const { data: reclamos } = await supabase
    .from("reclamos")
    .select("*")
    .order("creado_en", { ascending: false })
    .limit(100);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-zinc-800">Reclamos</h1>

      {/* Formulario */}
      <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-5">
        <h2 className="font-semibold text-zinc-700 text-sm uppercase tracking-wide mb-4">Registrar reclamo</h2>
        <ReclamoForm />
      </div>

      {/* Historial */}
      <div>
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-3">Historial</h2>
        <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-x-auto">
          {reclamos && reclamos.length > 0 ? (
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 border-b border-zinc-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-zinc-600">Nro reclamo</th>
                  <th className="text-left px-4 py-3 font-semibold text-zinc-600">Pedido</th>
                  <th className="text-left px-4 py-3 font-semibold text-zinc-600">Texto</th>
                  <th className="text-left px-4 py-3 font-semibold text-zinc-600">Estado</th>
                  <th className="text-left px-4 py-3 font-semibold text-zinc-600">Sucursal</th>
                  <th className="text-left px-4 py-3 font-semibold text-zinc-600">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {reclamos.map((r) => (
                  <tr key={r.id} className="hover:bg-zinc-50 transition">
                    <td className="px-4 py-3 font-mono font-bold text-[#1a1a2e]">{r.numero_reclamo}</td>
                    <td className="px-4 py-3 font-mono">{r.pedido_numero}</td>
                    <td className="px-4 py-3 text-zinc-600 max-w-xs truncate">{r.texto || "—"}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                        {r.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-500">{r.sucursal || "—"}</td>
                    <td className="px-4 py-3 text-zinc-500">
                      {r.fecha ? new Date(r.fecha).toLocaleDateString("es-AR") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-zinc-400 text-center py-10">Sin reclamos</p>
          )}
        </div>
      </div>
    </div>
  );
}
