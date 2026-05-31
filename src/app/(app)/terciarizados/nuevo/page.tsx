"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";

/* ── Types ── */
type Cliente = {
  id: string;
  nombre: string;
  telefono: string | null;
  cod_pais: string | null;
};

// Artículo aplanado — incluye datos del proveedor
type ArticuloFlat = {
  id: string;
  nombre: string;
  descripcion: string | null;
  unidad: string;
  precio_costo: number;
  markup_pct: number;
  tiempo_entrega_dias: number;
  plancha_ancho_cm: number | null;
  plancha_alto_cm: number | null;
  activo: boolean;
  proveedor_id: string;
  proveedor_nombre: string;
  proveedor_contacto: string | null;
  proveedor_telefono: string | null;
};

type FormState = {
  cliente_id: string;
  cliente:    string;
  telefono:   string;
  item:       string;
  cantidad:   string;
  anotacion:  string;
  proveedor:  string;
  total:      string;
  senia:      string;
  sucursal:   string;
};

const getSucursalInicial = () =>
  typeof window !== "undefined"
    ? (localStorage.getItem("impress_sucursal_activa") ?? "")
    : "";

const FORM_INICIAL: FormState = {
  cliente_id: "",
  cliente:    "",
  telefono:   "",
  item:       "",
  cantidad:   "",
  anotacion:  "",
  proveedor:  "",
  total:      "",
  senia:      "0",
  sucursal:   "",
};

type Resultado = {
  id:        string;
  numero:    string;
  mensaje:   string;
  telefono:  string;
  proveedor: string;
};

const inputCls =
  "w-full rounded-xl border-2 border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:border-amber-400 transition";

function precioVenta(costo: number, markup: number) {
  return costo * (1 + markup / 100);
}

/* ══════════════════════════════════════════════════════
   CALCULADOR DE PLANCHA
══════════════════════════════════════════════════════ */
const GAP_CM = 0.3;

type PlanchaResult = {
  perPlancha: number;
  planchasNecesarias: number;
  lastUsed: number;
  lastFree: number;
  totalCosto: number;
  itemLabel: string;
};

function calcularPlancha(
  planchaAncho: number,
  planchaAlto: number,
  sw: number,
  sh: number,
  qty: number,
  precioCosto: number,
  markupPct: number
): PlanchaResult | null {
  if (sw <= 0 || sh <= 0 || qty <= 0) return null;
  const cols = Math.floor(planchaAncho / (sw + GAP_CM));
  const rows = Math.floor(planchaAlto  / (sh + GAP_CM));
  const perPlancha = cols * rows;
  if (perPlancha <= 0) return null;
  const planchasNecesarias = Math.ceil(qty / perPlancha);
  const lastUsed = qty - (planchasNecesarias - 1) * perPlancha;
  const lastFree = perPlancha - lastUsed;
  const venta = precioCosto * (1 + markupPct / 100);
  const totalCosto = planchasNecesarias * venta;
  const itemLabel = `${qty} stickers ${sw}×${sh}cm (${planchasNecesarias} plancha${planchasNecesarias > 1 ? "s" : ""})`;
  return { perPlancha, planchasNecesarias, lastUsed, lastFree, totalCosto, itemLabel };
}

function PlanchaCalculator({
  articulo,
  onUpdate,
}: {
  articulo: ArticuloFlat;
  onUpdate: (total: string, item: string, anotacion: string) => void;
}) {
  const [sw,  setSw]  = useState("");
  const [sh,  setSh]  = useState("");
  const [qty, setQty] = useState("");
  const [restDesc,     setRestDesc]     = useState("");
  const [restW,        setRestW]        = useState("");
  const [restH,        setRestH]        = useState("");
  const [restAsignado, setRestAsignado] = useState(false);

  const pAncho = articulo.plancha_ancho_cm!;
  const pAlto  = articulo.plancha_alto_cm!;

  const result = calcularPlancha(
    pAncho, pAlto,
    parseFloat(sw) || 0,
    parseFloat(sh) || 0,
    parseInt(qty)  || 0,
    articulo.precio_costo,
    articulo.markup_pct
  );

  const rw = parseFloat(restW) || 0;
  const rh = parseFloat(restH) || 0;
  const restAreaCm2 = result
    ? result.lastFree * (parseFloat(sw) + GAP_CM) * (parseFloat(sh) + GAP_CM)
    : 0;
  const restFit =
    rw > 0 && rh > 0 && restAreaCm2 > 0
      ? Math.floor(restAreaCm2 / ((rw + GAP_CM) * (rh + GAP_CM)))
      : 0;

  const aplicar = () => {
    if (!result) return;
    let anotacion = "";
    if (restAsignado && restDesc) {
      anotacion = restFit > 0
        ? `Restante de plancha: ${restFit} unidades de "${restDesc}"${rw && rh ? ` (${rw}×${rh}cm)` : ""}`
        : `Restante de plancha asignado a: "${restDesc}"`;
    }
    onUpdate(result.totalCosto.toFixed(2), result.itemLabel, anotacion);
  };

  const fieldCls = "rounded-lg border border-zinc-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#f5a623]";

  return (
    <div className="rounded-xl border-2 border-blue-100 bg-blue-50/40 p-4 space-y-4">
      <p className="text-xs font-bold text-blue-700 uppercase tracking-wide flex items-center gap-1.5">
        📐 Calculador de plancha
        <span className="font-normal text-blue-500 normal-case">
          {pAncho} × {pAlto} cm
        </span>
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs text-zinc-500 mb-1">Ancho sticker (cm)</label>
          <input type="number" step="0.1" min="0.1"
            value={sw} onChange={(e) => { setSw(e.target.value); setRestAsignado(false); }}
            suppressHydrationWarning className={`${fieldCls} w-full`} placeholder="Ej: 5" />
        </div>
        <div>
          <label className="block text-xs text-zinc-500 mb-1">Alto sticker (cm)</label>
          <input type="number" step="0.1" min="0.1"
            value={sh} onChange={(e) => { setSh(e.target.value); setRestAsignado(false); }}
            suppressHydrationWarning className={`${fieldCls} w-full`} placeholder="Ej: 5" />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs text-zinc-500 mb-1">Cantidad de stickers</label>
          <input type="number" min="1"
            value={qty} onChange={(e) => { setQty(e.target.value); setRestAsignado(false); }}
            suppressHydrationWarning className={`${fieldCls} w-full`} placeholder="Ej: 200" />
        </div>
      </div>

      {result && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              ["Por plancha", result.perPlancha, "stickers"],
              ["Planchas", result.planchasNecesarias, "necesarias"],
              ["Última plancha", result.lastUsed, "usados"],
            ].map(([label, val, sub]) => (
              <div key={label as string} className="bg-white rounded-lg border border-zinc-200 px-3 py-2 text-center">
                <p className="text-xs text-zinc-400">{label}</p>
                <p className="text-lg font-black text-zinc-800">{val}</p>
                <p className="text-xs text-zinc-400">{sub}</p>
              </div>
            ))}
            <div className={`rounded-lg border px-3 py-2 text-center ${result.lastFree > 0 ? "bg-amber-50 border-amber-200" : "bg-white border-zinc-200"}`}>
              <p className="text-xs text-zinc-400">Restante</p>
              <p className={`text-lg font-black ${result.lastFree > 0 ? "text-amber-600" : "text-zinc-400"}`}>
                {result.lastFree}
              </p>
              <p className="text-xs text-zinc-400">slots libres</p>
            </div>
          </div>

          <div className="flex items-center justify-between bg-white rounded-lg border border-zinc-200 px-3 py-2">
            <span className="text-sm text-zinc-600">
              {result.planchasNecesarias} plancha{result.planchasNecesarias > 1 ? "s" : ""} × ${precioVenta(articulo.precio_costo, articulo.markup_pct).toFixed(2)}
            </span>
            <span className="text-base font-black" style={{ color: "#1a1a2e" }}>
              Total: ${result.totalCosto.toFixed(2)}
            </span>
          </div>

          {result.lastFree > 0 && (
            <div className="border border-amber-200 rounded-lg bg-amber-50/60 p-3 space-y-2">
              <p className="text-xs font-semibold text-amber-700">
                ✂️ Restante: {result.lastFree} slots libres en la última plancha
                {restAreaCm2 > 0 && <span className="font-normal ml-1 text-amber-600">(~{restAreaCm2.toFixed(0)} cm²)</span>}
              </p>
              <p className="text-xs text-zinc-500">¿Querés aprovechar ese espacio para otro trabajo?</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="sm:col-span-3">
                  <input value={restDesc} onChange={(e) => { setRestDesc(e.target.value); setRestAsignado(false); }}
                    suppressHydrationWarning placeholder='Descripción (ej: "stickers propios")'
                    className={`${fieldCls} w-full`} />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Ancho (cm)</label>
                  <input type="number" step="0.1" min="0.1" value={restW}
                    onChange={(e) => { setRestW(e.target.value); setRestAsignado(false); }}
                    suppressHydrationWarning placeholder="Ej: 3" className={`${fieldCls} w-full`} />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Alto (cm)</label>
                  <input type="number" step="0.1" min="0.1" value={restH}
                    onChange={(e) => { setRestH(e.target.value); setRestAsignado(false); }}
                    suppressHydrationWarning placeholder="Ej: 3" className={`${fieldCls} w-full`} />
                </div>
                <div className="flex items-end">
                  {restFit > 0 && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-1.5 text-xs text-emerald-700 font-semibold w-full text-center">
                      Caben ~{restFit} unidades
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <button type="button" onClick={() => { aplicar(); setRestAsignado(true); }}
            className="w-full py-2 rounded-xl font-bold text-sm transition"
            style={{ backgroundColor: "#f5a623", color: "#1a1a2e" }}>
            ✓ Aplicar al encargo
          </button>
          {restAsignado && (
            <p className="text-xs text-emerald-600 font-medium text-center">
              ✅ Total, ítem y anotación actualizados en el formulario
            </p>
          )}
        </div>
      )}

      {result === null && sw && sh && qty && (
        <p className="text-xs text-red-500 font-medium">
          ⚠️ El sticker ({sw}×{sh}cm) no entra en la plancha ({pAncho}×{pAlto}cm). Revisá las medidas.
        </p>
      )}
      <p className="text-xs text-zinc-400">Espaciado de corte: {GAP_CM * 10}mm entre stickers</p>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   PÁGINA PRINCIPAL
══════════════════════════════════════════════════════ */
export default function NuevoTerciarizadoPage() {
  const router = useRouter();

  const [form, setForm]           = useState<FormState>({ ...FORM_INICIAL, sucursal: getSucursalInicial() });
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [copiado, setCopiado]     = useState(false);

  // ── Clientes ──
  const [clientes, setClientes]           = useState<Cliente[]>([]);
  const [clienteQuery, setClienteQuery]   = useState("");
  const [mostrarNuevoCliente, setMostrarNuevoCliente] = useState(false);
  const [nuevoNombre, setNuevoNombre]     = useState("");
  const [nuevoTel, setNuevoTel]           = useState("");
  const [creandoCliente, setCreandoCliente] = useState(false);
  const [errorCliente, setErrorCliente]   = useState<string>();

  // ── Artículos (aplanados de todos los proveedores) ──
  const [articulos, setArticulos]         = useState<ArticuloFlat[]>([]);
  const [articuloQuery, setArticuloQuery] = useState("");
  const [articuloSel, setArticuloSel]     = useState<ArticuloFlat | null>(null);
  const [cargando, setCargando]           = useState(true);
  const [esAdmin, setEsAdmin]             = useState(false);

  // Fetch clientes, proveedores y rol del usuario al montar
  useEffect(() => {
    Promise.all([
      fetch("/api/clientes").then((r) => r.json()),
      fetch("/api/admin/proveedores").then((r) => r.json()),
      fetch("/api/me").then((r) => r.json()),
    ]).then(([cJson, pJson, meJson]) => {
      if (cJson.clientes) setClientes(cJson.clientes);
      if (meJson.rol === "admin") setEsAdmin(true);
      if (pJson.proveedores) {
        // Aplanar artículos de todos los proveedores activos
        const flat: ArticuloFlat[] = [];
        for (const prov of pJson.proveedores) {
          if (!prov.activo) continue;
          for (const art of prov.proveedor_articulos ?? []) {
            if (!art.activo) continue;
            flat.push({
              ...art,
              proveedor_id:       prov.id,
              proveedor_nombre:   prov.nombre,
              proveedor_contacto: prov.contacto ?? null,
              proveedor_telefono: prov.telefono ?? null,
            });
          }
        }
        // Ordenar por nombre de artículo
        flat.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
        setArticulos(flat);
      }
    }).catch(() => {}).finally(() => setCargando(false));
  }, []);

  const set = (k: keyof FormState, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  // ── Selección de artículo → auto-fill ──
  const handleArticuloSelect = (art: ArticuloFlat) => {
    setArticuloSel(art);
    setArticuloQuery(art.nombre);
    const venta = precioVenta(art.precio_costo, art.markup_pct);
    setForm((f) => ({
      ...f,
      item:      art.nombre,
      total:     venta.toFixed(2),
      proveedor: art.proveedor_nombre,
    }));
  };

  const handleArticuloClear = () => {
    setArticuloSel(null);
    setArticuloQuery("");
    setForm((f) => ({ ...f, item: "", total: "", proveedor: "" }));
  };

  // ── Filtros de búsqueda ──
  const clientesFiltrados = clienteQuery && !form.cliente_id
    ? clientes.filter((c) => c.nombre.toLowerCase().includes(clienteQuery.toLowerCase())).slice(0, 10)
    : [];

  const articulosFiltrados = articuloQuery && !articuloSel
    ? articulos.filter((a) =>
        a.nombre.toLowerCase().includes(articuloQuery.toLowerCase()) ||
        a.proveedor_nombre.toLowerCase().includes(articuloQuery.toLowerCase())
      ).slice(0, 12)
    : [];

  // ── Crear cliente inline ──
  const crearCliente = async () => {
    if (!nuevoNombre.trim()) return;
    setCreandoCliente(true);
    setErrorCliente(undefined);
    const fd = new FormData();
    fd.set("nombre", nuevoNombre);
    fd.set("telefono", nuevoTel);
    fd.set("cod_pais", "54");
    fd.set("mail", "");
    const res = await fetch("/api/clientes/crear", { method: "POST", body: fd });
    const json = await res.json();
    if (json.error) { setErrorCliente(json.error); setCreandoCliente(false); return; }
    if (json.cliente) {
      setClientes((prev) => [...prev, json.cliente]);
      setForm((f) => ({ ...f, cliente_id: json.cliente.id, cliente: json.cliente.nombre, telefono: json.cliente.telefono ?? "" }));
      setClienteQuery(json.cliente.nombre);
    }
    setNuevoNombre(""); setNuevoTel(""); setMostrarNuevoCliente(false); setCreandoCliente(false);
  };

  // ── Submit ──
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.cliente_id) { setError("Seleccioná un cliente"); return; }
    if (!articuloSel && !form.item.trim()) { setError("Seleccioná o describí el artículo"); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/terciarizados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          proveedor_articulo_id: articuloSel?.id ?? null,
          precio_costo:          articuloSel?.precio_costo ?? null,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) { setError(json.error ?? "Error al guardar"); setLoading(false); return; }
      setResultado({
        id:        json.encargo.id,
        numero:    json.encargo.numero,
        mensaje:   json.encargo.mensaje,
        telefono:  form.telefono,
        proveedor: form.proveedor,
      });
    } catch {
      setError("Error de red. Intentá de nuevo.");
    }
    setLoading(false);
  };

  const copiar = async () => {
    if (!resultado) return;
    await navigator.clipboard.writeText(resultado.mensaje);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  const resetear = () => {
    setResultado(null); setError(null); setCopiado(false);
    setForm(FORM_INICIAL); setClienteQuery("");
    setArticuloSel(null); setArticuloQuery("");
  };

  /* ── PANTALLA DE CONFIRMACIÓN ── */
  if (resultado) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-zinc-800">Encargo terciarizado</h1>
        <div className="max-w-xl bg-white rounded-xl border border-zinc-200 shadow-sm p-6 space-y-5">
          <div className="text-center space-y-2">
            <p className="text-sm text-zinc-500 font-medium uppercase tracking-wide">Encargo generado</p>
            <p className="text-5xl font-black tracking-tight" style={{ color: "#1a1a2e" }}>{resultado.numero}</p>
            <span className="inline-block px-3 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
              ✅ Guardado correctamente
            </span>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Mensaje para copiar y pegar</label>
            <textarea readOnly value={resultado.mensaje} rows={6}
              className="w-full rounded-xl border-2 border-zinc-200 px-3 py-2 text-sm bg-zinc-50 focus:outline-none resize-none" />
          </div>
          <div className="flex flex-col gap-2">
            <button onClick={copiar} className="w-full py-2 rounded-xl font-semibold text-sm transition text-white"
              style={{ backgroundColor: "#1a1a2e" }}>
              {copiado ? "✅ ¡Copiado!" : "📋 Copiar mensaje"}
            </button>
            <a href={`/api/pdf/terciarizado/${resultado.id}`} target="_blank" rel="noopener noreferrer"
              className="w-full py-2 rounded-xl font-semibold text-sm text-center transition bg-zinc-700 hover:bg-zinc-800 text-white block">
              🖨️ Ver / Imprimir PDF
            </a>
            {resultado.telefono && (
              <a href={`https://wa.me/${resultado.telefono.replace(/\D/g, "")}?text=${encodeURIComponent(resultado.mensaje)}`}
                target="_blank" rel="noopener noreferrer"
                className="w-full py-2 rounded-xl font-semibold text-sm text-center transition bg-emerald-500 hover:bg-emerald-600 text-white block">
                💬 Abrir WhatsApp
              </a>
            )}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button onClick={resetear}
                className="py-2 rounded-xl font-semibold text-sm border-2 border-zinc-200 hover:bg-zinc-50 transition text-zinc-700">
                Nuevo encargo
              </button>
              <button onClick={() => router.push("/terciarizados")}
                className="py-2 rounded-xl font-semibold text-sm transition"
                style={{ backgroundColor: "#f5a623", color: "#1a1a2e" }}>
                Ver todos los encargos
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── FORMULARIO ── */
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-zinc-800">Nuevo encargo terciarizado</h1>

      <form onSubmit={handleSubmit}
        className="max-w-xl bg-white rounded-xl border border-zinc-200 shadow-sm p-6 space-y-5">

        {/* ══ 1. CLIENTE ══ */}
        <div className="space-y-2">
          <label className="block text-sm font-bold text-zinc-700">
            Cliente <span className="text-red-500">*</span>
          </label>

          <div className="relative">
            <input
              value={clienteQuery}
              onChange={(e) => { setClienteQuery(e.target.value); setForm((f) => ({ ...f, cliente_id: "", cliente: e.target.value, telefono: "" })); }}
              suppressHydrationWarning
              placeholder="Buscar cliente..."
              className={inputCls}
            />
            {clientesFiltrados.length > 0 && (
              <ul className="absolute z-20 w-full border border-zinc-200 rounded-xl mt-1 max-h-44 overflow-y-auto shadow-xl bg-white">
                {clientesFiltrados.map((c) => (
                  <li key={c.id}
                    className="px-3 py-2.5 text-sm hover:bg-amber-50 cursor-pointer border-b border-zinc-50 last:border-0"
                    onClick={() => {
                      setForm((f) => ({
                        ...f,
                        cliente_id: c.id,
                        cliente: c.nombre,
                        telefono: c.telefono ?? "",
                      }));
                      setClienteQuery(c.nombre);
                    }}>
                    <p className="font-semibold text-zinc-800">{c.nombre}</p>
                    {c.telefono && <p className="text-zinc-400 text-xs">{c.telefono}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {form.cliente_id
            ? <p className="text-xs text-emerald-600 font-bold flex items-center gap-1">✓ Cliente seleccionado</p>
            : <p className="text-xs text-zinc-400">Escribí para buscar en la base de clientes</p>
          }

          {!mostrarNuevoCliente ? (
            <button type="button" onClick={() => setMostrarNuevoCliente(true)}
              className="w-full text-xs text-[#f5a623] border-2 border-dashed border-amber-200 rounded-xl py-2 font-semibold hover:bg-amber-50 transition">
              + Nuevo cliente
            </button>
          ) : (
            <div className="space-y-2 border-2 border-amber-100 rounded-xl p-3 bg-amber-50">
              <p className="text-xs font-bold text-amber-800">Nuevo cliente</p>
              <input value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)}
                placeholder="Nombre *" suppressHydrationWarning
                className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#f5a623] bg-white" />
              <input value={nuevoTel} onChange={(e) => setNuevoTel(e.target.value)}
                placeholder="Teléfono (WhatsApp)" suppressHydrationWarning
                className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#f5a623] bg-white" />
              {errorCliente && <p className="text-xs text-red-600 font-medium">{errorCliente}</p>}
              <div className="flex gap-2">
                <button type="button" onClick={crearCliente} disabled={!nuevoNombre || creandoCliente}
                  className="flex-1 py-1.5 rounded-lg bg-[#1a1a2e] text-white text-xs font-bold hover:bg-[#16213e] disabled:opacity-50 transition">
                  {creandoCliente ? "..." : "Crear"}
                </button>
                <button type="button"
                  onClick={() => { setMostrarNuevoCliente(false); setNuevoNombre(""); setNuevoTel(""); setErrorCliente(undefined); }}
                  className="px-3 py-1.5 rounded-lg bg-white text-zinc-500 text-xs border border-zinc-200 hover:bg-zinc-100 transition">✕</button>
              </div>
            </div>
          )}
        </div>

        {/* ══ 2. ARTÍCULO (primero) ══ */}
        <div className="space-y-2">
          <label className="block text-sm font-bold text-zinc-700">
            Artículo <span className="text-red-500">*</span>
          </label>

          {cargando ? (
            <div className={`${inputCls} text-zinc-400`}>Cargando artículos...</div>
          ) : articulos.length === 0 ? (
            <div className="rounded-xl border-2 border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-700">
              No hay artículos disponibles.{" "}
              <a href="/admin/proveedores" className="font-semibold underline">
                Cargalos en Admin → Proveedores
              </a>
            </div>
          ) : (
            <div className="relative">
              <input
                value={articuloQuery}
                onChange={(e) => { setArticuloQuery(e.target.value); if (articuloSel) handleArticuloClear(); }}
                suppressHydrationWarning
                placeholder="Buscar artículo... (ej: sticker, lona, tarjeta)"
                className={inputCls}
              />
              {articulosFiltrados.length > 0 && (
                <ul className="absolute z-20 w-full border border-zinc-200 rounded-xl mt-1 max-h-52 overflow-y-auto shadow-xl bg-white">
                  {articulosFiltrados.map((a) => (
                    <li key={a.id}
                      className="px-3 py-2.5 cursor-pointer hover:bg-amber-50 border-b border-zinc-50 last:border-0"
                      onClick={() => handleArticuloSelect(a)}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-zinc-800">{a.nombre}</p>
                          <p className="text-xs text-zinc-400">
                            {esAdmin ? `${a.proveedor_nombre} · ` : ""}{a.unidad}
                          </p>
                          {a.descripcion && <p className="text-xs text-zinc-400 truncate">{a.descripcion}</p>}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-bold text-[#1a1a2e]">
                            ${precioVenta(a.precio_costo, a.markup_pct).toFixed(0)}
                          </p>
                          <p className="text-xs text-zinc-400">{a.tiempo_entrega_dias}d</p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Info del artículo seleccionado */}
          {articuloSel && (
            <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2.5 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-zinc-700">{articuloSel.nombre}</span>
                <button type="button" onClick={handleArticuloClear}
                  className="text-zinc-400 hover:text-zinc-700 text-base leading-none">×</button>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-zinc-600">
                {esAdmin && (
                  <span>Proveedor: <strong>{articuloSel.proveedor_nombre}</strong></span>
                )}
                {esAdmin && <span>Costo: <strong>${Number(articuloSel.precio_costo).toFixed(2)}</strong></span>}
                {esAdmin && <span>Markup: <strong>{Number(articuloSel.markup_pct).toFixed(0)}%</strong></span>}
                <span className="font-bold text-[#1a1a2e]">
                  Precio venta: ${precioVenta(articuloSel.precio_costo, articuloSel.markup_pct).toFixed(2)}
                </span>
                <span className="text-blue-600 font-medium">
                  🕐 Entrega: {articuloSel.tiempo_entrega_dias === 1 ? "1 día" : `${articuloSel.tiempo_entrega_dias} días`}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ══ CALCULADOR DE PLANCHA ══ */}
        {articuloSel?.plancha_ancho_cm && articuloSel?.plancha_alto_cm && (
          <PlanchaCalculator
            articulo={articuloSel}
            onUpdate={(total, item, anotacion) => {
              setForm((f) => ({ ...f, total, item, anotacion: anotacion || f.anotacion }));
            }}
          />
        )}

        {/* ══ 3. ÍTEM / DESCRIPCIÓN ══ */}
        <div>
          <label className="block text-sm font-bold text-zinc-700 mb-1">
            Descripción del encargo <span className="text-red-500">*</span>
          </label>
          <input value={form.item} onChange={(e) => set("item", e.target.value)}
            suppressHydrationWarning className={inputCls}
            placeholder="Ej: Stickers troquelados 5×5cm" required />
        </div>

        {/* Cantidad */}
        <div>
          <label className="block text-sm font-bold text-zinc-700 mb-1">Cantidad</label>
          <input type="number" value={form.cantidad} onChange={(e) => set("cantidad", e.target.value)}
            suppressHydrationWarning className={inputCls} min="1" placeholder="Opcional" />
        </div>

        {/* Anotación */}
        <div>
          <label className="block text-sm font-bold text-zinc-700 mb-1">Anotación / detalles adicionales</label>
          <textarea value={form.anotacion} onChange={(e) => set("anotacion", e.target.value)}
            suppressHydrationWarning className={inputCls} rows={3}
            placeholder="Color, tamaño, instrucciones especiales..." />
        </div>

        {/* Total y Seña */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-bold text-zinc-700 mb-1">
              Total ($) {articuloSel && <span className="text-xs font-normal text-zinc-400">(calculado)</span>}
            </label>
            <input type="number" value={form.total} onChange={(e) => set("total", e.target.value)}
              suppressHydrationWarning className={inputCls} min="0" placeholder="0" />
          </div>
          <div>
            <label className="block text-sm font-bold text-zinc-700 mb-1">Seña ($)</label>
            <input type="number" value={form.senia} onChange={(e) => set("senia", e.target.value)}
              suppressHydrationWarning className={inputCls} min="0" />
          </div>
        </div>

        {/* Sucursal */}
        <div>
          <label className="block text-sm font-bold text-zinc-700 mb-1">Sucursal</label>
          <input value={form.sucursal} onChange={(e) => set("sucursal", e.target.value)}
            suppressHydrationWarning className={inputCls} placeholder="Opcional" />
        </div>

        {error && <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</p>}

        <button type="submit"
          disabled={loading || !form.cliente_id || !form.item}
          className="w-full py-2.5 rounded-xl font-bold text-sm disabled:opacity-60 transition"
          style={{ backgroundColor: "#f5a623", color: "#1a1a2e" }}>
          {loading ? "Guardando..." : "Guardar encargo"}
        </button>
      </form>
    </div>
  );
}
