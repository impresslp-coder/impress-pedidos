"use client";

import { useState, useRef } from "react";

type Pedido = {
  id: string;
  numero: string;
  estado: string;
  clientes: { nombre: string } | null;
};

type TipoTicket = "ticket" | "entrega" | "resumen";

const TIPOS: { key: TipoTicket; label: string; ancho: boolean }[] = [
  { key: "ticket",  label: "🧾 Ticket pedido",  ancho: false },
  { key: "entrega", label: "📦 Ticket entrega",  ancho: false },
  { key: "resumen", label: "📄 Resumen A4",      ancho: true  },
];

const ESTADO_COLOR: Record<string, string> = {
  "Pendiente":             "bg-yellow-100 text-yellow-800",
  "En producción":         "bg-blue-100 text-blue-800",
  "Listo para retirar":    "bg-green-100 text-green-800",
  "Entregado":             "bg-zinc-100 text-zinc-500",
  "Cancelado":             "bg-red-100 text-red-700",
};

// 72 mm en px a 96 dpi = 272px. Usamos 275 para que el iframe no tenga scroll horizontal.
const THERMAL_W = 275;
// A4 a escala cómoda
const A4_W = 600;

export default function ImpresoraVirtual({ pedidos }: { pedidos: Pedido[] }) {
  const [selectedId, setSelectedId] = useState<string>(pedidos[0]?.id ?? "");
  const [tipo, setTipo] = useState<TipoTicket>("ticket");
  const [printing, setPrinting] = useState(false);
  const [query, setQuery] = useState("");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const filtered = query.trim()
    ? pedidos.filter(p =>
        p.numero?.includes(query) ||
        p.clientes?.nombre?.toLowerCase().includes(query.toLowerCase())
      )
    : pedidos;

  const selected = pedidos.find(p => p.id === selectedId);
  const pdfUrl = selectedId ? `/api/pdf/pedido/${selectedId}?tipo=${tipo}` : null;
  const isThermal = tipo !== "resumen";
  const frameW = isThermal ? THERMAL_W : A4_W;

  const handlePrint = () => {
    setPrinting(true);
    setTimeout(() => {
      iframeRef.current?.contentWindow?.focus();
      iframeRef.current?.contentWindow?.print();
      setPrinting(false);
    }, 300);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">

      {/* Header */}
      <header className="border-b border-white/10 bg-[#1a1a2e] px-6 py-4 flex items-center gap-4">
        <div>
          <p className="text-xs text-zinc-400 uppercase tracking-widest">Dev tools</p>
          <h1 className="text-lg font-black text-[#f5a623] leading-tight">
            🖨️ Impresora Virtual
          </h1>
        </div>
        <span className="ml-auto text-xs bg-[#f5a623]/15 text-[#f5a623] border border-[#f5a623]/30 px-2 py-1 rounded-full font-mono">
          IMPRESS · preview
        </span>
      </header>

      <div className="flex flex-1 min-h-0">

        {/* Sidebar — lista de pedidos */}
        <aside className="w-64 flex-shrink-0 border-r border-white/10 bg-zinc-900 flex flex-col">
          <div className="p-3 border-b border-white/10">
            <input
              type="text"
              placeholder="Buscar n° o cliente..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full bg-zinc-800 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:ring-1 focus:ring-[#f5a623]/50"
            />
          </div>
          <ul className="flex-1 overflow-y-auto divide-y divide-white/5">
            {filtered.map(p => (
              <li key={p.id}>
                <button
                  onClick={() => setSelectedId(p.id)}
                  className={`w-full text-left px-4 py-3 transition hover:bg-white/5 ${
                    selectedId === p.id ? "bg-[#f5a623]/10 border-l-2 border-[#f5a623]" : ""
                  }`}
                >
                  <p className="font-bold text-sm leading-tight">
                    #{parseInt(p.numero, 10)}
                    {" "}
                    <span className="font-normal text-zinc-400 text-xs">{p.clientes?.nombre ?? "—"}</span>
                  </p>
                  <span className={`inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                    ESTADO_COLOR[p.estado] ?? "bg-zinc-700 text-zinc-300"
                  }`}>
                    {p.estado}
                  </span>
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="px-4 py-6 text-zinc-500 text-sm text-center">Sin resultados</li>
            )}
          </ul>
        </aside>

        {/* Centro — impresora */}
        <main className="flex-1 flex flex-col items-center overflow-auto bg-zinc-950 py-8 px-4 gap-6">

          {/* Tabs tipo */}
          <div className="flex gap-2 flex-wrap justify-center">
            {TIPOS.map(t => (
              <button
                key={t.key}
                onClick={() => setTipo(t.key)}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition border ${
                  tipo === t.key
                    ? "bg-[#f5a623] text-[#1a1a2e] border-[#f5a623]"
                    : "bg-transparent text-zinc-400 border-white/15 hover:border-white/30"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Cuerpo impresora */}
          {selectedId && pdfUrl ? (
            <div className="flex flex-col items-center gap-0">

              {/* Cuerpo físico de la impresora (solo para térmicos) */}
              {isThermal && (
                <div
                  className="rounded-t-2xl bg-zinc-700 shadow-2xl flex flex-col items-center"
                  style={{ width: frameW + 32 }}
                >
                  {/* Top de la impresora */}
                  <div className="w-full px-4 pt-4 pb-2 flex items-center justify-between">
                    <div className="flex gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-green-400 shadow shadow-green-400/50" />
                      <span className="w-2.5 h-2.5 rounded-full bg-zinc-500" />
                    </div>
                    <span className="text-[10px] font-bold text-zinc-400 tracking-widest uppercase">
                      IMPRESS Thermal
                    </span>
                    <span className="w-2.5 h-2.5 rounded-full bg-zinc-600" />
                  </div>

                  {/* Ranura de papel */}
                  <div className="w-full bg-zinc-800 py-1.5 flex justify-center border-t border-b border-zinc-600">
                    <div
                      className="h-2 rounded-sm bg-zinc-600"
                      style={{ width: frameW - 8 }}
                    />
                  </div>
                </div>
              )}

              {/* Papel — el iframe */}
              <div
                className={`bg-white shadow-2xl overflow-hidden ${
                  isThermal
                    ? "rounded-b-sm"
                    : "rounded-lg mt-2"
                }`}
                style={{
                  width: frameW,
                  // Para el A4 dejamos altura fija con scroll
                  height: isThermal ? "auto" : 800,
                  minHeight: isThermal ? 200 : undefined,
                }}
              >
                <iframe
                  ref={iframeRef}
                  key={`${selectedId}-${tipo}`}
                  src={pdfUrl}
                  title={`${tipo} - pedido ${selected?.numero}`}
                  className="border-0 bg-white"
                  style={{
                    width: frameW,
                    height: isThermal ? 900 : 800,
                    // Scale down para que el 72mm real quede bien en pantalla
                    transformOrigin: "top left",
                  }}
                />
              </div>

              {/* Pie de impresora */}
              {isThermal && (
                <div
                  className="bg-zinc-700 rounded-b-2xl py-3 flex justify-center"
                  style={{ width: frameW + 32 }}
                >
                  <div
                    className="h-1 rounded-full bg-zinc-500"
                    style={{ width: frameW - 8 }}
                  />
                </div>
              )}

              {/* Botón imprimir */}
              <div className="mt-6 flex flex-col items-center gap-2">
                <button
                  onClick={handlePrint}
                  disabled={printing}
                  className="px-8 py-3 rounded-xl bg-[#f5a623] text-[#1a1a2e] font-black text-sm hover:bg-amber-400 disabled:opacity-50 transition shadow-lg shadow-[#f5a623]/20"
                >
                  {printing ? "Enviando..." : "🖨️ Imprimir"}
                </button>
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-zinc-500 hover:text-zinc-300 transition"
                >
                  Abrir PDF en nueva pestaña ↗
                </a>
              </div>

            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-zinc-600 text-sm">
              Seleccioná un pedido de la lista
            </div>
          )}
        </main>

        {/* Info panel derecho */}
        {selected && (
          <aside className="w-52 flex-shrink-0 border-l border-white/10 bg-zinc-900 p-4 flex flex-col gap-4">
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Pedido</p>
              <p className="text-2xl font-black text-[#f5a623]">#{parseInt(selected.numero, 10)}</p>
              <p className="text-sm text-zinc-300 mt-0.5">{selected.clientes?.nombre ?? "—"}</p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Estado</p>
              <span className={`inline-block text-xs px-2 py-1 rounded-full font-medium ${
                ESTADO_COLOR[selected.estado] ?? "bg-zinc-700 text-zinc-300"
              }`}>
                {selected.estado}
              </span>
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Vista actual</p>
              <p className="text-sm text-zinc-300 capitalize">{tipo}</p>
              <p className="text-[10px] text-zinc-600 mt-1">
                {tipo !== "resumen" ? "72 mm · térmico" : "A4 · color"}
              </p>
            </div>
            <div className="mt-auto">
              <p className="text-[10px] text-zinc-600">
                El PDF real se genera en el servidor igual que en producción.
              </p>
            </div>
          </aside>
        )}

      </div>
    </div>
  );
}
