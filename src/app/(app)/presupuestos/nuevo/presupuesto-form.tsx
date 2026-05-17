"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { crearPresupuesto, type ItemPresupuestoInput } from "./actions";

type Cliente = { id: string; nombre: string };
type Producto = {
  id: string; nombre: string; paginas: number | null;
  precio_d: number | null; precio_e: number | null; precio_f: number | null; precio_g: number | null;
};

const MODOS = ["Simple faz", "Doble faz", "Color", "Color doble faz", "Laminado"];
const MEDIOS = ["WhatsApp", "Teléfono", "Presencial", "Email", "Instagram"];

const precioCat = (p: Producto, cat: string) => {
  const m: Record<string, keyof Producto> = { D: "precio_d", E: "precio_e", F: "precio_f", G: "precio_g" };
  return (p[m[cat]] as number | null) ?? 0;
};

export default function PresupuestoForm({
  clientes,
  productos,
}: {
  clientes: Cliente[];
  productos: Producto[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  const [clienteId, setClienteId] = useState("");
  const [clienteQuery, setClienteQuery] = useState("");
  const [medioContacto, setMedioContacto] = useState("");
  const [items, setItems] = useState<(ItemPresupuestoInput & { _key: number })[]>([]);
  const [nextKey, setNextKey] = useState(0);

  // Item builder
  const [prodQuery, setProdQuery] = useState("");
  const [prodSelId, setProdSelId] = useState("");
  const [categoria, setCategoria] = useState("D");
  const [modo, setModo] = useState("");
  const [precio, setPrecio] = useState("");
  const [descuento, setDescuento] = useState("");
  const [unidades, setUnidades] = useState("1");

  const clientesFilt = clienteQuery
    ? clientes.filter((c) => c.nombre.toLowerCase().includes(clienteQuery.toLowerCase()))
    : clientes.slice(0, 20);

  const prodsFilt = prodQuery
    ? productos.filter((p) => p.nombre.toLowerCase().includes(prodQuery.toLowerCase()))
    : productos.slice(0, 20);

  const prodSel = productos.find((p) => p.id === prodSelId);

  const precioBase = parseFloat(precio) || 0;
  const desc = parseFloat(descuento) || 0;
  const cant = parseInt(unidades) || 1;
  const precioFinal = precioBase * (1 - desc / 100) * cant;

  const fmt = (n: number) =>
    new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(n);

  const total = items.reduce((acc, i) => acc + i.precio * (1 - (i.descuento ?? 0) / 100) * i.unidades, 0);

  const agregarItem = () => {
    if (!prodQuery) return;
    setItems((prev) => [
      ...prev,
      {
        _key: nextKey,
        producto: prodSel?.nombre ?? prodQuery,
        modo: modo || undefined,
        paginas: prodSel?.paginas ?? undefined,
        precio: precioBase,
        descuento: desc || undefined,
        unidades: cant,
      },
    ]);
    setNextKey((k) => k + 1);
    setProdQuery(""); setProdSelId(""); setPrecio(""); setDescuento(""); setUnidades("1"); setModo("");
  };

  const handleSubmit = () => {
    if (!clienteId) { setError("Seleccioná un cliente"); return; }
    if (!items.length) { setError("Agregá al menos un producto"); return; }
    setError(undefined);
    const fd = new FormData();
    fd.set("cliente_id", clienteId);
    fd.set("medio_contacto", medioContacto);
    fd.set("items", JSON.stringify(items.map(({ _key, ...rest }) => rest)));
    startTransition(() => {
      crearPresupuesto(fd).then((res) => { if (res?.error) setError(res.error); });
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-5">
        {/* Cabecera */}
        <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-5 space-y-4">
          <h2 className="font-semibold text-zinc-700 text-sm uppercase tracking-wide">Datos</h2>

          <div className="relative">
            <label className="block text-sm font-medium text-zinc-700 mb-1">Cliente</label>
            <input
              value={clienteQuery}
              onChange={(e) => { setClienteQuery(e.target.value); setClienteId(""); }}
              suppressHydrationWarning
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#f5a623]"
              placeholder="Buscar..."
            />
            {clienteQuery && !clienteId && clientesFilt.length > 0 && (
              <ul className="absolute z-10 w-full border border-zinc-200 rounded-lg mt-1 max-h-40 overflow-y-auto shadow-md bg-white">
                {clientesFilt.map((c) => (
                  <li key={c.id} className="px-3 py-2 text-sm hover:bg-amber-50 cursor-pointer"
                    onClick={() => { setClienteId(c.id); setClienteQuery(c.nombre); }}>
                    {c.nombre}
                  </li>
                ))}
              </ul>
            )}
            {clienteId && <p className="text-xs text-emerald-600 mt-1">✓ Seleccionado</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Medio contacto</label>
            <select value={medioContacto} onChange={(e) => setMedioContacto(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#f5a623]">
              <option value="">—</option>
              {MEDIOS.map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
        </div>

        {/* Items */}
        <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-5 space-y-3">
          <h2 className="font-semibold text-zinc-700 text-sm uppercase tracking-wide">Agregar producto</h2>

          <div className="relative">
            <input
              value={prodQuery}
              onChange={(e) => { setProdQuery(e.target.value); setProdSelId(""); setPrecio(""); }}
              suppressHydrationWarning
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#f5a623]"
              placeholder="Buscar producto..."
            />
            {prodQuery && !prodSelId && prodsFilt.length > 0 && (
              <ul className="absolute z-10 w-full border border-zinc-200 rounded-lg mt-1 max-h-40 overflow-y-auto shadow-md bg-white">
                {prodsFilt.map((p) => (
                  <li key={p.id} className="px-3 py-2 text-sm hover:bg-amber-50 cursor-pointer"
                    onClick={() => { setProdSelId(p.id); setProdQuery(p.nombre); const pr = precioCat(p, categoria); setPrecio(pr > 0 ? String(pr) : ""); }}>
                    {p.nombre}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div>
              <label className="text-xs text-zinc-600 mb-1 block">Categoría</label>
              <select value={categoria} onChange={(e) => { setCategoria(e.target.value); if (prodSel) setPrecio(String(precioCat(prodSel, e.target.value) || "")); }}
                className="w-full rounded-lg border border-zinc-300 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#f5a623]">
                <option>D</option><option>E</option><option>F</option><option>G</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-600 mb-1 block">Modo</label>
              <select value={modo} onChange={(e) => setModo(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#f5a623]">
                <option value="">—</option>
                {MODOS.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-600 mb-1 block">Precio ($)</label>
              <input type="number" value={precio} onChange={(e) => setPrecio(e.target.value)} suppressHydrationWarning
                className="w-full rounded-lg border border-zinc-300 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#f5a623]" />
            </div>
            <div>
              <label className="text-xs text-zinc-600 mb-1 block">Desc. % | Cant.</label>
              <div className="flex gap-1">
                <input type="number" value={descuento} onChange={(e) => setDescuento(e.target.value)} suppressHydrationWarning
                  className="w-1/2 rounded-lg border border-zinc-300 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#f5a623]" placeholder="0" />
                <input type="number" value={unidades} onChange={(e) => setUnidades(e.target.value)} suppressHydrationWarning min="1"
                  className="w-1/2 rounded-lg border border-zinc-300 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#f5a623]" />
              </div>
            </div>
          </div>

          {precioBase > 0 && (
            <p className="text-xs text-zinc-500 bg-amber-50 px-3 py-2 rounded-lg">
              {cant} und. × {fmt(precioBase)}{desc > 0 ? ` − ${desc}%` : ""} = <strong>{fmt(precioFinal)}</strong>
            </p>
          )}

          <button type="button" onClick={agregarItem} disabled={!prodQuery}
            className="w-full py-2 rounded-lg bg-[#1a1a2e] text-white font-semibold text-sm hover:bg-[#16213e] disabled:opacity-40 transition">
            + Agregar
          </button>
        </div>
      </div>

      {/* Resumen */}
      <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-5 sticky top-4 space-y-4">
        <h2 className="font-semibold text-zinc-700 text-sm uppercase tracking-wide">Presupuesto</h2>

        {items.length === 0 ? (
          <p className="text-zinc-400 text-sm text-center py-4">Sin productos</p>
        ) : (
          <ul className="space-y-2">
            {items.map((i) => (
              <li key={i._key} className="flex justify-between text-sm gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{i.producto}</p>
                  <p className="text-xs text-zinc-500">{i.unidades} und. × {fmt(i.precio)}{(i.descuento ?? 0) > 0 ? ` (${i.descuento}% off)` : ""}</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-semibold text-[#1a1a2e]">{fmt(i.precio * (1 - (i.descuento ?? 0) / 100) * i.unidades)}</span>
                  <button type="button" onClick={() => setItems((prev) => prev.filter((x) => x._key !== i._key))}
                    className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {items.length > 0 && (
          <div className="border-t pt-3 font-black text-lg text-[#f5a623] flex justify-between">
            <span>Total</span><span>{fmt(total)}</span>
          </div>
        )}

        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

        <button type="button" onClick={handleSubmit}
          disabled={isPending || !clienteId || !items.length}
          className="w-full py-3 rounded-lg bg-[#f5a623] text-[#1a1a2e] font-bold text-sm hover:bg-[#d4881a] disabled:opacity-50 transition">
          {isPending ? "Guardando..." : "✓ Guardar presupuesto"}
        </button>
        <button type="button" onClick={() => router.back()}
          className="w-full py-2 rounded-lg bg-zinc-100 text-zinc-600 text-sm hover:bg-zinc-200 transition">
          Cancelar
        </button>
      </div>
    </div>
  );
}
