"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";

const PROVEEDORES = [".graph", "Linknot", "Externo"] as const;
type Proveedor = (typeof PROVEEDORES)[number];

const NOTAS: Record<Proveedor, string> = {
  ".graph":  "Se enviará por WhatsApp o Mail. El mensaje se genera automáticamente.",
  "Linknot": "Operar directamente en la plataforma web de Linknot. El mensaje es de referencia.",
  "Externo": "Requiere envío de muestra física. El mensaje es de referencia interna.",
};

type ConfigProveedor = {
  id: string;
  proveedor: string;
  precio_base: number;
  porcentaje: number;
};

type FormState = {
  cliente:   string;
  telefono:  string;
  item:      string;
  cantidad:  string;
  anotacion: string;
  proveedor: Proveedor;
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
  proveedor: ".graph",
  total:     "",
  senia:     "0",
  sucursal:  "",
};

type Resultado = {
  id:        string;
  numero:    string;
  mensaje:   string;
  telefono:  string;
  proveedor: Proveedor;
};

const inputCls =
  "w-full rounded-xl border-2 border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:border-amber-400 transition";

export default function NuevoTerciarizadoPage() {
  const router = useRouter();
  const [form, setForm]           = useState<FormState>(FORM_INICIAL);
  const [configs, setConfigs]     = useState<ConfigProveedor[]>([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [copiado, setCopiado]     = useState(false);

  // Cargar configs de proveedores al montar
  useEffect(() => {
    fetch("/api/admin/proveedores")
      .then((r) => r.json())
      .then((json) => {
        if (json.configs) setConfigs(json.configs);
      })
      .catch(() => {/* sin config, el campo total queda manual */});
  }, []);

  // Auto-calcular total cuando cambia el proveedor
  useEffect(() => {
    const cfg = configs.find((c) => c.proveedor === form.proveedor);
    if (cfg) {
      const calculado = (cfg.precio_base * (cfg.porcentaje / 100)).toFixed(2);
      setForm((f) => ({ ...f, total: calculado }));
    }
  }, [form.proveedor, configs]);

  const set = (k: keyof FormState, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/terciarizados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
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

            {resultado.proveedor === ".graph" && resultado.telefono && (
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

        {/* Proveedor — va antes del ítem para que el total se calcule primero */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            Proveedor <span className="text-red-500">*</span>
          </label>
          <select
            value={form.proveedor}
            onChange={(e) => set("proveedor", e.target.value as Proveedor)}
            className="w-full rounded-xl border-2 border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:border-amber-400 transition bg-white"
          >
            {PROVEEDORES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-zinc-500 bg-zinc-50 rounded-lg px-3 py-2 border border-zinc-100">
            {NOTAS[form.proveedor]}
          </p>
        </div>

        {/* Ítem */}
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
          <p className="mt-1 text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-1.5 border border-amber-100">
            📋 Catálogo de productos disponible próximamente — por ahora escribí libremente.
          </p>
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
              {configs.find((c) => c.proveedor === form.proveedor) && (
                <span className="ml-1 text-xs font-normal text-zinc-400">(calculado automáticamente)</span>
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
          disabled={loading}
          className="w-full py-2.5 rounded-xl font-semibold text-sm disabled:opacity-60 transition"
          style={{ backgroundColor: "#f5a623", color: "#1a1a2e" }}
        >
          {loading ? "Guardando..." : "Guardar encargo"}
        </button>
      </form>
    </div>
  );
}
