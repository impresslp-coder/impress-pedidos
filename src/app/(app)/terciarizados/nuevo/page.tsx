"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";

/* ── Types ── */
type Articulo = {
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
};

type Proveedor = {
  id: string;
  nombre: string;
  contacto: string | null;
  telefono: string | null;
  email: string | null;
  notas: string | null;
  activo: boolean;
  proveedor_articulos: Articulo[];
};

type FormState = {
  cliente:   string;
  telefono:  string;
  item:      string;
  cantidad:  string;
  anotacion: string;
  proveedor: string;
  total:     string;
  senia:     string;
  sucursal:  string;
};

const FORM_INICIAL: FormState = {
  cliente:   "",
  telefono:  "",
  item:      "",
  cantidad:  "",
  anotacion: "",
  proveedor: "",
  total:     "",
  senia:     "0",
  sucursal:  "",
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
   Aparece cuando el artículo tiene dimensiones (plancha_ancho_cm / plancha_alto_cm)
══════════════════════════════════════════════════════ */
const GAP_CM = 0.3; // 3mm entre stickers

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
  articulo: Articulo;
  onUpdate: (total: string, item: string, anotacion: string) => void;
}) {
  const [sw,  setSw]  = useState("");
  const [sh,  setSh]  = useState("");
  const [qty, setQty] = useState("");

  // Restante
  const [restDesc,  setRestDesc]  = useState("");
  const [restW,     setRestW]     = useState("");
  const [restH,     setRestH]     = useState("");
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

  // Restante: cuántos stickers del trabajo secundario caben
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

      {/* Inputs: tamaño sticker + cantidad */}
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

      {/* Resultado */}
      {result && (
        <div className="space-y-3">
          {/* Resumen de cálculo */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="bg-white rounded-lg border border-zinc-200 px-3 py-2 text-center">
              <p className="text-xs text-zinc-400">Por plancha</p>
              <p className="text-lg font-black text-zinc-800">{result.perPlancha}</p>
              <p className="text-xs text-zinc-400">stickers</p>
            </div>
            <div className="bg-white rounded-lg border border-zinc-200 px-3 py-2 text-center">
              <p className="text-xs text-zinc-400">Planchas</p>
              <p className="text-lg font-black text-zinc-800">{result.planchasNecesarias}</p>
              <p className="text-xs text-zinc-400">necesarias</p>
            </div>
            <div className="bg-white rounded-lg border border-zinc-200 px-3 py-2 text-center">
              <p className="text-xs text-zinc-400">Última plancha</p>
              <p className="text-lg font-black text-zinc-800">{result.lastUsed}</p>
              <p className="text-xs text-zinc-400">usados</p>
            </div>
            <div className={`rounded-lg border px-3 py-2 text-center ${result.lastFree > 0 ? "bg-amber-50 border-amber-200" : "bg-white border-zinc-200"}`}>
              <p className="text-xs text-zinc-400">Restante</p>
              <p className={`text-lg font-black ${result.lastFree > 0 ? "text-amber-600" : "text-zinc-400"}`}>
                {result.lastFree}
              </p>
              <p className="text-xs text-zinc-400">slots libres</p>
            </div>
          </div>

          {/* Precio calculado */}
          <div className="flex items-center justify-between bg-white rounded-lg border border-zinc-200 px-3 py-2">
            <span className="text-sm text-zinc-600">
              {result.planchasNecesarias} plancha{result.planchasNecesarias > 1 ? "s" : ""} × ${precioVenta(articulo.precio_costo, articulo.markup_pct).toFixed(2)}
            </span>
            <span className="text-base font-black" style={{ color: "#1a1a2e" }}>
              Total: ${result.totalCosto.toFixed(2)}
            </span>
          </div>

          {/* Restante — asignar trabajo */}
          {result.lastFree > 0 && (
            <div className="border border-amber-200 rounded-lg bg-amber-50/60 p-3 space-y-2">
              <p className="text-xs font-semibold text-amber-700">
                ✂️ Restante: {result.lastFree} slots libres en la última plancha
                {restAreaCm2 > 0 && (
                  <span className="font-normal ml-1 text-amber-600">
                    (~{restAreaCm2.toFixed(0)} cm²)
                  </span>
                )}
              </p>
              <p className="text-xs text-zinc-500">¿Querés aprovechar ese espacio para otro trabajo?</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="sm:col-span-3">
                  <input
                    value={restDesc}
                    onChange={(e) => { setRestDesc(e.target.value); setRestAsignado(false); }}
                    suppressHydrationWarning
                    placeholder='Descripción (ej: "stickers propios", "pedido Juan")'
                    className={`${fieldCls} w-full`}
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Ancho (cm)</label>
                  <input type="number" step="0.1" min="0.1"
                    value={restW} onChange={(e) => { setRestW(e.target.value); setRestAsignado(false); }}
                    suppressHydrationWarning
                    placeholder="Ej: 3" className={`${fieldCls} w-full`} />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Alto (cm)</label>
                  <input type="number" step="0.1" min="0.1"
                    value={restH} onChange={(e) => { setRestH(e.target.value); setRestAsignado(false); }}
                    suppressHydrationWarning
                    placeholder="Ej: 3" className={`${fieldCls} w-full`} />
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

          {/* Botón aplicar al encargo */}
          <button
            type="button"
            onClick={() => { aplicar(); setRestAsignado(true); }}
            className="w-full py-2 rounded-xl font-bold text-sm transition"
            style={{ backgroundColor: "#f5a623", color: "#1a1a2e" }}
          >
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

      <p className="text-xs text-zinc-400">
        Espaciado de corte: {GAP_CM * 10}mm entre stickers
      </p>
    </div>
  );
}

export default function NuevoTerciarizadoPage() {
  const router = useRouter();

  const [form, setForm]           = useState<FormState>(FORM_INICIAL);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [copiado, setCopiado]     = useState(false);

  // Proveedores desde la DB
  const [proveedores, setProveedores]           = useState<Proveedor[]>([]);
  const [cargandoProv, setCargandoProv]         = useState(true);
  const [proveedorSelId, setProveedorSelId]     = useState<string>("");
  const [articuloSelId, setArticuloSelId]       = useState<string>("");
  const [articuloSel, setArticuloSel]           = useState<Articulo | null>(null);

  useEffect(() => {
    fetch("/api/admin/proveedores")
      .then((r) => r.json())
      .then((json) => {
        if (json.proveedores) {
          setProveedores(json.proveedores.filter((p: Proveedor) => p.activo));
        }
      })
      .catch(() => {})
      .finally(() => setCargandoProv(false));
  }, []);

  const set = (k: keyof FormState, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  // Al cambiar de proveedor: limpiar artículo y total calculado
  const handleProveedorChange = (provId: string) => {
    setProveedorSelId(provId);
    setArticuloSelId("");
    setArticuloSel(null);
    const prov = proveedores.find((p) => p.id === provId);
    set("proveedor", prov?.nombre ?? "");
    // Limpiar item y total solo si venían del artículo anterior
    setForm((f) => ({ ...f, proveedor: prov?.nombre ?? "", item: "", total: "" }));
  };

  // Al seleccionar artículo: auto-fill item, total y guardar referencia
  const handleArticuloChange = (artId: string) => {
    setArticuloSelId(artId);
    const prov = proveedores.find((p) => p.id === proveedorSelId);
    const art = prov?.proveedor_articulos.find((a) => a.id === artId) ?? null;
    setArticuloSel(art);
    if (art) {
      const venta = precioVenta(art.precio_costo, art.markup_pct);
      setForm((f) => ({
        ...f,
        item:  art.nombre,
        total: venta.toFixed(2),
      }));
    }
  };

  const proveedorActual = proveedores.find((p) => p.id === proveedorSelId);
  const articulosActivos = proveedorActual?.proveedor_articulos.filter((a) => a.activo) ?? [];

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/terciarizados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          proveedor_articulo_id: articuloSelId || null,
          precio_costo:          articuloSel?.precio_costo ?? null,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        setError(json.error ?? "Error al guardar");
        setLoading(false);
        return;
      }
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
    setResultado(null);
    setError(null);
    setCopiado(false);
    setForm(FORM_INICIAL);
    setProveedorSelId("");
    setArticuloSelId("");
    setArticuloSel(null);
  };

  /* ── PANTALLA DE CONFIRMACIÓN ── */
  if (resultado) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-zinc-800">Encargo terciarizado</h1>
        <div className="max-w-xl bg-white rounded-xl border border-zinc-200 shadow-sm p-6 space-y-5">

          <div className="text-center space-y-2">
            <p className="text-sm text-zinc-500 font-medium uppercase tracking-wide">Encargo generado</p>
            <p className="text-5xl font-black tracking-tight" style={{ color: "#1a1a2e" }}>
              {resultado.numero}
            </p>
            <span className="inline-block px-3 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
              ✅ Guardado correctamente
            </span>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              Mensaje para copiar y pegar
            </label>
            <textarea
              readOnly
              value={resultado.mensaje}
              rows={6}
              className="w-full rounded-xl border-2 border-zinc-200 px-3 py-2 text-sm bg-zinc-50 focus:outline-none resize-none"
            />
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={copiar}
              className="w-full py-2 rounded-xl font-semibold text-sm transition text-white"
              style={{ backgroundColor: "#1a1a2e" }}
            >
              {copiado ? "✅ ¡Copiado!" : "📋 Copiar mensaje"}
            </button>

            <a
              href={`/api/pdf/terciarizado/${resultado.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2 rounded-xl font-semibold text-sm text-center transition bg-zinc-700 hover:bg-zinc-800 text-white block"
            >
              🖨️ Ver / Imprimir PDF
            </a>

            {resultado.telefono && (
              <a
                href={`https://wa.me/${resultado.telefono.replace(/\D/g, "")}?text=${encodeURIComponent(resultado.mensaje)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2 rounded-xl font-semibold text-sm text-center transition bg-emerald-500 hover:bg-emerald-600 text-white block"
              >
                💬 Abrir WhatsApp
              </a>
            )}

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={resetear}
                className="py-2 rounded-xl font-semibold text-sm border-2 border-zinc-200 hover:bg-zinc-50 transition text-zinc-700"
              >
                Nuevo encargo
              </button>
              <button
                onClick={() => router.push("/terciarizados")}
                className="py-2 rounded-xl font-semibold text-sm transition"
                style={{ backgroundColor: "#f5a623", color: "#1a1a2e" }}
              >
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

      <form
        onSubmit={handleSubmit}
        className="max-w-xl bg-white rounded-xl border border-zinc-200 shadow-sm p-6 space-y-4"
      >
        {/* Cliente */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            Cliente <span className="text-red-500">*</span>
          </label>
          <input
            value={form.cliente}
            onChange={(e) => set("cliente", e.target.value)}
            suppressHydrationWarning
            className={inputCls}
            placeholder="Nombre del cliente"
            required
          />
        </div>

        {/* Teléfono */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            Teléfono (WhatsApp)
          </label>
          <input
            value={form.telefono}
            onChange={(e) => set("telefono", e.target.value)}
            suppressHydrationWarning
            className={inputCls}
            placeholder="Ej: 5491112345678"
          />
        </div>

        {/* ── Proveedor ── */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            Proveedor <span className="text-red-500">*</span>
          </label>
          {cargandoProv ? (
            <div className={`${inputCls} text-zinc-400`}>Cargando proveedores...</div>
          ) : proveedores.length === 0 ? (
            <div className="rounded-xl border-2 border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-700">
              No hay proveedores activos.{" "}
              <a href="/admin/proveedores" className="font-semibold underline">
                Agregá uno en Admin → Proveedores
              </a>
            </div>
          ) : (
            <select
              value={proveedorSelId}
              onChange={(e) => handleProveedorChange(e.target.value)}
              required
              className="w-full rounded-xl border-2 border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:border-amber-400 transition bg-white"
            >
              <option value="">— Seleccioná un proveedor —</option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          )}

          {/* Nota / info del proveedor */}
          {proveedorActual && (
            <div className="mt-1.5 rounded-lg bg-zinc-50 border border-zinc-100 px-3 py-2 text-xs text-zinc-600 space-y-0.5">
              {proveedorActual.notas && <p>{proveedorActual.notas}</p>}
              <div className="flex flex-wrap gap-3 text-zinc-400">
                {proveedorActual.contacto && <span>👤 {proveedorActual.contacto}</span>}
                {proveedorActual.telefono && <span>📞 {proveedorActual.telefono}</span>}
                {proveedorActual.email    && <span>✉️ {proveedorActual.email}</span>}
              </div>
            </div>
          )}
        </div>

        {/* ── Artículo del proveedor ── */}
        {proveedorSelId && (
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              Artículo
              <span className="ml-1 text-xs font-normal text-zinc-400">(opcional — o escribí el ítem libremente)</span>
            </label>
            {articulosActivos.length === 0 ? (
              <p className="text-xs text-zinc-400 bg-zinc-50 rounded-lg px-3 py-2 border border-zinc-100">
                Este proveedor no tiene artículos cargados. Completá el ítem manualmente.
              </p>
            ) : (
              <select
                value={articuloSelId}
                onChange={(e) => handleArticuloChange(e.target.value)}
                className="w-full rounded-xl border-2 border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:border-amber-400 transition bg-white"
              >
                <option value="">— Seleccioná un artículo (opcional) —</option>
                {articulosActivos.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nombre} — ${precioVenta(a.precio_costo, a.markup_pct).toFixed(2)} / {a.unidad}
                  </option>
                ))}
              </select>
            )}

            {/* Info del artículo seleccionado */}
            {articuloSel && (
              <div className="mt-1.5 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-zinc-700 flex flex-wrap gap-x-4 gap-y-1">
                <span>
                  Costo: <strong>${Number(articuloSel.precio_costo).toFixed(2)}</strong>
                </span>
                <span>
                  Markup: <strong>{Number(articuloSel.markup_pct).toFixed(1)}%</strong>
                </span>
                <span className="font-bold" style={{ color: "#1a1a2e" }}>
                  Precio venta: ${precioVenta(articuloSel.precio_costo, articuloSel.markup_pct).toFixed(2)}
                </span>
                <span className="text-blue-600 font-medium">
                  🕐 Entrega estimada: {articuloSel.tiempo_entrega_dias === 1 ? "1 día" : `${articuloSel.tiempo_entrega_dias} días`}
                </span>
              </div>
            )}
          </div>
        )}

        {/* ── Calculador de plancha (aparece solo si el artículo tiene dimensiones) ── */}
        {articuloSel?.plancha_ancho_cm && articuloSel?.plancha_alto_cm && (
          <PlanchaCalculator
            articulo={articuloSel}
            onUpdate={(total, item, anotacion) => {
              setForm((f) => ({
                ...f,
                total,
                item,
                anotacion: anotacion || f.anotacion,
              }));
            }}
          />
        )}

        {/* ── Ítem / descripción ── */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            Ítem / descripción del encargo <span className="text-red-500">*</span>
          </label>
          <input
            value={form.item}
            onChange={(e) => set("item", e.target.value)}
            suppressHydrationWarning
            className={inputCls}
            placeholder="Ej: Stickers troquelados 5×5cm"
            required
          />
        </div>

        {/* Cantidad */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Cantidad</label>
          <input
            type="number"
            value={form.cantidad}
            onChange={(e) => set("cantidad", e.target.value)}
            suppressHydrationWarning
            className={inputCls}
            min="1"
            placeholder="Opcional"
          />
        </div>

        {/* Anotación */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            Anotación / detalles adicionales
          </label>
          <textarea
            value={form.anotacion}
            onChange={(e) => set("anotacion", e.target.value)}
            suppressHydrationWarning
            className={inputCls}
            rows={3}
            placeholder="Color, tamaño, instrucciones especiales..."
          />
        </div>

        {/* Total y Seña */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              Total ($)
              {articuloSel && (
                <span className="ml-1 text-xs font-normal text-zinc-400">(calculado)</span>
              )}
            </label>
            <input
              type="number"
              value={form.total}
              onChange={(e) => set("total", e.target.value)}
              suppressHydrationWarning
              className={inputCls}
              min="0"
              placeholder="0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Seña ($)</label>
            <input
              type="number"
              value={form.senia}
              onChange={(e) => set("senia", e.target.value)}
              suppressHydrationWarning
              className={inputCls}
              min="0"
            />
          </div>
        </div>

        {/* Sucursal */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Sucursal</label>
          <input
            value={form.sucursal}
            onChange={(e) => set("sucursal", e.target.value)}
            suppressHydrationWarning
            className={inputCls}
            placeholder="Opcional"
          />
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || !form.cliente || !form.proveedor || !form.item}
          className="w-full py-2.5 rounded-xl font-semibold text-sm disabled:opacity-60 transition"
          style={{ backgroundColor: "#f5a623", color: "#1a1a2e" }}
        >
          {loading ? "Guardando..." : "Guardar encargo"}
        </button>
      </form>
    </div>
  );
}
