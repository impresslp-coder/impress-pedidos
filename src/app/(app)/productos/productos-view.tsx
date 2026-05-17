"use client";

import { useState, useRef, useTransition } from "react";

type Producto = {
  id: string; nombre: string; categoria?: string | null;
  codigo_barras?: string | null;
  precio?: number | null; precio_compra?: number | null;
  descuento_maximo?: number | null; foto_url?: string | null; activo: boolean;
};
type StockMap = Record<string, number>;

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(n);

function FotoUploader({ productoId, fotoUrl, onUploaded }: {
  productoId: string; fotoUrl: string; onUploaded: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string>();
  const ref = useRef<HTMLInputElement>(null);
  const handle = async (file: File) => {
    setUploading(true); setErr(undefined);
    const fd = new FormData(); fd.append("file", file);
    const res = await fetch(`/api/catalogo/foto/${productoId}`, { method: "POST", body: fd });
    const json = await res.json();
    setUploading(false);
    if (json.foto_url) onUploaded(json.foto_url);
    else setErr(json.error ?? "Error al subir");
  };
  return (
    <div className="flex items-center gap-4">
      <div className="w-20 h-20 rounded-xl border-2 border-zinc-200 overflow-hidden flex items-center justify-center bg-zinc-50 shrink-0">
        {fotoUrl ? <img src={fotoUrl} alt="foto" className="w-full h-full object-cover" /> : <span className="text-3xl">📷</span>}
      </div>
      <div className="flex-1">
        <p className="text-xs text-zinc-500 mb-1">Foto del producto</p>
        <input ref={ref} type="file" accept="image/*" className="hidden"
          onChange={(e) => { if (e.target.files?.[0]) handle(e.target.files[0]); }} />
        <button type="button" onClick={() => ref.current?.click()} disabled={uploading}
          className="px-3 py-1.5 rounded-lg border-2 border-dashed border-zinc-300 text-xs text-zinc-500 hover:border-[#f5a623] hover:text-[#f5a623] transition disabled:opacity-50">
          {uploading ? "Subiendo…" : "📁 Subir imagen"}
        </button>
        {fotoUrl && <button type="button" onClick={() => onUploaded("")} className="ml-2 text-xs text-red-400 hover:text-red-600">✕ Quitar</button>}
        {err && <p className="text-xs text-red-500 mt-1">{err}</p>}
      </div>
    </div>
  );
}

// ── Agregar Modal ─────────────────────────────────────────────────────────────
function AgregarModal({ esAdmin, onSave, onClose }: {
  esAdmin: boolean;
  onSave: (prod: Producto & { stock: number }) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    nombre: "", categoria: "", codigo_barras: "", precio: "", precio_compra: "",
    descuento_maximo: "", stock_inicial: "", codigo_personal: "",
  });
  const [fotoUrl, setFotoUrl] = useState("");
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const [error, setError] = useState<string>();
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = () => {
    startSave(async () => {
      setError(undefined);
      const res = await fetch("/api/catalogo/productos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: form.nombre, categoria: form.categoria || null,
          codigo_barras: form.codigo_barras || null,
          precio: form.precio || null, precio_compra: form.precio_compra || null,
          descuento_maximo: form.descuento_maximo || null,
          stock_inicial: form.stock_inicial || "0",
          tipo: "producto",
          codigo_personal: form.codigo_personal,
        }),
      });
      const json = await res.json();
      if (json.error) { setError(json.error); return; }
      const newProd: Producto = {
        id: json.id, nombre: form.nombre, categoria: form.categoria || null,
        codigo_barras: form.codigo_barras || null,
        precio: form.precio ? parseFloat(form.precio) : null,
        precio_compra: form.precio_compra ? parseFloat(form.precio_compra) : null,
        descuento_maximo: form.descuento_maximo ? parseFloat(form.descuento_maximo) : 0,
        foto_url: fotoUrl || null, activo: true,
      };
      setSavedId(json.id);
      onSave({ ...newProd, stock: form.stock_inicial ? parseInt(form.stock_inicial) : 0 });
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-[500px] max-w-[95vw] space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center">
          <h3 className="font-black text-zinc-800 text-lg">➕ Nuevo producto</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-zinc-100 text-zinc-500 text-xl">×</button>
        </div>

        {savedId
          ? <FotoUploader productoId={savedId} fotoUrl={fotoUrl} onUploaded={setFotoUrl} />
          : <p className="text-xs text-zinc-400 bg-zinc-50 rounded-lg px-3 py-2">📷 Podés agregar la foto después usando Editar.</p>
        }

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">Nombre *</label>
            <input value={form.nombre} onChange={(e) => set("nombre", e.target.value)} suppressHydrationWarning
              className="w-full rounded-xl border-2 border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:border-[#f5a623]" />
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">Categoría</label>
            <input value={form.categoria} onChange={(e) => set("categoria", e.target.value)} suppressHydrationWarning
              placeholder="Ej: Librería, Papelería…"
              className="w-full rounded-xl border-2 border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:border-[#f5a623]" />
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">Precio de venta *</label>
            <input type="number" value={form.precio} onChange={(e) => set("precio", e.target.value)} suppressHydrationWarning
              min="0" step="0.01"
              className="w-full rounded-xl border-2 border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:border-[#f5a623]" />
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">Codigo de barras</label>
            <input value={form.codigo_barras} onChange={(e) => set("codigo_barras", e.target.value)} suppressHydrationWarning
              placeholder="Escanea o escribi"
              className="w-full rounded-xl border-2 border-zinc-200 px-3 py-2 text-sm font-mono focus:outline-none focus:border-[#f5a623]" />
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">Precio de compra</label>
            <input type="number" value={form.precio_compra} onChange={(e) => set("precio_compra", e.target.value)} suppressHydrationWarning
              min="0" step="0.01" placeholder="—"
              className="w-full rounded-xl border-2 border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:border-[#f5a623]" />
          </div>
          {esAdmin && (
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">
                Dto. máximo <span className="text-amber-500 normal-case font-normal">(admin)</span>
              </label>
              <div className="relative">
                <input type="number" value={form.descuento_maximo} onChange={(e) => set("descuento_maximo", e.target.value)}
                  suppressHydrationWarning min="0" max="100" step="1" placeholder="0"
                  className="w-full rounded-xl border-2 border-amber-200 bg-amber-50 px-3 py-2 text-sm focus:outline-none focus:border-[#f5a623] pr-8" />
                <span className="absolute right-3 top-2.5 text-sm text-zinc-400">%</span>
              </div>
            </div>
          )}
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">Stock inicial</label>
            <input type="number" value={form.stock_inicial} onChange={(e) => set("stock_inicial", e.target.value)} suppressHydrationWarning
              min="0" placeholder="0"
              className="w-full rounded-xl border-2 border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:border-[#f5a623]" />
          </div>
        </div>
        <p className="text-xs text-zinc-400 -mt-1">
          📦 El stock inicial es el que tenés disponible ahora. Se va descontando automáticamente al registrar ventas.
        </p>

        <div>
          <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">Código de operador *</label>
          <input type="password" value={form.codigo_personal} onChange={(e) => set("codigo_personal", e.target.value)} suppressHydrationWarning
            placeholder="Tu código personal"
            className="w-full rounded-xl border-2 border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:border-[#f5a623]" />
        </div>

        {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={handleSave} disabled={saving || !form.nombre.trim()}
            className="flex-1 py-2.5 rounded-xl bg-[#f5a623] text-[#1a1a2e] font-black text-sm hover:bg-amber-400 disabled:opacity-40 transition">
            {saving ? "Guardando…" : "Crear producto"}
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

// ── Edit Modal ────────────────────────────────────────────────────────────────
function EditModal({ producto, stock, esAdmin, onSave, onClose }: {
  producto: Producto; stock: number;
  esAdmin: boolean;
  onSave: (updated: Producto, stock: number) => void; onClose: () => void;
}) {
  const [form, setForm] = useState({
    nombre: producto.nombre ?? "",
    categoria: producto.categoria ?? "",
    codigo_barras: producto.codigo_barras ?? "",
    precio: producto.precio?.toString() ?? "",
    precio_compra: producto.precio_compra?.toString() ?? "",
    stock: String(stock ?? 0),
    descuento_maximo: producto.descuento_maximo?.toString() ?? "",
  });
  const [fotoUrl, setFotoUrl] = useState(producto.foto_url ?? "");
  const [saving, startSave] = useTransition();
  const [error, setError] = useState<string>();
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = () => {
    startSave(async () => {
      setError(undefined);
      const body: Record<string, unknown> = {
        nombre: form.nombre, categoria: form.categoria || null,
        codigo_barras: form.codigo_barras || null,
        precio: form.precio ? parseFloat(form.precio) : null,
        precio_compra: form.precio_compra ? parseFloat(form.precio_compra) : null,
        stock: form.stock === "" ? 0 : parseInt(form.stock),
        foto_url: fotoUrl || null,
      };
      if (esAdmin) body.descuento_maximo = form.descuento_maximo ? parseFloat(form.descuento_maximo) : null;
      const res = await fetch(`/api/catalogo/productos/${producto.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.error) { setError(json.error); return; }
      onSave({ ...producto, ...body, foto_url: fotoUrl || null } as Producto, parseInt(form.stock) || 0);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-[460px] max-w-[95vw] space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center">
          <h3 className="font-black text-zinc-800 text-lg">Editar producto</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-zinc-100 text-zinc-500 text-xl">×</button>
        </div>

        <FotoUploader productoId={producto.id} fotoUrl={fotoUrl} onUploaded={setFotoUrl} />

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">Nombre *</label>
            <input value={form.nombre} onChange={(e) => set("nombre", e.target.value)} suppressHydrationWarning
              className="w-full rounded-xl border-2 border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:border-[#f5a623]" />
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">Categoría</label>
            <input value={form.categoria} onChange={(e) => set("categoria", e.target.value)} suppressHydrationWarning
              className="w-full rounded-xl border-2 border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:border-[#f5a623]" />
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">Precio de venta</label>
            <input type="number" value={form.precio} onChange={(e) => set("precio", e.target.value)} suppressHydrationWarning
              min="0" step="0.01"
              className="w-full rounded-xl border-2 border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:border-[#f5a623]" />
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">Precio de compra</label>
            <input type="number" value={form.precio_compra} onChange={(e) => set("precio_compra", e.target.value)} suppressHydrationWarning
              min="0" step="0.01"
              className="w-full rounded-xl border-2 border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:border-[#f5a623]" />
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">Stock</label>
            <input type="number" value={form.stock} onChange={(e) => set("stock", e.target.value)} suppressHydrationWarning
              className="w-full rounded-xl border-2 border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:border-[#f5a623]" />
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">Codigo de barras</label>
            <input value={form.codigo_barras} onChange={(e) => set("codigo_barras", e.target.value)} suppressHydrationWarning
              className="w-full rounded-xl border-2 border-zinc-200 px-3 py-2 text-sm font-mono focus:outline-none focus:border-[#f5a623]" />
          </div>
        </div>

        {esAdmin && (
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">
              Dto. máximo <span className="text-amber-500 normal-case font-normal">(admin)</span>
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
export default function ProductosView({ productos: initial, stockMap: initialStock, esAdmin }: {
  productos: Producto[]; stockMap: StockMap; esAdmin: boolean;
}) {
  const [productos, setProductos] = useState<Producto[]>(initial);
  const [stockMap, setStockMap] = useState<StockMap>(initialStock);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [editing, setEditing] = useState<Producto | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Producto | null>(null);
  const [showAgregar, setShowAgregar] = useState(false);
  const [importing, startImport] = useTransition();
  const [importMsg, setImportMsg] = useState<string>();
  const importRef = useRef<HTMLInputElement>(null);
  const [deleting, startDelete] = useTransition();

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

  const handleImport = (file: File) => {
    startImport(async () => {
      setImportMsg(undefined);
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/catalogo/productos/importar-stock-utiles", { method: "POST", body: fd });
      const json = await res.json();
      if (json.error) {
        setImportMsg(json.error);
        return;
      }
      setImportMsg(`Importados: ${json.creados} nuevos, ${json.actualizados} actualizados`);
      window.location.reload();
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-800">Productos</h1>
          <p className="text-xs text-zinc-400 mt-0.5">Artículos de librería y papelería</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400">{filtrados.length} items</span>
          {esAdmin && (
            <>
              <input ref={importRef} type="file" accept=".csv,text/csv" className="hidden"
                onChange={(e) => { if (e.target.files?.[0]) handleImport(e.target.files[0]); }} />
              <button type="button" onClick={() => importRef.current?.click()} disabled={importing}
                className="px-4 py-2 rounded-xl bg-white border border-zinc-300 text-zinc-700 text-sm font-bold hover:bg-zinc-50 disabled:opacity-50 transition">
                {importing ? "Importando..." : "Importar Stock utiles"}
              </button>
            </>
          )}
          {esAdmin && (
            <button type="button" onClick={() => setShowAgregar(true)}
              className="px-4 py-2 rounded-xl bg-[#1a1a2e] text-white text-sm font-bold hover:bg-zinc-700 transition">
              ➕ Agregar producto
            </button>
          )}
        </div>
      </div>
      {importMsg && <p className="text-xs text-zinc-500 bg-zinc-50 rounded-lg px-3 py-2">{importMsg}</p>}

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

      {filtrados.length === 0 ? (
        <p className="text-zinc-400 text-center py-16">Sin productos cargados</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtrados.map((prod) => {
            const stock = stockMap[prod.id];
            return (
              <div key={prod.id} className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden hover:shadow-md transition">
                <div className="h-36 bg-zinc-100 flex items-center justify-center overflow-hidden">
                  {prod.foto_url
                    ? <img src={prod.foto_url} alt={prod.nombre} className="w-full h-full object-cover" />
                    : <span className="text-4xl opacity-30">🛒</span>}
                </div>
                <div className="p-3 space-y-2">
                  <div>
                    <p className="font-bold text-zinc-800 text-sm leading-tight line-clamp-2">{prod.nombre}</p>
                    {prod.categoria && (
                      <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-500 text-xs">{prod.categoria}</span>
                    )}
                    {prod.codigo_barras && <p className="text-[10px] text-zinc-400 font-mono mt-1">{prod.codigo_barras}</p>}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-black text-[#f5a623] text-base">
                      {prod.precio != null ? fmt(prod.precio) : "—"}
                    </span>
                  </div>
                  {esAdmin && prod.descuento_maximo != null && prod.descuento_maximo > 0 && (
                    <span className="text-xs bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full">
                      Dto. máx: {prod.descuento_maximo}%
                    </span>
                  )}
                  {stock != null && (
                    <p className={`text-xs font-semibold ${stock <= 3 ? "text-red-500" : "text-emerald-600"}`}>
                      📦 Stock: {stock}{stock <= 3 && stock > 0 ? " ⚠️" : stock <= 0 ? " — sin stock" : ""}
                    </p>
                  )}
                  {esAdmin && (
                    <div className="flex gap-2 pt-1 border-t border-zinc-100">
                      <button type="button" onClick={() => setEditing(prod)}
                        className="flex-1 py-1.5 rounded-lg bg-zinc-100 text-zinc-600 text-xs font-semibold hover:bg-zinc-200 transition">
                        ✏️ Editar
                      </button>
                      <button type="button" onClick={() => setConfirmDelete(prod)}
                        className="px-3 py-1.5 rounded-lg bg-red-50 text-red-500 text-xs font-semibold hover:bg-red-100 transition">
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

      {showAgregar && (
        <AgregarModal
          esAdmin={esAdmin}
          onSave={(prod) => {
            const { stock, ...p } = prod;
            setProductos((prev) => [p, ...prev]);
            setStockMap((prev) => ({ ...prev, [p.id]: stock }));
            setShowAgregar(false);
          }}
          onClose={() => setShowAgregar(false)}
        />
      )}

      {editing && (
        <EditModal producto={editing} stock={stockMap[editing.id] ?? 0} esAdmin={esAdmin}
          onSave={(updated, stock) => {
            setProductos((prev) => prev.map((p) => p.id === updated.id ? updated : p));
            setStockMap((prev) => ({ ...prev, [updated.id]: stock }));
            setEditing(null);
          }}
          onClose={() => setEditing(null)}
        />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmDelete(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-[360px] space-y-4">
            <h3 className="font-black text-zinc-800">¿Eliminar producto?</h3>
            <p className="text-sm text-zinc-600"><span className="font-semibold">{confirmDelete.nombre}</span> quedará inactivo.</p>
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
