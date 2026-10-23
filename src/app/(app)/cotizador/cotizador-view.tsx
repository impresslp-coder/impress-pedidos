"use client";

import { useState } from "react";

type Cotizacion = {
  paginas: number; hojas: number; tipo_papel: string; tamano: string;
  precio_impresion: number; anillos: number; medida_mm: number | null;
  precio_anillado: number; precio_encuadernado: number; apaisado: boolean; total: number;
};

export type ItemDesdeCotizador = {
  producto_nombre: string;
  precio_venta: number;
};

const dinero = (valor: number) => new Intl.NumberFormat("es-AR", {
  style: "currency", currency: "ARS", maximumFractionDigits: 0,
}).format(valor);

export default function CotizadorView({
  onAgregarAlCarrito,
}: {
  onAgregarAlCarrito?: (item: ItemDesdeCotizador) => void;
}) {
  const [paginas, setPaginas] = useState("");
  const [tipo_papel, setPapel] = useState("comun");
  const [tamano, setTamano] = useState("A4");
  const [anillado, setAnillado] = useState(false);
  const [encuadernado, setEncuadernado] = useState(false);
  const [apaisado, setApaisado] = useState(false);
  const [cotizacion, setCotizacion] = useState<Cotizacion | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const cotizar = async (event: React.FormEvent) => {
    event.preventDefault(); setLoading(true); setError("");
    const response = await fetch("/api/cotizador", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paginas: Number(paginas), tipo_papel, tamano, anillado, encuadernado, apaisado }),
    });
    const json = await response.json(); setLoading(false);
    if (!response.ok) { setCotizacion(null); setError(json.error ?? "No se pudo cotizar."); return; }
    setCotizacion(json.cotizacion);
  };

  return <div className="max-w-2xl space-y-6">
    <div><h1 className="text-2xl font-bold text-zinc-800">Cotizador de impresión</h1><p className="mt-1 text-sm text-zinc-500">Trabajos que todavía no están en el catálogo.</p></div>
    <form onSubmit={cotizar} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="text-sm font-semibold text-zinc-600">Páginas<input required min="1" type="number" value={paginas} onChange={(e) => setPaginas(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2" /></label>
        <label className="text-sm font-semibold text-zinc-600">Papel<select value={tipo_papel} onChange={(e) => setPapel(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"><option value="comun">Común</option><option value="fotografico">Fotográfico</option><option value="chambril">Chambril</option></select></label>
        <label className="text-sm font-semibold text-zinc-600">Tamaño<select value={tamano} onChange={(e) => { setTamano(e.target.value); if (e.target.value !== "A4") setEncuadernado(false); }} className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"><option>A3</option><option>A4</option><option>A5</option></select></label>
      </div>
      <div className="flex flex-wrap gap-5 text-sm text-zinc-700">
        <label className="flex items-center gap-2"><input type="checkbox" checked={anillado} onChange={(e) => setAnillado(e.target.checked)} /> Anillado</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={encuadernado} disabled={tamano !== "A4"} onChange={(e) => setEncuadernado(e.target.checked)} /> Encuadernado (solo A4)</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={apaisado} onChange={(e) => setApaisado(e.target.checked)} /> Apaisado</label>
      </div>
      <button disabled={loading} className="rounded-xl bg-[#f5a623] px-5 py-2.5 text-sm font-black text-[#1a1a2e] disabled:opacity-50">{loading ? "Calculando…" : "Calcular precio"}</button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
    {cotizacion && <section className="rounded-2xl bg-[#1a1a2e] p-5 text-white shadow-sm"><h2 className="text-lg font-bold">Desglose</h2><div className="mt-4 space-y-2 text-sm text-zinc-200"><p>{cotizacion.paginas} páginas · {cotizacion.hojas} hojas</p><p className="flex justify-between gap-5"><span>Impresión</span><b>{dinero(cotizacion.precio_impresion)}</b></p>{cotizacion.anillos > 0 && <><p>{cotizacion.hojas} hojas, {cotizacion.anillos} anillo{cotizacion.anillos > 1 ? "s" : ""} de {cotizacion.medida_mm} mm</p><p className="flex justify-between gap-5"><span>Anillado</span><b>{dinero(cotizacion.precio_anillado)}</b></p></>}{cotizacion.precio_encuadernado > 0 && <p className="flex justify-between gap-5"><span>Encuadernado</span><b>{dinero(cotizacion.precio_encuadernado)}</b></p>}{cotizacion.apaisado && <p>Formato apaisado: se aplicó el 50%.</p>}</div><p className="mt-5 flex justify-between border-t border-white/20 pt-4 text-lg font-black"><span>Total</span><span className="text-[#f5a623]">{dinero(cotizacion.total)}</span></p>{onAgregarAlCarrito && <button type="button" onClick={() => onAgregarAlCarrito({ producto_nombre: `Impresión ${cotizacion.paginas} pág. · ${tipo_papel} · ${tamano}${anillado ? " · anillado" : ""}${encuadernado ? " · encuadernado" : ""}`, precio_venta: cotizacion.total })} className="mt-5 w-full rounded-xl bg-[#f5a623] px-5 py-2.5 text-sm font-black text-[#1a1a2e] hover:bg-amber-400">Agregar al carrito</button>}</section>}
  </div>;
}
