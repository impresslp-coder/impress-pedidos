"use client";

import { useState } from "react";

type Producto = {
  id: string;
  nombre: string;
  categoria: string | null;
  precio_d: number | null;
  precio_e: number | null;
  precio_f: number | null;
  precio_g: number | null;
  activo: boolean;
};

type Parametro = {
  id: string;
  nombre: string;
  precio: number;
  divisor: number;
  descuento_maximo: number | null;
  activo: boolean;
};

const CATS = ["D", "E", "F", "G"] as const;
const CAT_LABELS: Record<string, string> = {
  D: "D (Lista)",
  E: "E (Mayorista)",
  F: "F (Especial)",
  G: "G (VIP)",
};

type Sucursal = { id: string; nombre: string; activo: boolean };
type PresetImpresion = { nombre: string; hojas: number; papel: string; precioUnitario: number };

function parsePresets(raw?: string): PresetImpresion[] {
  if (!raw) return [{ nombre: "Documento", hojas: 1, papel: "Comun", precioUnitario: 0 }];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [{ nombre: "Documento", hojas: 1, papel: "Comun", precioUnitario: 0 }];
    return parsed.map((item) => ({
      nombre: String(item.nombre || "Documento"),
      hojas: Math.max(1, Number(item.hojas) || 1),
      papel: String(item.papel || "Comun"),
      precioUnitario: Math.max(0, Number(item.precioUnitario) || 0),
    }));
  } catch {
    return [{ nombre: "Documento", hojas: 1, papel: "Comun", precioUnitario: 0 }];
  }
}

export default function PreciosManager({
  productos: inicial,
  parametros: inicialParams,
  config: configInicial,
  sucursales: sucursalesIniciales,
}: {
  productos: Producto[];
  parametros: Parametro[];
  config: Record<string, string>;
  sucursales: Sucursal[];
}) {
  const [productos, setProductos] = useState<Producto[]>(inicial);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [precios, setPrecios] = useState<Record<string, string>>({});

  // Parámetros state
  const [parametros, setParametros] = useState<Parametro[]>(inicialParams);
  const [savingParam, setSavingParam] = useState<string | null>(null);
  const [savedParam, setSavedParam] = useState<string | null>(null);
  const [paramEdits, setParamEdits] = useState<Record<string, string>>({});
  const [nuevoParam, setNuevoParam] = useState({ nombre: "", precio: "", divisor: "1" });
  const [creandoParam, setCreandoParam] = useState(false);

  // Nuevo producto
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevaCategoria, setNuevaCategoria] = useState("");
  const [creando, setCreando] = useState(false);

  // Sucursales
  const [sucursales, setSucursales] = useState<Sucursal[]>(sucursalesIniciales);
  const [nuevaSucursal, setNuevaSucursal] = useState("");
  const [creandoSucursal, setCreandoSucursal] = useState(false);

  const crearSucursal = async () => {
    if (!nuevaSucursal.trim()) return;
    setCreandoSucursal(true);
    const res = await fetch("/api/admin/sucursales", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: nuevaSucursal.trim() }),
    });
    const json = await res.json();
    if (json.sucursal) setSucursales((prev) => [...prev, json.sucursal]);
    setNuevaSucursal(""); setCreandoSucursal(false);
  };

  const toggleSucursal = async (s: Sucursal) => {
    await fetch("/api/admin/sucursales", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: s.id, activo: !s.activo }),
    });
    setSucursales((prev) => prev.map((x) => x.id === s.id ? { ...x, activo: !x.activo } : x));
  };

  // Configuración
  const [cfg, setCfg] = useState<Record<string, string>>(configInicial);
  const [savingCfg, setSavingCfg] = useState(false);
  const [savedCfg, setSavedCfg] = useState(false);
  const [presetsImpresion, setPresetsImpresion] = useState<PresetImpresion[]>(() => parsePresets(configInicial.ventas_presets_impresion));
  const [nuevoPreset, setNuevoPreset] = useState<PresetImpresion>({ nombre: "", hojas: 1, papel: "Comun", precioUnitario: 0 });

  const guardarConfig = async () => {
    setSavingCfg(true);
    await fetch("/api/admin/config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...cfg,
        ventas_presets_impresion: JSON.stringify(presetsImpresion),
      }),
    });
    setSavingCfg(false);
    setSavedCfg(true);
    setTimeout(() => setSavedCfg(false), 2000);
  };

  const updatePreset = (index: number, changes: Partial<PresetImpresion>) => {
    setPresetsImpresion((prev) => prev.map((preset, idx) => idx === index ? { ...preset, ...changes } : preset));
  };

  const agregarPreset = () => {
    if (!nuevoPreset.nombre.trim()) return;
    setPresetsImpresion((prev) => [...prev, {
      nombre: nuevoPreset.nombre.trim(),
      hojas: Math.max(1, Number(nuevoPreset.hojas) || 1),
      papel: nuevoPreset.papel.trim() || "Comun",
      precioUnitario: Math.max(0, Number(nuevoPreset.precioUnitario) || 0),
    }]);
    setNuevoPreset({ nombre: "", hojas: 1, papel: "Comun", precioUnitario: 0 });
  };

  const fmt = (n: number | null) => n != null ? String(n) : "";

  /* ── Productos ── */
  const guardar = async (prod: Producto) => {
    setSaving(prod.id);
    const res = await fetch("/api/admin/precios", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: prod.id,
        precio_d: parseFloat(precios[`${prod.id}_D`] ?? fmt(prod.precio_d)) || null,
        precio_e: parseFloat(precios[`${prod.id}_E`] ?? fmt(prod.precio_e)) || null,
        precio_f: parseFloat(precios[`${prod.id}_F`] ?? fmt(prod.precio_f)) || null,
        precio_g: parseFloat(precios[`${prod.id}_G`] ?? fmt(prod.precio_g)) || null,
        nombre: precios[`${prod.id}_nombre`] ?? prod.nombre,
        categoria: precios[`${prod.id}_cat`] ?? prod.categoria,
      }),
    });
    const json = await res.json();
    if (json.producto) {
      setProductos((prev) => prev.map((p) => p.id === prod.id ? json.producto : p));
    }
    setSaving(null);
    setSaved(prod.id);
    setTimeout(() => setSaved(null), 2000);
  };

  const crear = async () => {
    if (!nuevoNombre) return;
    setCreando(true);
    const res = await fetch("/api/admin/precios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: nuevoNombre, categoria: nuevaCategoria }),
    });
    const json = await res.json();
    if (json.producto) setProductos((prev) => [...prev, json.producto]);
    setNuevoNombre(""); setNuevaCategoria(""); setCreando(false);
  };

  const toggleActivo = async (prod: Producto) => {
    await fetch("/api/admin/precios", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: prod.id, activo: !prod.activo }),
    });
    setProductos((prev) => prev.map((p) => p.id === prod.id ? { ...p, activo: !p.activo } : p));
  };

  /* ── Parámetros ── */
  const guardarParam = async (param: Parametro) => {
    setSavingParam(param.id);
    const nombre = paramEdits[`${param.id}_nombre`] ?? param.nombre;
    const precio = parseFloat(paramEdits[`${param.id}_precio`] ?? String(param.precio)) || 0;
    const divisor = parseInt(paramEdits[`${param.id}_divisor`] ?? String(param.divisor)) || 1;
    const descuento_maximo = parseInt(paramEdits[`${param.id}_desc_max`] ?? String(param.descuento_maximo ?? 100)) || 100;

    const res = await fetch("/api/admin/parametros", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: param.id, nombre, precio, divisor, descuento_maximo }),
    });
    const json = await res.json();
    if (json.parametro) {
      setParametros((prev) => prev.map((p) => p.id === param.id ? json.parametro : p));
    }
    setSavingParam(null);
    setSavedParam(param.id);
    setTimeout(() => setSavedParam(null), 2000);
  };

  const crearParam = async () => {
    if (!nuevoParam.nombre) return;
    setCreandoParam(true);
    const res = await fetch("/api/admin/parametros", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre: nuevoParam.nombre,
        precio: parseFloat(nuevoParam.precio) || 0,
        divisor: parseInt(nuevoParam.divisor) || 1,
      }),
    });
    const json = await res.json();
    if (json.parametro) setParametros((prev) => [...prev, json.parametro]);
    setNuevoParam({ nombre: "", precio: "", divisor: "1" });
    setCreandoParam(false);
  };

  const toggleActivoParam = async (param: Parametro) => {
    await fetch("/api/admin/parametros", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: param.id, activo: !param.activo }),
    });
    setParametros((prev) => prev.map((p) => p.id === param.id ? { ...p, activo: !p.activo } : p));
  };

  return (
    <div className="space-y-8">

      {/* ── Sección Parámetros ── */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-zinc-800">Parámetros</h2>
          <p className="text-sm text-zinc-500 mt-0.5">
            Precio por unidad física. El sistema calcula: <code className="bg-zinc-100 px-1 rounded">hojas × precio</code>.
            Para doble faz, poné divisor = 2 y el sistema divide las páginas del PDF por 2 para obtener las hojas.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-zinc-600">Nombre</th>
                <th className="text-center px-4 py-3 font-semibold text-zinc-600">Precio unitario ($)</th>
                <th className="text-center px-4 py-3 font-semibold text-zinc-600">
                  Divisor
                  <span className="block text-xs font-normal text-zinc-400">1=simple, 2=doble faz</span>
                </th>
                <th className="text-center px-4 py-3 font-semibold text-zinc-600">
                  Desc. máx. (%)
                </th>
                <th className="text-center px-4 py-3 font-semibold text-zinc-600">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {parametros.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-zinc-400 text-sm">
                    Sin parámetros todavía. Agregá uno abajo.
                  </td>
                </tr>
              )}
              {parametros.map((param) => (
                <tr key={param.id} className={`hover:bg-zinc-50 transition ${!param.activo ? "opacity-50" : ""}`}>
                  <td className="px-4 py-3">
                    <input
                      defaultValue={param.nombre}
                      suppressHydrationWarning
                      onChange={(e) => setParamEdits((p) => ({ ...p, [`${param.id}_nombre`]: e.target.value }))}
                      className="w-full rounded border border-zinc-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#f5a623]"
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={param.precio}
                      suppressHydrationWarning
                      onChange={(e) => setParamEdits((p) => ({ ...p, [`${param.id}_precio`]: e.target.value }))}
                      className="w-28 rounded border border-zinc-300 px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#f5a623]"
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <select
                      defaultValue={param.divisor}
                      onChange={(e) => setParamEdits((p) => ({ ...p, [`${param.id}_divisor`]: e.target.value }))}
                      className="rounded border border-zinc-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#f5a623]"
                    >
                      <option value="1">1 — Simple faz</option>
                      <option value="2">2 — Doble faz</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      defaultValue={param.descuento_maximo ?? 100}
                      suppressHydrationWarning
                      onChange={(e) => setParamEdits((p) => ({ ...p, [`${param.id}_desc_max`]: e.target.value }))}
                      className="w-16 rounded border border-zinc-300 px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#f5a623]"
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleActivoParam(param)}
                      className={`text-xs px-2 py-1 rounded-full font-medium transition ${
                        param.activo
                          ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                          : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                      }`}
                    >
                      {param.activo ? "Activo" : "Inactivo"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {savedParam === param.id ? (
                      <span className="text-xs text-emerald-600 font-medium">✓ Guardado</span>
                    ) : (
                      <button
                        onClick={() => guardarParam(param)}
                        disabled={savingParam === param.id}
                        className="text-xs px-3 py-1.5 rounded-lg bg-[#f5a623] text-[#1a1a2e] font-bold hover:bg-[#d4881a] disabled:opacity-50 transition"
                      >
                        {savingParam === param.id ? "..." : "Guardar"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Nuevo parámetro */}
        <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-zinc-700 uppercase tracking-wide mb-3">Nuevo parámetro</h3>
          <div className="flex gap-3 flex-wrap items-end">
            <div className="flex-1 min-w-40">
              <label className="block text-xs text-zinc-500 mb-1">Nombre</label>
              <input
                value={nuevoParam.nombre}
                onChange={(e) => setNuevoParam((p) => ({ ...p, nombre: e.target.value }))}
                suppressHydrationWarning
                placeholder="Ej: Hoja doble faz"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#f5a623]"
              />
            </div>
            <div className="w-36">
              <label className="block text-xs text-zinc-500 mb-1">Precio unitario ($)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={nuevoParam.precio}
                onChange={(e) => setNuevoParam((p) => ({ ...p, precio: e.target.value }))}
                suppressHydrationWarning
                placeholder="0.00"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#f5a623]"
              />
            </div>
            <div className="w-44">
              <label className="block text-xs text-zinc-500 mb-1">Tipo</label>
              <select
                value={nuevoParam.divisor}
                onChange={(e) => setNuevoParam((p) => ({ ...p, divisor: e.target.value }))}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#f5a623]"
              >
                <option value="1">Simple faz (÷1)</option>
                <option value="2">Doble faz (÷2)</option>
              </select>
            </div>
            <button
              onClick={crearParam}
              disabled={!nuevoParam.nombre || creandoParam}
              className="px-4 py-2 rounded-lg bg-[#1a1a2e] text-white font-semibold text-sm hover:bg-[#16213e] disabled:opacity-50 transition"
            >
              {creandoParam ? "Creando..." : "+ Agregar"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Divisor visual ── */}
      <hr className="border-zinc-200" />

      {/* ── Sección Productos / catálogo ── */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-zinc-800">Catálogo de productos</h2>
          <p className="text-sm text-zinc-500 mt-0.5">
            Precio por página según categoría del cliente (D / E / F / G).
          </p>
        </div>

        <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-zinc-600">Producto</th>
                <th className="text-left px-4 py-3 font-semibold text-zinc-600">Cat.</th>
                {CATS.map((c) => (
                  <th key={c} className="text-center px-3 py-3 font-semibold text-zinc-600">
                    {CAT_LABELS[c]}
                  </th>
                ))}
                <th className="text-center px-4 py-3 font-semibold text-zinc-600">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {productos.map((prod) => (
                <tr key={prod.id} className={`hover:bg-zinc-50 transition ${!prod.activo ? "opacity-50" : ""}`}>
                  <td className="px-4 py-3">
                    <input
                      defaultValue={prod.nombre}
                      suppressHydrationWarning
                      onChange={(e) => setPrecios((p) => ({ ...p, [`${prod.id}_nombre`]: e.target.value }))}
                      className="w-full rounded border border-zinc-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#f5a623]"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      defaultValue={prod.categoria ?? ""}
                      suppressHydrationWarning
                      onChange={(e) => setPrecios((p) => ({ ...p, [`${prod.id}_cat`]: e.target.value }))}
                      className="w-20 rounded border border-zinc-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#f5a623]"
                    />
                  </td>
                  {CATS.map((cat) => {
                    const key = `precio_${cat.toLowerCase()}` as keyof Producto;
                    return (
                      <td key={cat} className="px-3 py-3 text-center">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          suppressHydrationWarning
                          defaultValue={fmt(prod[key] as number | null)}
                          onChange={(e) => setPrecios((p) => ({ ...p, [`${prod.id}_${cat}`]: e.target.value }))}
                          className="w-24 rounded border border-zinc-300 px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#f5a623]"
                          placeholder="—"
                        />
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleActivo(prod)}
                      className={`text-xs px-2 py-1 rounded-full font-medium transition ${
                        prod.activo
                          ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                          : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                      }`}
                    >
                      {prod.activo ? "Activo" : "Inactivo"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {saved === prod.id ? (
                      <span className="text-xs text-emerald-600 font-medium">✓ Guardado</span>
                    ) : (
                      <button
                        onClick={() => guardar(prod)}
                        disabled={saving === prod.id}
                        className="text-xs px-3 py-1.5 rounded-lg bg-[#f5a623] text-[#1a1a2e] font-bold hover:bg-[#d4881a] disabled:opacity-50 transition"
                      >
                        {saving === prod.id ? "..." : "Guardar"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Nuevo producto */}
        <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-zinc-700 uppercase tracking-wide mb-3">Agregar producto al catálogo</h3>
          <div className="flex gap-3 flex-wrap">
            <input
              value={nuevoNombre}
              onChange={(e) => setNuevoNombre(e.target.value)}
              suppressHydrationWarning
              placeholder="Nombre del producto (ej: Apunte A4 B&N)"
              className="flex-1 min-w-48 rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#f5a623]"
            />
            <input
              value={nuevaCategoria}
              onChange={(e) => setNuevaCategoria(e.target.value)}
              suppressHydrationWarning
              placeholder="Categoría (ej: Apuntes)"
              className="w-44 rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#f5a623]"
            />
            <button
              onClick={crear}
              disabled={!nuevoNombre || creando}
              className="px-4 py-2 rounded-lg bg-[#1a1a2e] text-white font-semibold text-sm hover:bg-[#16213e] disabled:opacity-50 transition"
            >
              {creando ? "Creando..." : "+ Agregar"}
            </button>
          </div>
          <p className="text-xs text-zinc-400 mt-2">
            Después de crearlo, completá los precios por página en la tabla y hacé clic en Guardar.
          </p>
        </div>
      </div>

      {/* ── Divisor visual ── */}
      <hr className="border-zinc-200" />

      {/* ── Sucursales ── */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-zinc-800">Sucursales</h2>
          <p className="text-sm text-zinc-500 mt-0.5">Lugares donde se produce y donde retira el cliente.</p>
        </div>
        <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-5 space-y-3">
          {sucursales.length === 0 && (
            <p className="text-sm text-zinc-400 text-center py-2">Sin sucursales todavía.</p>
          )}
          {sucursales.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-3">
              <span className={`text-sm font-medium ${s.activo ? "text-zinc-800" : "text-zinc-400 line-through"}`}>{s.nombre}</span>
              <button onClick={() => toggleSucursal(s)}
                className={`text-xs px-3 py-1 rounded-full font-medium transition ${
                  s.activo ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                }`}>
                {s.activo ? "Activa" : "Inactiva"}
              </button>
            </div>
          ))}
          <div className="flex gap-2 pt-2 border-t border-zinc-100">
            <input value={nuevaSucursal} onChange={(e) => setNuevaSucursal(e.target.value)}
              suppressHydrationWarning placeholder="Ej: Brandsen Centro"
              onKeyDown={(e) => e.key === "Enter" && crearSucursal()}
              className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#f5a623]" />
            <button onClick={crearSucursal} disabled={!nuevaSucursal || creandoSucursal}
              className="px-4 py-2 rounded-lg bg-[#1a1a2e] text-white font-semibold text-sm hover:bg-[#16213e] disabled:opacity-50 transition">
              {creandoSucursal ? "..." : "+ Agregar"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Divisor visual ── */}
      <hr className="border-zinc-200" />

      {/* ── Configuración ── */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-zinc-800">Configuración del formulario</h2>
          <p className="text-sm text-zinc-500 mt-0.5">
            Defaults del formulario de nuevo pedido y descuentos rápidos.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-5 space-y-5">

          {/* Defaults tipo de impresión */}
          <div>
            <p className="text-sm font-semibold text-zinc-700 mb-3">Predeterminados de impresión</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Faz</label>
                <select value={cfg.default_faz ?? "simple"}
                  onChange={(e) => setCfg((c) => ({ ...c, default_faz: e.target.value }))}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#f5a623]">
                  <option value="simple">Simple faz</option>
                  <option value="doble">Doble faz</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Páginas por hoja</label>
                <select value={cfg.default_pag_por_hoja ?? "1"}
                  onChange={(e) => setCfg((c) => ({ ...c, default_pag_por_hoja: e.target.value }))}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#f5a623]">
                  <option value="1">1 p/hoja</option>
                  <option value="2">2 p/hoja</option>
                  <option value="4">4 p/hoja</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Encuadernación</label>
                <select value={cfg.default_encuadernacion ?? "sin"}
                  onChange={(e) => setCfg((c) => ({ ...c, default_encuadernacion: e.target.value }))}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#f5a623]">
                  <option value="sin">Sin encuadernar</option>
                  <option value="anillado">Anillado</option>
                  <option value="encuadernado">Encuadernado</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Abrochado</label>
                <select value={cfg.default_abrochado ?? "false"}
                  onChange={(e) => setCfg((c) => ({ ...c, default_abrochado: e.target.value }))}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#f5a623]">
                  <option value="false">Sin abrochar</option>
                  <option value="true">Abrochado</option>
                </select>
              </div>
            </div>
          </div>

          {/* Descuentos predefinidos */}
          <div>
            <label className="block text-sm font-semibold text-zinc-700 mb-1">
              Descuentos rápidos (%)
            </label>
            <p className="text-xs text-zinc-400 mb-2">Separados por coma. Ejemplo: 5,10,15,20</p>
            <input
              value={cfg.descuentos_predefinidos ?? ""}
              onChange={(e) => setCfg((c) => ({ ...c, descuentos_predefinidos: e.target.value }))}
              suppressHydrationWarning
              placeholder="5,10,15,20"
              className="w-full max-w-sm rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#f5a623]"
            />
            <div className="flex gap-2 mt-2 flex-wrap">
              {(cfg.descuentos_predefinidos ?? "").split(",").filter(Boolean).map((d) => (
                <span key={d} className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-semibold">{d.trim()}%</span>
              ))}
            </div>
          </div>

          <div className="border-t border-zinc-100 pt-5">
            <p className="text-sm font-semibold text-zinc-700 mb-3">Precios de impresiones en Ventas</p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs text-zinc-500 mb-1">Tipos de papel y tramos por hoja</label>
                <input
                  value={cfg.ventas_tipos_papel ?? "Comun:1-10=80;11-50=60;51-9999=45,Opalina:1-10=140;11-50=120;51-9999=100,Fotografico:1-9999=180"}
                  onChange={(e) => setCfg((c) => ({ ...c, ventas_tipos_papel: e.target.value }))}
                  suppressHydrationWarning
                  placeholder="Comun:1-10=80;11-50=60;51-9999=45"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#f5a623]"
                />
                <p className="mt-1 text-xs text-zinc-400">
                  Formato recomendado: Papel:desde-hasta=precio;desde-hasta=precio. Tambien acepta repetir el papel separado por comas.
                </p>
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Extra abrochado</label>
                <input
                  type="number"
                  value={cfg.ventas_extra_abrochado ?? "0"}
                  onChange={(e) => setCfg((c) => ({ ...c, ventas_extra_abrochado: e.target.value }))}
                  suppressHydrationWarning
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#f5a623]"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Extra anillado</label>
                <input
                  type="number"
                  value={cfg.ventas_extra_anillado ?? "0"}
                  onChange={(e) => setCfg((c) => ({ ...c, ventas_extra_anillado: e.target.value }))}
                  suppressHydrationWarning
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#f5a623]"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Extra encuadernado</label>
                <input
                  type="number"
                  value={cfg.ventas_extra_encuadernado ?? "0"}
                  onChange={(e) => setCfg((c) => ({ ...c, ventas_extra_encuadernado: e.target.value }))}
                  suppressHydrationWarning
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#f5a623]"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-zinc-100 pt-5">
            <p className="text-sm font-semibold text-zinc-700 mb-3">Botones preconfigurados de Ventas</p>
            <div className="space-y-2">
              {presetsImpresion.map((preset, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-[1fr_120px_160px_140px_auto] gap-2 items-end rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                  <label className="grid gap-1 text-xs font-semibold text-zinc-500">
                    Nombre
                    <input value={preset.nombre} onChange={(e) => updatePreset(index, { nombre: e.target.value })}
                      className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-800" />
                  </label>
                  <label className="grid gap-1 text-xs font-semibold text-zinc-500">
                    Hojas
                    <input type="number" min="1" value={preset.hojas} onChange={(e) => updatePreset(index, { hojas: Math.max(1, parseInt(e.target.value) || 1) })}
                      className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-800" />
                  </label>
                  <label className="grid gap-1 text-xs font-semibold text-zinc-500">
                    Papel
                    <input value={preset.papel} onChange={(e) => updatePreset(index, { papel: e.target.value })}
                      className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-800" />
                  </label>
                  <label className="grid gap-1 text-xs font-semibold text-zinc-500">
                    Precio c/hoja
                    <input type="number" min="0" step="0.01" value={preset.precioUnitario} onChange={(e) => updatePreset(index, { precioUnitario: Math.max(0, parseFloat(e.target.value) || 0) })}
                      className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-800" />
                  </label>
                  <button type="button" onClick={() => setPresetsImpresion((prev) => prev.filter((_, idx) => idx !== index))}
                    className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-100">
                    Quitar
                  </button>
                </div>
              ))}
              <div className="grid grid-cols-1 md:grid-cols-[1fr_120px_160px_140px_auto] gap-2 items-end rounded-lg border border-dashed border-zinc-300 p-3">
                <label className="grid gap-1 text-xs font-semibold text-zinc-500">
                  Nombre
                  <input value={nuevoPreset.nombre} onChange={(e) => setNuevoPreset((prev) => ({ ...prev, nombre: e.target.value }))}
                    placeholder="Documento"
                    className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-800" />
                </label>
                <label className="grid gap-1 text-xs font-semibold text-zinc-500">
                  Hojas
                  <input type="number" min="1" value={nuevoPreset.hojas} onChange={(e) => setNuevoPreset((prev) => ({ ...prev, hojas: Math.max(1, parseInt(e.target.value) || 1) }))}
                    className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-800" />
                </label>
                <label className="grid gap-1 text-xs font-semibold text-zinc-500">
                  Papel
                  <input value={nuevoPreset.papel} onChange={(e) => setNuevoPreset((prev) => ({ ...prev, papel: e.target.value }))}
                    className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-800" />
                </label>
                <label className="grid gap-1 text-xs font-semibold text-zinc-500">
                  Precio c/hoja
                  <input type="number" min="0" step="0.01" value={nuevoPreset.precioUnitario} onChange={(e) => setNuevoPreset((prev) => ({ ...prev, precioUnitario: Math.max(0, parseFloat(e.target.value) || 0) }))}
                    className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-800" />
                </label>
                <button type="button" onClick={agregarPreset}
                  className="rounded-lg bg-[#1a1a2e] px-3 py-2 text-xs font-bold text-white hover:bg-zinc-800">
                  + Agregar
                </button>
              </div>
              <p className="text-xs text-zinc-400">Ejemplo: Documento, 1 hoja, Comun, precio unitario. Luego aparece como boton en Ventas.</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={guardarConfig} disabled={savingCfg}
              className="px-5 py-2 rounded-lg bg-[#f5a623] text-[#1a1a2e] font-bold text-sm hover:bg-[#d4881a] disabled:opacity-50 transition">
              {savingCfg ? "Guardando..." : "Guardar configuración"}
            </button>
            {savedCfg && <span className="text-xs text-emerald-600 font-medium">✓ Guardado</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
