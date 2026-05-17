"use client";

import { useState, useRef, useTransition } from "react";

type Producto = {
  id: string; nombre: string; categoria?: string | null;
  paginas?: number | null; precio?: number | null;
  descuento_maximo?: number | null; foto_url?: string | null; activo: boolean;
};
type Parametro = { id: string; nombre: string; precio: number; divisor: number };
type StockMap = Record<string, number>;

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(n);

function calcPrecio(p: Producto, param: Parametro | null): number | null {
  if (param && p.paginas) return Math.round(p.paginas * param.precio / (param.divisor || 1));
  if (p.precio != null) return p.precio;
  return null;
}

// ── Edit Modal ───────────────────────────────────────────────────────────────
function EditModal({
  producto, esAdmin, onSave, onClose,
}: {
  producto: Producto; esAdmin: boolean;
  onSave: (updated: Producto) => void; onClose: () => void;
}) {
  const [form, setForm] = useState({
    nombre: producto.nombre ?? "",
    categoria: producto.categoria ?? "",
    paginas: producto.paginas?.toString() ?? "",
    precio: producto.precio?.toString() ?? "",
    descuento_maximo: producto.descuento_maximo?.toString() ?? "",
  });
  const [fotoUrl, setFotoUrl] = useState(producto.foto_url ?? "");
  const [uploading, setUploading] = useState(false);
  const [saving, startSave] = useTransition();
  const [error, setError] = useState<string>();
  const fileRef = useRef<HTMLInputElement>(null);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleFoto = async (file: File) => {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/catalogo/foto/${producto.id}`, { method: "POST", body: fd });
    const json = await res.json();
    setUploading(false);
    if (json.foto_url) setFotoUrl(json.foto_url);
    else setError(json.error ?? "Error al subir foto");
  };

  const handleSave = () => {
    startSave(async () => {
      setError(undefined);
      const body: Record<string, unknown> = {
        nombre: form.nombre,
        categoria: form.categoria || null,
        paginas: form.paginas ? parseInt(form.paginas) : null,
        precio: form.precio ? parseFloat(form.precio) : null,
        foto_url: fotoUrl || null,
      };
      if (esAdmin) body.descuento_maximo = form.descuento_maximo ? parseFloat(form.descuento_maximo) : null;

      const res = await fetch(`/api/catalogo/productos/${producto.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.error) { setError(json.error); return; }
      onSave({ ...producto, ...body, foto_url: fotoUrl || null });
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-[480px] max-w-[95vw] space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center">
          <h3 className="font-black text-zinc-800 text-lg">Editar producto</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-zinc-100 text-zinc-500 text-xl">×</button>
        </div>

        {/* Foto */}
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-xl border-2 border-zinc-200 overflow-hidden flex items-center justify-center bg-zinc-50 shrink-0">
            {fotoUrl
              ? <img src={fotoUrl} alt="foto" className="w-full h-full object-cover" />
              : <span className="text-3xl">📷</span>}
          </div>
          <div className="flex-1">
            <p className="text-xs text-zinc-500 mb-2">Foto de tapa</p>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { if (e.target.files?.[0]) handleFoto(e.target.files[0]); }} />
            <button type="button" onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="px-3 py-1.5 rounded-lg border-2 border-dashed border-zinc-300 text-xs text-zinc-500 hover:border-[#f5a623] hover:text-[#f5a623] transition disabled:opacity-50">
              {uploading ? "Subiendo…" : "📁 Subir imagen"}
            </button>
            {fotoUrl && (
              <button type="button" onClick={() => setFotoUrl("")}
                className="ml-2 text-xs text-red-400 hover:text-red-600">✕ Quitar</button>
            )}
          </div>
        </div>

        {/* Nombre + Categoría */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">Nombre *</label>
            <input value={form.nombre} onChange={(e) => set("nombre", e.target.value)} suppressHydrationWarning
              className="w-full rounded-xl border-2 border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:border-[#f5a623]" />
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">Categoría</label>
            <input value={form.categoria} onChange={(e) => set("categoria", e.target.value)} suppressHydrationWarning
              placeholder="Ej: Apunte, Libro..."
              className="w-full rounded-xl border-2 border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:border-[#f5a623]" />
          </div>
        </div>

        {/* Páginas + Precio fijo */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">Páginas</label>
            <input type="number" value={form.paginas} onChange={(e) => set("paginas", e.target.value)} suppressHydrationWarning
              min="1" placeholder="—"
              className="w-full rounded-xl border-2 border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:border-[#f5a623]" />
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">Precio fijo</label>
            <input type="number" value={form.precio} onChange={(e) => set("precio", e.target.value)} suppressHydrationWarning
              min="0" step="0.01" placeholder="Se calcula por modo"
              className="w-full rounded-xl border-2 border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:border-[#f5a623]" />
          </div>
        </div>

        {/* Descuento máximo (admin only) */}
        {esAdmin && (
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">
              Descuento máximo <span className="text-amber-500 normal-case font-normal">(solo admins)</span>
            </label>
            <div className="relative">
              <input type="number" value={form.descuento_maximo} onChange={(e) => set("descuento_maximo", e.target.value)}
                suppressHydrationWarning min="0" max="100" step="1" placeholder="0"
                className="w-full rounded-xl border-2 border-amber-200 bg-amber-50 px-3 py-2 text-sm focus:outline-none focus:border-[#f5a623] pr-8" />
              <span className="absolute right-3 top-2.5 text-sm text-zinc-400">%</span>
            </div>
          </div>
        )}

        {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={handleSave} disabled={saving || !form.nombre}
            className="flex-1 py-2.5 rounded-xl bg-[#f5a623] text-[#1a1a2e] font-black text-sm hover:bg-amber-400 disabled:opacity-40 transition">
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
          <button type="button" onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-zinc-100 text-zinc-600 text-sm font-medium hover:bg-zinc-200 transition">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────
export default function CatalogoView({
  productos: initial, stockMap, parametros, esAdmin,
}: {
  productos: Producto[]; stockMap: StockMap; parametros: Parametro[]; esAdmin: boolean;
}) {
  const [productos, setProductos] = useState<Producto[]>(initial);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [modoId, setModoId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Producto | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Producto | null>(null);
  const [deleting, startDelete] = useTransition();

  const modoActivo = parametros.find((p) => p.id === modoId) ?? null;
  const categorias = [...new Set(productos.map((p) => p.categoria).filter(Boolean))] as string[];

  const filtrados = productos.filter((p) => {
    if (cat && p.categoria !== cat) return false;
    if (q && !p.nombre.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const handleDelete = (prod: Producto) => {
    startDelete(async () => {
      const res = await fetch(`/api/catalogo/productos/${prod.id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.ok) setProductos((prev) => prev.filter((p) => p.id !== prod.id));
      setConfirmDelete(null);
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-zinc-800">Catálogo</h1>
        <span className="text-xs text-zinc-400">{filtrados.length} productos</span>
      </div>

      {/* Search + category filter */}
      <div className="flex flex-wrap gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} suppressHydrationWarning
          placeholder="Buscar producto…"
          className="rounded-xl border-2 border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:border-[#f5a623] flex-1 min-w-[180px] max-w-xs" />
        <select value={cat} onChange={(e) => setCat(e.target.value)}
          className="rounded-xl border-2 border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:border-[#f5a623]">
          <option value="">Todas las categorías</option>
          {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Mode buttons */}
      {parametros.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setModoId(null)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition ${
              !modoId ? "border-[#1a1a2e] bg-[#1a1a2e] text-white" : "border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300"
            }`}
          >
            Precio fijo
          </button>
          {parametros.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setModoId(modoId === p.id ? null : p.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition ${
                modoId === p.id
                  ? "border-[#f5a623] bg-amber-50 text-[#1a1a2e]"
                  : "border-zinc-200 bg-white text-zinc-500 hover:border-amber-200 hover:text-zinc-700"
              }`}
            >
              {p.nombre}
            </button>
          ))}
        </div>
      )}

      {/* Products grid */}
      {filtrados.length === 0 ? (
        <p className="text-zinc-400 text-center py-16">Sin productos</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtrados.map((prod) => {
            const precio = calcPrecio(prod, modoActivo);
            const stock = stockMap[prod.id];

            return (
              <div key={prod.id} className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden hover:shadow-md transition group">
                {/* Photo */}
                <div className="h-36 bg-zinc-100 flex items-center justify-center overflow-hidden">
                  {prod.foto_url
                    ? <img src={prod.foto_url} alt={prod.nombre} className="w-full h-full object-cover" />
                    : <span className="text-4xl opacity-30">📄</span>}
                </div>

                <div className="p-3 space-y-2">
                  {/* Name + category */}
                  <div>
                    <p className="font-bold text-zinc-800 text-sm leading-tight line-clamp-2">{prod.nombre}</p>
                    {prod.categoria && (
                      <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-500 text-xs">{prod.categoria}</span>
                    )}
                  </div>

                  {/* Páginas + precio */}
                  <div className="flex items-center justify-between">
                    {prod.paginas && (
                      <span className="text-xs text-zinc-400">{prod.paginas} pág</span>
                    )}
                    <span className="font-black text-[#f5a623] text-base ml-auto">
                      {precio != null ? fmt(precio) : "—"}
                    </span>
                  </div>

                  {/* Mode label if active */}
                  {modoActivo && prod.paginas && (
                    <p className="text-xs text-zinc-400">{modoActivo.nombre}</p>
                  )}

                  {/* Descuento máximo (admin only) */}
                  {esAdmin && prod.descuento_maximo != null && prod.descuento_maximo > 0 && (
                    <div className="flex items-center gap-1">
                      <span className="text-xs bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full">
                        Dto. máx: {prod.descuento_maximo}%
                      </span>
                    </div>
                  )}

                  {/* Stock */}
                  {stock != null && (
                    <p className={`text-xs font-semibold ${stock <= 0 ? "text-red-500" : "text-emerald-600"}`}>
                      Stock: {stock}
                    </p>
                  )}

                  {/* Admin actions */}
                  {esAdmin && (
                    <div className="flex gap-2 pt-1 border-t border-zinc-100">
                      <button
                        type="button"
                        onClick={() => setEditing(prod)}
                        className="flex-1 py-1.5 rounded-lg bg-zinc-100 text-zinc-600 text-xs font-semibold hover:bg-zinc-200 transition"
                      >
                        ✏️ Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(prod)}
                        className="px-3 py-1.5 rounded-lg bg-red-50 text-red-500 text-xs font-semibold hover:bg-red-100 transition"
                      >
                        🗑️
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <EditModal
          producto={editing}
          esAdmin={esAdmin}
          onSave={(updated) => {
            setProductos((prev) => prev.map((p) => p.id === updated.id ? updated : p));
            setEditing(null);
          }}
          onClose={() => setEditing(null)}
        />
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmDelete(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-[360px] space-y-4">
            <h3 className="font-black text-zinc-800">¿Eliminar producto?</h3>
            <p className="text-sm text-zinc-600">
              <span className="font-semibold">{confirmDelete.nombre}</span> quedará inactivo.
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => handleDelete(confirmDelete)} disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700 disabled:opacity-40 transition">
                {deleting ? "Eliminando…" : "Sí, eliminar"}
              </button>
              <button type="button" onClick={() => setConfirmDelete(null)}
                className="px-4 py-2.5 rounded-xl bg-zinc-100 text-zinc-600 text-sm hover:bg-zinc-200 transition">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
