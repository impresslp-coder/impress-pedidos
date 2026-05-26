"use client";

import { useState, useTransition } from "react";
import { registrarReclamo } from "../../reclamos/actions";

type Reclamo = {
  id: string;
  numero_reclamo: string;
  texto: string;
  sucursal: string | null;
  estado: string | null;
  creado_en: string | null;
};

export default function ReclamosPanel({
  pedidoNumero,
  reclamosIniciales,
}: {
  pedidoNumero: string;
  reclamosIniciales: Reclamo[];
}) {
  const [reclamos, setReclamos] = useState<Reclamo[]>(reclamosIniciales);
  const [texto, setTexto] = useState("");
  const [sucursal, setSucursal] = useState("");
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!texto.trim()) return;
    setError(undefined);
    setSuccess(undefined);

    const fd = new FormData();
    fd.set("pedido_numero", pedidoNumero);
    fd.set("texto", texto);
    fd.set("sucursal", sucursal);

    startTransition(async () => {
      const res = await registrarReclamo(undefined, fd);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setSuccess(`Reclamo registrado: ${res?.numero}`);
      // Optimistically add to list
      setReclamos((prev) => [
        {
          id: res?.numero ?? "",
          numero_reclamo: res?.numero ?? "",
          texto,
          sucursal: sucursal || null,
          estado: "Reclamo recibido",
          creado_en: new Date().toISOString(),
        },
        ...prev,
      ]);
      setTexto("");
      setSucursal("");
    });
  };

  return (
    <section className="bg-white rounded-xl border border-zinc-200 shadow-sm p-5 space-y-4">
      <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Reclamos</h2>

      {/* Existing reclamos */}
      {reclamos.length > 0 ? (
        <ul className="space-y-2">
          {reclamos.map((r) => (
            <li key={r.id} className="flex items-start gap-3 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm">
              <span className="text-base shrink-0">⚠️</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs text-zinc-400">{r.numero_reclamo}</span>
                  {r.sucursal && <span className="text-xs text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-full">{r.sucursal}</span>}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    r.estado === "Resuelto" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                  }`}>{r.estado ?? "Reclamo recibido"}</span>
                  {r.creado_en && (
                    <span className="text-xs text-zinc-400">
                      {new Date(r.creado_en).toLocaleDateString("es-AR")}
                    </span>
                  )}
                </div>
                <p className="text-zinc-700 mt-1">{r.texto}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-zinc-400 italic">Sin reclamos registrados para este pedido.</p>
      )}

      {/* New reclamo form */}
      <form onSubmit={handleSubmit} className="space-y-3 border-t border-zinc-100 pt-4">
        <p className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Registrar nuevo reclamo</p>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Describí el problema..."
          rows={3}
          suppressHydrationWarning
          className="w-full rounded-xl border-2 border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:border-red-300 transition resize-none"
        />
        <div className="flex gap-3">
          <input
            value={sucursal}
            onChange={(e) => setSucursal(e.target.value)}
            placeholder="Sucursal (opcional)"
            suppressHydrationWarning
            className="flex-1 rounded-xl border-2 border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:border-red-300 transition"
          />
          <button
            type="submit"
            disabled={isPending || !texto.trim()}
            className="px-5 py-2 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700 disabled:opacity-40 transition"
          >
            {isPending ? "Guardando..." : "Registrar"}
          </button>
        </div>
        {error && <p className="text-xs text-red-600 font-medium bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        {success && <p className="text-xs text-emerald-600 font-medium bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">✓ {success}</p>}
      </form>
    </section>
  );
}
