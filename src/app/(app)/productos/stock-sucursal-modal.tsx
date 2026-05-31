"use client";

import { useState, useEffect } from "react";

type StockRow = { id: string; sucursal: string; cantidad: number; updated_at: string };

export default function StockSucursalModal({
  productoId,
  productoNombre,
  esAdmin,
  onClose,
}: {
  productoId: string;
  productoNombre: string;
  esAdmin: boolean;
  onClose: () => void;
}) {
  const [stock, setStock]       = useState<StockRow[]>([]);
  const [cargando, setCargando] = useState(true);
  const [editId, setEditId]     = useState<string | null>(null);
  const [editVal, setEditVal]   = useState("");
  const [nuevaSuc, setNuevaSuc] = useState("");
  const [nuevaCant, setNuevaCant] = useState("0");
  const [guardando, setGuardando] = useState(false);
  const [error, setError]       = useState<string>();

  const cargar = () => {
    setCargando(true);
    fetch(`/api/stock-sucursal?producto_id=${productoId}`)
      .then((r) => r.json())
      .then((json) => setStock(json.stock ?? []))
      .catch(() => {})
      .finally(() => setCargando(false));
  };

  useEffect(() => { cargar(); }, [productoId]);

  const guardar = async (sucursal: string, cantidad: number) => {
    setGuardando(true);
    setError(undefined);
    const res = await fetch("/api/stock-sucursal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ producto_id: productoId, sucursal, cantidad }),
    });
    const json = await res.json();
    if (!res.ok) { setError(json.error); setGuardando(false); return; }
    setGuardando(false);
    setEditId(null);
    setNuevaSuc(""); setNuevaCant("0");
    cargar();
  };

  const totalStock = stock.reduce((a, s) => a + s.cantidad, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-[480px] max-w-[95vw] space-y-5 border border-zinc-100">

        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-black text-zinc-800 text-lg">Stock por sucursal</h3>
            <p className="text-sm text-zinc-500 mt-0.5">{productoNombre}</p>
          </div>
          <button onClick={onClose}
            className="text-zinc-400 hover:text-zinc-700 text-2xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-zinc-100">×</button>
        </div>

        {cargando ? (
          <p className="text-sm text-zinc-400 text-center py-4">Cargando...</p>
        ) : stock.length === 0 && !esAdmin ? (
          <p className="text-sm text-zinc-400 text-center py-4">Sin stock registrado por sucursal.</p>
        ) : (
          <div className="space-y-2">
            {stock.map((row) => (
              <div key={row.id}
                className={`flex items-center justify-between px-4 py-3 rounded-xl border ${
                  row.cantidad > 0 ? "border-emerald-200 bg-emerald-50" : "border-zinc-200 bg-zinc-50"
                }`}>
                <div>
                  <p className="font-semibold text-zinc-800 text-sm">{row.sucursal}</p>
                  <p className="text-xs text-zinc-400">
                    Actualizado: {new Date(row.updated_at).toLocaleDateString("es-AR")}
                  </p>
                </div>

                {editId === row.id && esAdmin ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="number" min="0" value={editVal}
                      onChange={(e) => setEditVal(e.target.value)}
                      suppressHydrationWarning
                      className="w-20 rounded-lg border-2 border-zinc-200 px-2 py-1 text-sm font-bold text-center focus:outline-none focus:border-[#f5a623]"
                      autoFocus
                    />
                    <button onClick={() => guardar(row.sucursal, parseInt(editVal) || 0)}
                      disabled={guardando}
                      className="px-3 py-1 bg-[#f5a623] text-[#1a1a2e] rounded-lg text-xs font-bold hover:bg-amber-400 transition disabled:opacity-50">
                      ✓
                    </button>
                    <button onClick={() => setEditId(null)}
                      className="px-2 py-1 bg-zinc-100 rounded-lg text-xs text-zinc-500 hover:bg-zinc-200 transition">
                      ✕
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className={`text-2xl font-black ${row.cantidad > 0 ? "text-emerald-700" : "text-zinc-400"}`}>
                      {row.cantidad}
                    </span>
                    {esAdmin && (
                      <button onClick={() => { setEditId(row.id); setEditVal(String(row.cantidad)); }}
                        className="text-xs text-zinc-400 hover:text-zinc-700 transition">
                        ✏️
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* Total */}
            {stock.length > 1 && (
              <div className="flex justify-between px-4 py-2 bg-zinc-100 rounded-xl text-sm font-bold text-zinc-700">
                <span>Total en todas las sucursales</span>
                <span>{totalStock}</span>
              </div>
            )}

            {/* Agregar nueva sucursal — solo admin */}
            {esAdmin && (
              <div className="border-t border-zinc-100 pt-3 space-y-2">
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Agregar sucursal</p>
                <div className="flex gap-2">
                  <input value={nuevaSuc} onChange={(e) => setNuevaSuc(e.target.value)}
                    suppressHydrationWarning placeholder="Nombre sucursal"
                    className="flex-1 rounded-xl border-2 border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:border-[#f5a623]" />
                  <input type="number" min="0" value={nuevaCant}
                    onChange={(e) => setNuevaCant(e.target.value)}
                    suppressHydrationWarning
                    className="w-20 rounded-xl border-2 border-zinc-200 px-3 py-2 text-sm font-bold text-center focus:outline-none focus:border-[#f5a623]" />
                  <button onClick={() => guardar(nuevaSuc, parseInt(nuevaCant) || 0)}
                    disabled={!nuevaSuc.trim() || guardando}
                    className="px-4 py-2 bg-[#1a1a2e] text-white rounded-xl text-sm font-bold hover:bg-zinc-800 disabled:opacity-40 transition">
                    +
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
      </div>
    </div>
  );
}
