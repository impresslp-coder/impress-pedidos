"use client";

import { useState } from "react";

type Config = {
  id: string;
  proveedor: string;
  precio_base: number;
  porcentaje: number;
};

export default function ProveedoresManager({ configs: inicial }: { configs: Config[] }) {
  const [configs, setConfigs]     = useState<Config[]>(inicial);
  const [editando, setEditando]   = useState<string | null>(null);
  const [form, setForm]           = useState({ precio_base: "", porcentaje: "" });
  const [guardando, setGuardando] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [ok, setOk]               = useState<string | null>(null);

  const iniciarEdicion = (c: Config) => {
    setEditando(c.id);
    setForm({ precio_base: String(c.precio_base), porcentaje: String(c.porcentaje) });
    setError(null);
    setOk(null);
  };

  const cancelar = () => {
    setEditando(null);
    setError(null);
  };

  const guardar = async (id: string) => {
    setGuardando(true);
    setError(null);
    const res = await fetch("/api/admin/proveedores", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        precio_base: parseFloat(form.precio_base) || 0,
        porcentaje:  parseFloat(form.porcentaje)  || 0,
      }),
    });
    const json = await res.json();
    if (!res.ok || json.error) {
      setError(json.error ?? "Error al guardar");
    } else {
      setConfigs((prev) => prev.map((c) => (c.id === id ? { ...c, ...json.config } : c)));
      setEditando(null);
      setOk(`✅ ${json.config.proveedor} actualizado correctamente`);
      setTimeout(() => setOk(null), 3000);
    }
    setGuardando(false);
  };

  const inputCls =
    "rounded-lg border border-zinc-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 w-28";

  return (
    <div className="space-y-4">
      {ok && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{ok}</p>
      )}
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 border-b border-zinc-200">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-zinc-600">Proveedor</th>
              <th className="text-left px-4 py-3 font-semibold text-zinc-600">Precio base ($)</th>
              <th className="text-left px-4 py-3 font-semibold text-zinc-600">Porcentaje (%)</th>
              <th className="text-left px-4 py-3 font-semibold text-zinc-600">Total calculado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {configs.map((c) => {
              const esEditando = editando === c.id;
              const base  = esEditando ? parseFloat(form.precio_base) || 0 : c.precio_base;
              const pct   = esEditando ? parseFloat(form.porcentaje)  || 0 : c.porcentaje;
              const total = base * (pct / 100);

              return (
                <tr key={c.id} className="hover:bg-zinc-50 transition">
                  <td className="px-4 py-3 font-semibold text-zinc-800">{c.proveedor}</td>

                  <td className="px-4 py-3">
                    {esEditando ? (
                      <input
                        type="number"
                        value={form.precio_base}
                        onChange={(e) => setForm((f) => ({ ...f, precio_base: e.target.value }))}
                        className={inputCls}
                        min="0"
                        step="0.01"
                      />
                    ) : (
                      <span className="font-mono">${c.precio_base}</span>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    {esEditando ? (
                      <input
                        type="number"
                        value={form.porcentaje}
                        onChange={(e) => setForm((f) => ({ ...f, porcentaje: e.target.value }))}
                        className={inputCls}
                        min="0"
                        step="0.01"
                      />
                    ) : (
                      <span className="font-mono">{c.porcentaje}%</span>
                    )}
                  </td>

                  <td className="px-4 py-3 font-mono font-semibold" style={{ color: "#1a1a2e" }}>
                    ${total.toFixed(2)}
                  </td>

                  <td className="px-4 py-3 text-right">
                    {esEditando ? (
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => guardar(c.id)}
                          disabled={guardando}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-50 transition"
                          style={{ backgroundColor: "#f5a623", color: "#1a1a2e" }}
                        >
                          {guardando ? "..." : "Guardar"}
                        </button>
                        <button
                          onClick={cancelar}
                          className="px-3 py-1.5 rounded-lg text-xs border border-zinc-200 hover:bg-zinc-100 transition text-zinc-600"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => iniciarEdicion(c)}
                        className="px-3 py-1.5 rounded-lg text-xs border border-zinc-200 hover:bg-zinc-100 transition text-zinc-600"
                      >
                        Editar
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="bg-amber-50 rounded-xl border border-amber-100 px-4 py-3 text-xs text-zinc-600 space-y-1">
        <p className="font-semibold text-zinc-800">¿Cómo funciona el cálculo?</p>
        <p>Total = Precio base × Porcentaje ÷ 100</p>
        <p className="text-zinc-400">Ejemplo: base $200 × 150% = $300 | base $200 × 100% = $200</p>
      </div>
    </div>
  );
}
