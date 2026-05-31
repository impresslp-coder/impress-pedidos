"use client";

import { useState } from "react";

type Encargo = {
  id: string;
  numero: string;
  cliente: string;
  telefono: string | null;
  item: string;
  cantidad: number | null;
  anotacion: string | null;
  proveedor: string | null;
  sucursal: string | null;
  total: number | null;
  senia: number | null;
  estado: string | null;
  creado_en: string | null;
  fecha: string | null;
};

const ESTADOS = ["Todos", "Encargo recibido", "En proceso", "Listo", "Entregado", "Cancelado"];

const ESTADO_COLOR: Record<string, string> = {
  "Encargo recibido": "bg-indigo-100 text-indigo-700",
  "En proceso":       "bg-amber-100 text-amber-700",
  "Listo":            "bg-emerald-100 text-emerald-700",
  "Entregado":        "bg-zinc-100 text-zinc-500",
  "Cancelado":        "bg-red-100 text-red-600",
};

const fmt = (n: number | null) =>
  n != null
    ? new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(n)
    : "—";

const fmtFecha = (s: string | null) =>
  s ? new Date(s).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—";

export default function TerciarizadosListClient({
  encargos,
  esAdmin,
}: {
  encargos: Encargo[];
  esAdmin: boolean;
}) {
  const [q, setQ]             = useState("");
  const [estadoFil, setEstado] = useState("Todos");

  const filtrados = encargos.filter((e) => {
    const matchQ = !q || [e.cliente, e.item, e.numero, e.proveedor ?? ""]
      .some((v) => v.toLowerCase().includes(q.toLowerCase()));
    const matchE = estadoFil === "Todos" || e.estado === estadoFil;
    return matchQ && matchE;
  });

  return (
    <div className="space-y-4">
      {/* Controles */}
      <div className="flex flex-wrap gap-3">
        <input
          value={q} onChange={(e) => setQ(e.target.value)}
          suppressHydrationWarning
          placeholder="Buscar por cliente, ítem o número..."
          className="flex-1 min-w-48 rounded-xl border-2 border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:border-[#f5a623] transition"
        />
        <div className="flex gap-1 flex-wrap">
          {ESTADOS.map((e) => (
            <button key={e} onClick={() => setEstado(e)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                estadoFil === e
                  ? "bg-[#1a1a2e] text-white"
                  : "bg-white border border-zinc-200 text-zinc-500 hover:border-zinc-300"
              }`}>
              {e}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-zinc-400">{filtrados.length} encargo{filtrados.length !== 1 ? "s" : ""}</p>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
        {filtrados.length === 0 ? (
          <p className="text-zinc-400 text-center py-12">Sin encargos para mostrar</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead className="bg-zinc-50 border-b border-zinc-200 text-xs font-semibold text-zinc-500 uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-3">Nro</th>
                  <th className="text-left px-4 py-3">Cliente</th>
                  <th className="text-left px-4 py-3">Ítem</th>
                  {esAdmin && <th className="text-left px-4 py-3">Proveedor</th>}
                  <th className="text-left px-4 py-3">Estado</th>
                  <th className="text-left px-4 py-3">Sucursal</th>
                  <th className="text-right px-4 py-3">Total</th>
                  <th className="text-left px-4 py-3">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filtrados.map((e) => {
                  const resta = (e.total ?? 0) - (e.senia ?? 0);
                  return (
                    <tr key={e.id} className="hover:bg-zinc-50 transition">
                      <td className="px-4 py-3">
                        <span className="font-mono font-bold text-[#1a1a2e] text-sm">{e.numero}</span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-zinc-800">{e.cliente || "—"}</p>
                        {e.telefono && (
                          <a href={`https://wa.me/${e.telefono.replace(/\D/g, "")}`}
                            target="_blank" rel="noopener noreferrer"
                            className="text-xs text-emerald-600 hover:underline inline-flex items-center gap-0.5">
                            💬 {e.telefono}
                          </a>
                        )}
                      </td>
                      <td className="px-4 py-3 max-w-[200px]">
                        <p className="text-zinc-800 font-medium truncate">{e.item}</p>
                        {e.cantidad && <p className="text-xs text-zinc-400">Cant: {e.cantidad}</p>}
                        {e.anotacion && (
                          <p className="text-xs text-zinc-400 italic truncate">{e.anotacion}</p>
                        )}
                      </td>
                      {esAdmin && (
                        <td className="px-4 py-3 text-zinc-500 text-xs">{e.proveedor || "—"}</td>
                      )}
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          ESTADO_COLOR[e.estado ?? ""] ?? "bg-zinc-100 text-zinc-500"
                        }`}>
                          {e.estado ?? "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-500 text-xs">{e.sucursal || "—"}</td>
                      <td className="px-4 py-3 text-right">
                        <p className="font-bold text-zinc-800">{fmt(e.total)}</p>
                        {(e.senia ?? 0) > 0 && (
                          <p className={`text-xs font-medium ${resta > 0 ? "text-red-500" : "text-emerald-600"}`}>
                            {resta > 0 ? `Resta ${fmt(resta)}` : "✓ Saldado"}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-zinc-500 text-xs">
                        {fmtFecha(e.creado_en ?? e.fecha)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
