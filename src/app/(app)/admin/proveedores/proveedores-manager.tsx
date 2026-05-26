"use client";

import { useState } from "react";

/* ── Types ───────────────────────────────────────────────── */
type Articulo = {
  id: string;
  proveedor_id: string;
  nombre: string;
  descripcion: string | null;
  unidad: string;
  precio_costo: number;
  markup_pct: number;
  tiempo_entrega_dias: number;
  plancha_ancho_cm: number | null;
  plancha_alto_cm: number | null;
  activo: boolean;
  updated_at: string;
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

type NuevoProveedorForm = {
  nombre: string;
  contacto: string;
  telefono: string;
  email: string;
  notas: string;
};

type NuevoArticuloForm = {
  nombre: string;
  descripcion: string;
  unidad: string;
  precio_costo: string;
  markup_pct: string;
  tiempo_entrega_dias: string;
  plancha_ancho_cm: string;
  plancha_alto_cm: string;
};

const FORM_ART_VACIO: NuevoArticuloForm = {
  nombre: "",
  descripcion: "",
  unidad: "unidad",
  precio_costo: "",
  markup_pct: "",
  tiempo_entrega_dias: "1",
  plancha_ancho_cm: "",
  plancha_alto_cm: "",
};

/* ── Utils ───────────────────────────────────────────────── */
function precioVenta(costo: number, markup: number) {
  return costo * (1 + markup / 100);
}

function diasLabel(d: number) {
  return d === 1 ? "1 día" : `${d} días`;
}

/* ── Input / Btn helpers ─────────────────────────────────── */
const inputCls =
  "rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#f5a623] w-full";
const inputSmCls =
  "rounded border border-zinc-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#f5a623] w-full";
const btnPrimary =
  "px-4 py-2 rounded-lg bg-[#f5a623] text-[#1a1a2e] font-bold text-sm hover:bg-[#d4881a] disabled:opacity-50 transition";
const btnSecondary =
  "px-3 py-1.5 rounded-lg border border-zinc-200 text-sm text-zinc-600 hover:bg-zinc-100 transition";
const btnDanger =
  "px-3 py-1.5 rounded-lg border border-red-200 text-sm text-red-500 hover:bg-red-50 transition";

/* ── Component ───────────────────────────────────────────── */
export default function ProveedoresManager({
  proveedores: inicial,
}: {
  proveedores: Proveedor[];
}) {
  const [proveedores, setProveedores] = useState<Proveedor[]>(inicial);
  const [expandido, setExpandido] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  /* ── Nuevo proveedor ── */
  const [mostrarNuevo, setMostrarNuevo] = useState(false);
  const [formNuevo, setFormNuevo] = useState<NuevoProveedorForm>({
    nombre: "", contacto: "", telefono: "", email: "", notas: "",
  });
  const [creando, setCreando] = useState(false);

  /* ── Editar proveedor ── */
  const [editandoProv, setEditandoProv] = useState<string | null>(null);
  const [editFormProv, setEditFormProv] = useState<Partial<NuevoProveedorForm>>({});
  const [savingProv, setSavingProv] = useState<string | null>(null);

  /* ── Nuevo artículo ── */
  const [nuevoArtProv, setNuevoArtProv] = useState<string | null>(null);
  const [formArt, setFormArt] = useState<NuevoArticuloForm>(FORM_ART_VACIO);
  const [creandoArt, setCreandoArt] = useState(false);

  /* ── Editar artículo ── */
  const [editandoArt, setEditandoArt] = useState<string | null>(null);
  const [editFormArt, setEditFormArt] = useState<Partial<NuevoArticuloForm>>({});
  const [savingArt, setSavingArt] = useState<string | null>(null);

  /* ── Helpers ── */
  const toggle = (id: string) =>
    setExpandido((p) => ({ ...p, [id]: !p[id] }));

  const setErr = (msg: string | null) => {
    setError(msg);
    if (msg) setTimeout(() => setError(null), 5000);
  };

  /* ══════════════════════════════════════════════════════
     PROVEEDORES CRUD
  ══════════════════════════════════════════════════════ */

  const crearProveedor = async () => {
    if (!formNuevo.nombre.trim()) return;
    setCreando(true);
    const res = await fetch("/api/admin/proveedores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formNuevo),
    });
    const json = await res.json();
    if (!res.ok) { setErr(json.error ?? "Error al crear"); setCreando(false); return; }
    setProveedores((p) => [...p, json.proveedor].sort((a, b) => a.nombre.localeCompare(b.nombre)));
    setExpandido((e) => ({ ...e, [json.proveedor.id]: true }));
    setFormNuevo({ nombre: "", contacto: "", telefono: "", email: "", notas: "" });
    setMostrarNuevo(false);
    setCreando(false);
  };

  const iniciarEditProv = (p: Proveedor) => {
    setEditandoProv(p.id);
    setEditFormProv({
      nombre: p.nombre,
      contacto: p.contacto ?? "",
      telefono: p.telefono ?? "",
      email: p.email ?? "",
      notas: p.notas ?? "",
    });
  };

  const guardarProv = async (id: string) => {
    setSavingProv(id);
    const res = await fetch("/api/admin/proveedores", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...editFormProv }),
    });
    const json = await res.json();
    if (!res.ok) { setErr(json.error ?? "Error al guardar"); setSavingProv(null); return; }
    setProveedores((prev) =>
      prev.map((p) => p.id === id ? { ...p, ...json.proveedor } : p)
    );
    setEditandoProv(null);
    setSavingProv(null);
  };

  const toggleActivoProv = async (p: Proveedor) => {
    const res = await fetch("/api/admin/proveedores", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: p.id, activo: !p.activo }),
    });
    const json = await res.json();
    if (!res.ok) { setErr(json.error); return; }
    setProveedores((prev) =>
      prev.map((x) => x.id === p.id ? { ...x, activo: json.proveedor.activo } : x)
    );
  };

  const eliminarProv = async (id: string) => {
    if (!confirm("¿Eliminar este proveedor y todos sus artículos?")) return;
    const res = await fetch("/api/admin/proveedores", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) { const j = await res.json(); setErr(j.error); return; }
    setProveedores((p) => p.filter((x) => x.id !== id));
  };

  /* ══════════════════════════════════════════════════════
     ARTÍCULOS CRUD
  ══════════════════════════════════════════════════════ */

  const abrirNuevoArt = (provId: string) => {
    setNuevoArtProv(provId);
    setFormArt(FORM_ART_VACIO);
  };

  const crearArticulo = async (provId: string) => {
    if (!formArt.nombre.trim()) return;
    setCreandoArt(true);
    const res = await fetch("/api/admin/proveedores/articulos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ proveedor_id: provId, ...formArt }),
    });
    const json = await res.json();
    if (!res.ok) { setErr(json.error ?? "Error al crear artículo"); setCreandoArt(false); return; }
    setProveedores((prev) =>
      prev.map((p) =>
        p.id === provId
          ? { ...p, proveedor_articulos: [...p.proveedor_articulos, json.articulo].sort((a, b) => a.nombre.localeCompare(b.nombre)) }
          : p
      )
    );
    setNuevoArtProv(null);
    setFormArt(FORM_ART_VACIO);
    setCreandoArt(false);
  };

  const iniciarEditArt = (art: Articulo) => {
    setEditandoArt(art.id);
    setEditFormArt({
      nombre: art.nombre,
      descripcion: art.descripcion ?? "",
      unidad: art.unidad,
      precio_costo: String(art.precio_costo),
      markup_pct: String(art.markup_pct),
      tiempo_entrega_dias: String(art.tiempo_entrega_dias),
      plancha_ancho_cm: art.plancha_ancho_cm != null ? String(art.plancha_ancho_cm) : "",
      plancha_alto_cm:  art.plancha_alto_cm  != null ? String(art.plancha_alto_cm)  : "",
    });
  };

  const guardarArt = async (art: Articulo) => {
    setSavingArt(art.id);
    const res = await fetch("/api/admin/proveedores/articulos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: art.id, ...editFormArt }),
    });
    const json = await res.json();
    if (!res.ok) { setErr(json.error ?? "Error al guardar"); setSavingArt(null); return; }
    setProveedores((prev) =>
      prev.map((p) =>
        p.id === art.proveedor_id
          ? {
              ...p,
              proveedor_articulos: p.proveedor_articulos.map((a) =>
                a.id === art.id ? json.articulo : a
              ),
            }
          : p
      )
    );
    setEditandoArt(null);
    setSavingArt(null);
  };

  const toggleActivoArt = async (art: Articulo) => {
    const res = await fetch("/api/admin/proveedores/articulos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: art.id, activo: !art.activo }),
    });
    const json = await res.json();
    if (!res.ok) { setErr(json.error); return; }
    setProveedores((prev) =>
      prev.map((p) =>
        p.id === art.proveedor_id
          ? {
              ...p,
              proveedor_articulos: p.proveedor_articulos.map((a) =>
                a.id === art.id ? { ...a, activo: json.articulo.activo } : a
              ),
            }
          : p
      )
    );
  };

  const eliminarArt = async (art: Articulo) => {
    if (!confirm(`¿Eliminar "${art.nombre}"?`)) return;
    const res = await fetch("/api/admin/proveedores/articulos", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: art.id }),
    });
    if (!res.ok) { const j = await res.json(); setErr(j.error); return; }
    setProveedores((prev) =>
      prev.map((p) =>
        p.id === art.proveedor_id
          ? { ...p, proveedor_articulos: p.proveedor_articulos.filter((a) => a.id !== art.id) }
          : p
      )
    );
  };

  /* ══════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════ */

  return (
    <div className="space-y-4">
      {/* Mensaje de error global */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Botón nuevo proveedor ── */}
      <div className="flex justify-end">
        <button
          onClick={() => { setMostrarNuevo(true); setEditandoProv(null); }}
          className="px-4 py-2 rounded-lg bg-[#1a1a2e] text-white font-semibold text-sm hover:bg-[#16213e] transition"
        >
          + Nuevo proveedor
        </button>
      </div>

      {/* ── Form nuevo proveedor ── */}
      {mostrarNuevo && (
        <div className="bg-white rounded-xl border border-[#f5a623] shadow-sm p-5 space-y-4">
          <h3 className="text-sm font-bold text-zinc-800 uppercase tracking-wide">Nuevo proveedor</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Nombre *</label>
              <input
                value={formNuevo.nombre}
                onChange={(e) => setFormNuevo((f) => ({ ...f, nombre: e.target.value }))}
                suppressHydrationWarning
                placeholder="Ej: Punto Gráf"
                className={inputCls}
                onKeyDown={(e) => e.key === "Enter" && crearProveedor()}
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Contacto</label>
              <input
                value={formNuevo.contacto}
                onChange={(e) => setFormNuevo((f) => ({ ...f, contacto: e.target.value }))}
                suppressHydrationWarning
                placeholder="Nombre de la persona de contacto"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Teléfono</label>
              <input
                value={formNuevo.telefono}
                onChange={(e) => setFormNuevo((f) => ({ ...f, telefono: e.target.value }))}
                suppressHydrationWarning
                placeholder="Ej: 2241-XXXXXX"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Email</label>
              <input
                type="email"
                value={formNuevo.email}
                onChange={(e) => setFormNuevo((f) => ({ ...f, email: e.target.value }))}
                suppressHydrationWarning
                placeholder="contacto@proveedor.com"
                className={inputCls}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-zinc-500 mb-1">Notas</label>
              <input
                value={formNuevo.notas}
                onChange={(e) => setFormNuevo((f) => ({ ...f, notas: e.target.value }))}
                suppressHydrationWarning
                placeholder="Notas internas sobre el proveedor"
                className={inputCls}
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setMostrarNuevo(false)} className={btnSecondary}>
              Cancelar
            </button>
            <button
              onClick={crearProveedor}
              disabled={!formNuevo.nombre.trim() || creando}
              className={btnPrimary}
            >
              {creando ? "Creando..." : "Crear proveedor"}
            </button>
          </div>
        </div>
      )}

      {/* ── Lista de proveedores ── */}
      {proveedores.length === 0 && !mostrarNuevo && (
        <div className="bg-white rounded-xl border border-zinc-200 px-6 py-12 text-center text-zinc-400 text-sm">
          No hay proveedores todavía. Hacé clic en "Nuevo proveedor" para agregar uno.
        </div>
      )}

      {proveedores.map((prov) => {
        const abierto = expandido[prov.id] ?? false;
        const esEditandoProv = editandoProv === prov.id;
        const artActivos = prov.proveedor_articulos.filter((a) => a.activo).length;

        return (
          <div
            key={prov.id}
            className={`bg-white rounded-xl border shadow-sm overflow-hidden transition ${
              prov.activo ? "border-zinc-200" : "border-zinc-100 opacity-60"
            }`}
          >
            {/* ── Cabecera del proveedor ── */}
            <div className="flex items-center gap-3 px-5 py-4">
              {/* Expandir/colapsar */}
              <button
                onClick={() => toggle(prov.id)}
                className="text-zinc-400 hover:text-zinc-700 transition flex-shrink-0"
                aria-label="Expandir"
              >
                <svg
                  className={`w-5 h-5 transition-transform ${abierto ? "rotate-90" : ""}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Info del proveedor o form de edición */}
              {esEditandoProv ? (
                <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <input
                    value={editFormProv.nombre ?? ""}
                    onChange={(e) => setEditFormProv((f) => ({ ...f, nombre: e.target.value }))}
                    suppressHydrationWarning
                    placeholder="Nombre"
                    className={inputSmCls}
                  />
                  <input
                    value={editFormProv.contacto ?? ""}
                    onChange={(e) => setEditFormProv((f) => ({ ...f, contacto: e.target.value }))}
                    suppressHydrationWarning
                    placeholder="Contacto"
                    className={inputSmCls}
                  />
                  <input
                    value={editFormProv.telefono ?? ""}
                    onChange={(e) => setEditFormProv((f) => ({ ...f, telefono: e.target.value }))}
                    suppressHydrationWarning
                    placeholder="Teléfono"
                    className={inputSmCls}
                  />
                  <input
                    value={editFormProv.email ?? ""}
                    onChange={(e) => setEditFormProv((f) => ({ ...f, email: e.target.value }))}
                    suppressHydrationWarning
                    placeholder="Email"
                    className={inputSmCls}
                  />
                  <div className="col-span-2 sm:col-span-4">
                    <input
                      value={editFormProv.notas ?? ""}
                      onChange={(e) => setEditFormProv((f) => ({ ...f, notas: e.target.value }))}
                      suppressHydrationWarning
                      placeholder="Notas"
                      className={inputSmCls}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-zinc-800 text-base">{prov.nombre}</span>
                    {!prov.activo && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-500">
                        Inactivo
                      </span>
                    )}
                    <span className="text-xs text-zinc-400">
                      {artActivos} artículo{artActivos !== 1 ? "s" : ""} activo{artActivos !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-0.5 flex-wrap">
                    {prov.contacto && (
                      <span className="text-xs text-zinc-500">👤 {prov.contacto}</span>
                    )}
                    {prov.telefono && (
                      <span className="text-xs text-zinc-500">📞 {prov.telefono}</span>
                    )}
                    {prov.email && (
                      <span className="text-xs text-zinc-500">✉️ {prov.email}</span>
                    )}
                    {prov.notas && (
                      <span className="text-xs text-zinc-400 italic truncate max-w-xs">{prov.notas}</span>
                    )}
                  </div>
                </div>
              )}

              {/* Acciones del proveedor */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {esEditandoProv ? (
                  <>
                    <button
                      onClick={() => guardarProv(prov.id)}
                      disabled={savingProv === prov.id}
                      className={btnPrimary}
                    >
                      {savingProv === prov.id ? "..." : "Guardar"}
                    </button>
                    <button onClick={() => setEditandoProv(null)} className={btnSecondary}>
                      Cancelar
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => toggleActivoProv(prov)}
                      className={`text-xs px-2 py-1 rounded-full font-medium transition ${
                        prov.activo
                          ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                          : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                      }`}
                    >
                      {prov.activo ? "Activo" : "Inactivo"}
                    </button>
                    <button onClick={() => iniciarEditProv(prov)} className={btnSecondary}>
                      Editar
                    </button>
                    <button onClick={() => eliminarProv(prov.id)} className={btnDanger}>
                      Borrar
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* ── Panel de artículos (expandible) ── */}
            {abierto && (
              <div className="border-t border-zinc-100 bg-zinc-50/50">

                {/* Tabla de artículos */}
                {prov.proveedor_articulos.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-zinc-100 border-b border-zinc-200">
                        <tr>
                          <th className="text-left px-4 py-2.5 font-semibold text-zinc-600">Artículo</th>
                          <th className="text-left px-3 py-2.5 font-semibold text-zinc-600">Unidad</th>
                          <th className="text-right px-3 py-2.5 font-semibold text-zinc-600">Costo</th>
                          <th className="text-right px-3 py-2.5 font-semibold text-zinc-600">Markup</th>
                          <th className="text-right px-3 py-2.5 font-semibold text-zinc-600 whitespace-nowrap">
                            Precio venta
                          </th>
                          <th className="text-center px-3 py-2.5 font-semibold text-zinc-600">Entrega</th>
                          <th className="text-center px-3 py-2.5 font-semibold text-zinc-600">Estado</th>
                          <th className="px-4 py-2.5" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {prov.proveedor_articulos.map((art) => {
                          const esEditandoArt = editandoArt === art.id;
                          const costo   = esEditandoArt ? parseFloat(editFormArt.precio_costo ?? "") || 0 : art.precio_costo;
                          const markup  = esEditandoArt ? parseFloat(editFormArt.markup_pct ?? "") || 0 : art.markup_pct;
                          const venta   = precioVenta(costo, markup);
                          const dias    = esEditandoArt ? parseInt(editFormArt.tiempo_entrega_dias ?? "1") || 1 : art.tiempo_entrega_dias;

                          return (
                            <tr
                              key={art.id}
                              className={`hover:bg-zinc-50 transition ${!art.activo ? "opacity-50" : ""}`}
                            >
                              {/* Nombre + descripción */}
                              <td className="px-4 py-2.5">
                                {esEditandoArt ? (
                                  <div className="space-y-1">
                                    <input
                                      value={editFormArt.nombre ?? ""}
                                      onChange={(e) => setEditFormArt((f) => ({ ...f, nombre: e.target.value }))}
                                      suppressHydrationWarning
                                      placeholder="Nombre"
                                      className={inputSmCls}
                                    />
                                    <input
                                      value={editFormArt.descripcion ?? ""}
                                      onChange={(e) => setEditFormArt((f) => ({ ...f, descripcion: e.target.value }))}
                                      suppressHydrationWarning
                                      placeholder="Descripción (opcional)"
                                      className={inputSmCls}
                                    />
                                    <div className="flex gap-1 items-center pt-0.5">
                                      <span className="text-xs text-zinc-400">📐</span>
                                      <input
                                        type="number" step="0.01" min="0"
                                        value={editFormArt.plancha_ancho_cm ?? ""}
                                        onChange={(e) => setEditFormArt((f) => ({ ...f, plancha_ancho_cm: e.target.value }))}
                                        suppressHydrationWarning
                                        placeholder="Ancho cm"
                                        className="rounded border border-zinc-300 px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#f5a623] w-20"
                                      />
                                      <span className="text-xs text-zinc-300">×</span>
                                      <input
                                        type="number" step="0.01" min="0"
                                        value={editFormArt.plancha_alto_cm ?? ""}
                                        onChange={(e) => setEditFormArt((f) => ({ ...f, plancha_alto_cm: e.target.value }))}
                                        suppressHydrationWarning
                                        placeholder="Alto cm"
                                        className="rounded border border-zinc-300 px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#f5a623] w-20"
                                      />
                                    </div>
                                  </div>
                                ) : (
                                  <div>
                                    <span className="font-medium text-zinc-800">{art.nombre}</span>
                                    {art.descripcion && (
                                      <p className="text-xs text-zinc-400 mt-0.5">{art.descripcion}</p>
                                    )}
                                    {art.plancha_ancho_cm && art.plancha_alto_cm && (
                                      <span className="inline-block text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded mt-0.5">
                                        📐 {art.plancha_ancho_cm}×{art.plancha_alto_cm}cm
                                      </span>
                                    )}
                                  </div>
                                )}
                              </td>

                              {/* Unidad */}
                              <td className="px-3 py-2.5">
                                {esEditandoArt ? (
                                  <input
                                    value={editFormArt.unidad ?? ""}
                                    onChange={(e) => setEditFormArt((f) => ({ ...f, unidad: e.target.value }))}
                                    suppressHydrationWarning
                                    placeholder="unidad"
                                    className="rounded border border-zinc-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#f5a623] w-20"
                                  />
                                ) : (
                                  <span className="text-zinc-500">{art.unidad}</span>
                                )}
                              </td>

                              {/* Costo */}
                              <td className="px-3 py-2.5 text-right">
                                {esEditandoArt ? (
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={editFormArt.precio_costo ?? ""}
                                    onChange={(e) => setEditFormArt((f) => ({ ...f, precio_costo: e.target.value }))}
                                    suppressHydrationWarning
                                    className="rounded border border-zinc-300 px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-[#f5a623] w-24"
                                    placeholder="0.00"
                                  />
                                ) : (
                                  <span className="font-mono text-zinc-700">${Number(art.precio_costo).toFixed(2)}</span>
                                )}
                              </td>

                              {/* Markup */}
                              <td className="px-3 py-2.5 text-right">
                                {esEditandoArt ? (
                                  <div className="flex items-center justify-end gap-1">
                                    <input
                                      type="number"
                                      step="0.1"
                                      min="0"
                                      value={editFormArt.markup_pct ?? ""}
                                      onChange={(e) => setEditFormArt((f) => ({ ...f, markup_pct: e.target.value }))}
                                      suppressHydrationWarning
                                      className="rounded border border-zinc-300 px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-[#f5a623] w-20"
                                      placeholder="0"
                                    />
                                    <span className="text-zinc-400 text-xs">%</span>
                                  </div>
                                ) : (
                                  <span className="font-mono text-zinc-700">{Number(art.markup_pct).toFixed(1)}%</span>
                                )}
                              </td>

                              {/* Precio venta (calculado) */}
                              <td className="px-3 py-2.5 text-right">
                                <span
                                  className="font-mono font-bold"
                                  style={{ color: "#1a1a2e" }}
                                >
                                  ${venta.toFixed(2)}
                                </span>
                                {markup > 0 && (
                                  <span className="block text-xs text-zinc-400">
                                    +${(venta - costo).toFixed(2)}
                                  </span>
                                )}
                              </td>

                              {/* Tiempo de entrega */}
                              <td className="px-3 py-2.5 text-center">
                                {esEditandoArt ? (
                                  <input
                                    type="number"
                                    min="1"
                                    value={editFormArt.tiempo_entrega_dias ?? ""}
                                    onChange={(e) => setEditFormArt((f) => ({ ...f, tiempo_entrega_dias: e.target.value }))}
                                    suppressHydrationWarning
                                    className="rounded border border-zinc-300 px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#f5a623] w-16"
                                    placeholder="1"
                                  />
                                ) : (
                                  <span
                                    className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-700 font-medium"
                                  >
                                    🕐 {diasLabel(dias)}
                                  </span>
                                )}
                              </td>

                              {/* Estado */}
                              <td className="px-3 py-2.5 text-center">
                                <button
                                  onClick={() => toggleActivoArt(art)}
                                  className={`text-xs px-2 py-1 rounded-full font-medium transition ${
                                    art.activo
                                      ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                                      : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                                  }`}
                                >
                                  {art.activo ? "Activo" : "Inactivo"}
                                </button>
                              </td>

                              {/* Acciones */}
                              <td className="px-4 py-2.5">
                                {esEditandoArt ? (
                                  <div className="flex gap-1.5 justify-end">
                                    <button
                                      onClick={() => guardarArt(art)}
                                      disabled={savingArt === art.id}
                                      className="px-3 py-1 rounded-lg bg-[#f5a623] text-[#1a1a2e] font-bold text-xs hover:bg-[#d4881a] disabled:opacity-50 transition"
                                    >
                                      {savingArt === art.id ? "..." : "Guardar"}
                                    </button>
                                    <button
                                      onClick={() => setEditandoArt(null)}
                                      className="px-2 py-1 rounded-lg border border-zinc-200 text-xs text-zinc-600 hover:bg-zinc-100 transition"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex gap-1.5 justify-end">
                                    <button
                                      onClick={() => iniciarEditArt(art)}
                                      className="px-2 py-1 rounded border border-zinc-200 text-xs text-zinc-600 hover:bg-zinc-100 transition"
                                    >
                                      Editar
                                    </button>
                                    <button
                                      onClick={() => eliminarArt(art)}
                                      className="px-2 py-1 rounded border border-red-200 text-xs text-red-500 hover:bg-red-50 transition"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* ── Form nuevo artículo ── */}
                {nuevoArtProv === prov.id ? (
                  <div className="px-5 py-4 border-t border-zinc-100 space-y-3">
                    <p className="text-xs font-semibold text-zinc-600 uppercase tracking-wide">
                      Nuevo artículo
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 items-end">
                      <div className="col-span-2">
                        <label className="block text-xs text-zinc-500 mb-1">Nombre *</label>
                        <input
                          value={formArt.nombre}
                          onChange={(e) => setFormArt((f) => ({ ...f, nombre: e.target.value }))}
                          suppressHydrationWarning
                          placeholder="Ej: Sticker redondo 5cm"
                          className={inputSmCls}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-500 mb-1">Unidad</label>
                        <input
                          value={formArt.unidad}
                          onChange={(e) => setFormArt((f) => ({ ...f, unidad: e.target.value }))}
                          suppressHydrationWarning
                          placeholder="unidad"
                          className={inputSmCls}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-500 mb-1">Precio costo ($)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={formArt.precio_costo}
                          onChange={(e) => setFormArt((f) => ({ ...f, precio_costo: e.target.value }))}
                          suppressHydrationWarning
                          placeholder="0.00"
                          className={inputSmCls}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-500 mb-1">Markup (%)</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={formArt.markup_pct}
                          onChange={(e) => setFormArt((f) => ({ ...f, markup_pct: e.target.value }))}
                          suppressHydrationWarning
                          placeholder="0"
                          className={inputSmCls}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-500 mb-1">Entrega (días)</label>
                        <input
                          type="number"
                          min="1"
                          value={formArt.tiempo_entrega_dias}
                          onChange={(e) => setFormArt((f) => ({ ...f, tiempo_entrega_dias: e.target.value }))}
                          suppressHydrationWarning
                          className={inputSmCls}
                        />
                      </div>
                      <div className="col-span-2 sm:col-span-3 lg:col-span-6">
                        <label className="block text-xs text-zinc-500 mb-1">Descripción (opcional)</label>
                        <input
                          value={formArt.descripcion}
                          onChange={(e) => setFormArt((f) => ({ ...f, descripcion: e.target.value }))}
                          suppressHydrationWarning
                          placeholder="Detalle del artículo"
                          className={inputSmCls}
                        />
                      </div>
                      {/* Dimensiones de plancha */}
                      <div className="col-span-2 sm:col-span-3 lg:col-span-6 border-t border-zinc-100 pt-3 mt-1">
                        <p className="text-xs text-zinc-400 font-medium mb-2">
                          📐 Dimensiones de plancha <span className="font-normal">(opcional — solo si el artículo es una plancha cortable)</span>
                        </p>
                        <div className="flex gap-2 flex-wrap">
                          <div>
                            <label className="block text-xs text-zinc-500 mb-1">Ancho (cm)</label>
                            <input
                              type="number" step="0.01" min="0"
                              value={formArt.plancha_ancho_cm}
                              onChange={(e) => setFormArt((f) => ({ ...f, plancha_ancho_cm: e.target.value }))}
                              suppressHydrationWarning
                              placeholder="Ej: 100"
                              className="rounded border border-zinc-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#f5a623] w-24"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-zinc-500 mb-1">Alto (cm)</label>
                            <input
                              type="number" step="0.01" min="0"
                              value={formArt.plancha_alto_cm}
                              onChange={(e) => setFormArt((f) => ({ ...f, plancha_alto_cm: e.target.value }))}
                              suppressHydrationWarning
                              placeholder="Ej: 58"
                              className="rounded border border-zinc-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#f5a623] w-24"
                            />
                          </div>
                          {formArt.plancha_ancho_cm && formArt.plancha_alto_cm && (
                            <div className="flex items-end pb-1">
                              <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full font-medium">
                                {formArt.plancha_ancho_cm} × {formArt.plancha_alto_cm} cm
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Preview precio venta */}
                    {formArt.precio_costo && (
                      <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-xs text-zinc-700">
                        <span>Costo: <strong>${parseFloat(formArt.precio_costo || "0").toFixed(2)}</strong></span>
                        <span className="text-zinc-300">→</span>
                        <span>Markup: <strong>{formArt.markup_pct || "0"}%</strong></span>
                        <span className="text-zinc-300">→</span>
                        <span className="font-bold" style={{ color: "#1a1a2e" }}>
                          Venta: ${precioVenta(
                            parseFloat(formArt.precio_costo || "0"),
                            parseFloat(formArt.markup_pct || "0")
                          ).toFixed(2)}
                        </span>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={() => crearArticulo(prov.id)}
                        disabled={!formArt.nombre.trim() || creandoArt}
                        className={btnPrimary}
                      >
                        {creandoArt ? "Guardando..." : "Agregar artículo"}
                      </button>
                      <button
                        onClick={() => setNuevoArtProv(null)}
                        className={btnSecondary}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="px-5 py-3 border-t border-zinc-100">
                    <button
                      onClick={() => abrirNuevoArt(prov.id)}
                      className="text-sm text-[#f5a623] font-semibold hover:text-[#d4881a] transition"
                    >
                      + Agregar artículo
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* ── Info box ── */}
      {proveedores.length > 0 && (
        <div className="bg-amber-50 rounded-xl border border-amber-100 px-4 py-3 text-xs text-zinc-600 space-y-1">
          <p className="font-semibold text-zinc-800">¿Cómo funciona el cálculo?</p>
          <p>
            <strong>Precio de venta</strong> = Costo × (1 + Markup ÷ 100)
          </p>
          <p className="text-zinc-400">
            Ejemplo: costo $100 con markup 30% → venta $130 (ganancia $30)
          </p>
        </div>
      )}
    </div>
  );
}
