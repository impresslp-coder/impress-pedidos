"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { registrarVenta, type ItemVentaInput } from "./actions";

type Producto = {
  id: string;
  nombre: string;
  categoria?: string | null;
  codigo_barras?: string | null;
  precio?: number | null;
  descuento_maximo?: number | null;
  foto_url?: string | null;
};

type Sucursal = {
  id: string;
  nombre: string;
};

type CartItem = ItemVentaInput & {
  _key: number;
  descuento_max: number;
  stockeable: boolean;
};

type PapelTramo = { desde: number; hasta: number; precio: number };
type Papel = { nombre: string; tramos: PapelTramo[] };
type PresetImpresion = { nombre: string; hojas: number; papel: string; precioUnitario: number };
type Faz = "simple" | "doble";
type PagPorHoja = 1 | 2 | 4;

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(n);

const contarPaginasPDF = async (file: File): Promise<number> => {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let text = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    text += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return Math.max(text.match(/\/Type\s*\/Page\b/g)?.length ?? 0, 1);
};

const calcSubtotal = (item: CartItem): number => {
  const base = (item.precio_venta ?? 0) * item.cantidad;
  return Math.round(base * (1 - item.descuento_pct / 100));
};

const parsePapeles = (raw?: string): Papel[] => {
  const source = raw ?? "Comun:1-10=80;11-50=60;51-9999=45,Opalina:1-10=140;11-50=120;51-9999=100,Fotografico:1-9999=180";
  const byName = new Map<string, Papel>();
  let currentName = "";

  const addTramo = (nombre: string, tramoRaw: string) => {
    const cleanName = nombre.trim();
    const cleanTramo = tramoRaw.trim();
    if (!cleanName || !cleanTramo) return;

    const tramosRaw = cleanTramo.includes("=") ? cleanTramo.split(";") : [`1-999999=${cleanTramo}`];
    const tramos = tramosRaw.map((tramo) => {
      const [rango, precioRaw] = tramo.split("=");
      const [desdeRaw, hastaRaw] = (rango ?? "").split("-");
      return {
        desde: parseInt(desdeRaw) || 1,
        hasta: parseInt(hastaRaw) || 999999,
        precio: parseFloat(precioRaw) || 0,
      };
    }).filter((t) => t.precio > 0);

    if (!tramos.length) return;
    const existing = byName.get(cleanName);
    if (existing) {
      existing.tramos.push(...tramos);
    } else {
      byName.set(cleanName, { nombre: cleanName, tramos });
    }
  };

  for (const part of source.split(",")) {
    const token = part.trim();
    if (!token) continue;
    const colon = token.indexOf(":");
    if (colon >= 0) {
      currentName = token.slice(0, colon).trim();
      addTramo(currentName, token.slice(colon + 1));
    } else if (currentName) {
      addTramo(currentName, token);
    }
  }

  const parsed = Array.from(byName.values()).map((papel) => ({
    ...papel,
    tramos: papel.tramos.sort((a, b) => a.desde - b.desde),
  }));

  return parsed.length ? parsed : [{ nombre: "Comun", tramos: [{ desde: 1, hasta: 999999, precio: 50 }] }];
};

const precioPapelPorHojas = (papel: Papel | undefined, hojas: number) => {
  if (!papel) return 0;
  const tramo = papel.tramos.find((t) => hojas >= t.desde && hojas <= t.hasta)
    ?? papel.tramos[papel.tramos.length - 1];
  return tramo?.precio ?? 0;
};

const parsePresets = (raw: string | undefined, papeles: Papel[]): PresetImpresion[] => {
  const fallbackPapel = papeles[0]?.nombre ?? "Comun";
  const fallbackPrecio = precioPapelPorHojas(papeles[0], 1);
  const fallback = [{ nombre: "Documento", hojas: 1, papel: fallbackPapel, precioUnitario: fallbackPrecio }];
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return fallback;
    const presets = parsed.map((item) => ({
      nombre: String(item.nombre || "Documento"),
      hojas: Math.max(1, Number(item.hojas) || 1),
      papel: String(item.papel || fallbackPapel),
      precioUnitario: Math.max(0, Number(item.precioUnitario) || 0),
    })).filter((item) => item.nombre);
    return presets.length ? presets : fallback;
  } catch {
    return fallback;
  }
};

const calcularHojasArchivo = (paginas: number, pagPorHoja: PagPorHoja, faz: Faz) => {
  if (paginas === 2 && pagPorHoja === 1) return 1;
  const caras = Math.ceil(paginas / pagPorHoja);
  return faz === "doble" ? Math.ceil(caras / 2) : caras;
};

export default function VentasForm({
  productos, topIds, stockMap, config, sucursales,
}: {
  productos: Producto[];
  topIds: string[];
  stockMap: Record<string, number>;
  config: Record<string, string>;
  sucursales: Sucursal[];
}) {
  const [codigo, setCodigo] = useState("");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [items, setItems] = useState<CartItem[]>([]);
  const [nextKey, setNextKey] = useState(0);
  const [stockLocal, setStockLocal] = useState<Record<string, number>>(stockMap);
  const [medioPago, setMedioPago] = useState("efectivo");
  const [sucursal, setSucursal] = useState(sucursales[0]?.nombre ?? "");
  const [codigoPersonal, setCodigoPersonal] = useState("");
  const [isPending, startTransition] = useTransition();
  const [ventaOk, setVentaOk] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const codigoRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);

  const papeles = parsePapeles(config.ventas_tipos_papel);
  const [papel, setPapel] = useState(papeles[0]?.nombre ?? "Comun");
  const [faz, setFaz] = useState<Faz>("simple");
  const [pagPorHoja, setPagPorHoja] = useState<PagPorHoja>(1);
  const [copias, setCopias] = useState(1);
  const [pdfs, setPdfs] = useState<{ name: string; paginas: number }[]>([]);
  const [contando, setContando] = useState(false);
  const presetsImpresion = parsePresets(config.ventas_presets_impresion, papeles);
  const [manualHojas, setManualHojas] = useState(1);
  const [manualPapel, setManualPapel] = useState(papeles[0]?.nombre ?? "Comun");
  const [manualPrecioUnitario, setManualPrecioUnitario] = useState(() => precioPapelPorHojas(papeles[0], 1));

  useEffect(() => { codigoRef.current?.focus(); }, []);

  const categorias = [...new Set(productos.map((p) => p.categoria).filter(Boolean))] as string[];

  const busquedaActiva = !!q.trim() || !!cat;
  const topProductos = topIds
    .map((id) => productos.find((p) => p.id === id))
    .filter(Boolean) as Producto[];
  const productosIniciales = topProductos.length > 0 ? topProductos : productos.slice(0, 20);

  const filtrados = busquedaActiva ? productos.filter((p) => {
    if (cat && p.categoria !== cat) return false;
    if (q && !p.nombre.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }).slice(0, 40) : productosIniciales;

  const agregarProducto = (prod: Producto) => {
    const stockDisp = stockLocal[prod.id] ?? 0;
    if (stockDisp <= 0) {
      setError("Producto sin stock");
      return;
    }
    const existe = items.find((i) => i.producto_id === prod.id);
    if (existe) {
      setItems((prev) => prev.map((i) =>
        i.producto_id === prod.id ? { ...i, cantidad: Math.min(i.cantidad + 1, stockDisp) } : i
      ));
    } else {
      setItems((prev) => [
        ...prev,
        {
          _key: nextKey,
          producto_id: prod.id,
          producto_nombre: prod.nombre,
          precio_venta: prod.precio ?? 0,
          cantidad: 1,
          descuento_pct: 0,
          descuento_max: prod.descuento_maximo ?? 0,
          stockeable: true,
        },
      ]);
      setNextKey((k) => k + 1);
    }
    setCodigo("");
    setQ("");
    setError(undefined);
    codigoRef.current?.focus();
  };

  const buscarPorCodigo = () => {
    const valor = codigo.trim();
    if (!valor) return;
    const prod = productos.find((p) => p.codigo_barras?.trim() === valor);
    if (!prod) {
      setError(`No hay producto con codigo ${valor}`);
      setCodigo("");
      codigoRef.current?.focus();
      return;
    }
    agregarProducto(prod);
  };

  const updateItem = (key: number, changes: Partial<CartItem>) =>
    setItems((prev) => prev.map((i) => i._key === key ? { ...i, ...changes } : i));

  const removeItem = (key: number) =>
    setItems((prev) => prev.filter((i) => i._key !== key));

  const totalPaginas = pdfs.reduce((acc, p) => acc + p.paginas, 0);
  const hojasPorCopia = pdfs.reduce(
    (acc, p) => acc + calcularHojasArchivo(p.paginas, pagPorHoja, faz),
    0,
  );
  const hojas = hojasPorCopia * copias;
  const papelSel = papeles.find((p) => p.nombre === papel) ?? papeles[0];
  const precioHoja = precioPapelPorHojas(papelSel, hojas);
  const totalImpresion = Math.round(hojas * precioHoja);
  const totalManual = Math.round(manualHojas * manualPrecioUnitario);

  const aplicarPreset = (preset: PresetImpresion) => {
    setManualHojas(preset.hojas);
    setManualPapel(preset.papel);
    setManualPrecioUnitario(preset.precioUnitario);
  };

  const agregarManual = () => {
    if (manualHojas <= 0 || totalManual <= 0) return;
    setItems((prev) => [
      ...prev,
      {
        _key: nextKey,
        producto_id: null,
        producto_nombre: `Documento (${manualHojas} hojas - ${manualPapel})`,
        precio_venta: totalManual,
        cantidad: 1,
        descuento_pct: 0,
        descuento_max: 0,
        stockeable: false,
      },
    ]);
    setNextKey((k) => k + 1);
    codigoRef.current?.focus();
  };

  const handlePDFs = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setContando(true);
    const conteos = await Promise.all(files.map(async (file) => ({
      name: file.name,
      paginas: await contarPaginasPDF(file),
    })));
    setPdfs((prev) => [...prev, ...conteos]);
    setContando(false);
    if (pdfRef.current) pdfRef.current.value = "";
  };

  const agregarImpresion = () => {
    if (!totalPaginas || totalImpresion <= 0) return;
    const desc = [
      `${totalPaginas} pag`,
      `${copias} copia${copias > 1 ? "s" : ""}`,
      `${hojas} hojas`,
      faz === "doble" ? "doble faz" : "simple faz",
      `${pagPorHoja} p/hoja`,
      papel,
    ].filter(Boolean).join(" - ");
    setItems((prev) => [
      ...prev,
      {
        _key: nextKey,
        producto_id: null,
        producto_nombre: `Impresion PDF (${desc})`,
        precio_venta: totalImpresion,
        cantidad: 1,
        descuento_pct: 0,
        descuento_max: 0,
        stockeable: false,
      },
    ]);
    setNextKey((k) => k + 1);
    setPdfs([]);
    codigoRef.current?.focus();
  };

  const total = items.reduce((acc, i) => acc + calcSubtotal(i), 0);

  const handleVenta = () => {
    if (!items.length) { setError("Agrega productos al carrito"); return; }
    if (!codigoPersonal.trim()) { setError("Ingresa tu codigo de operador"); return; }
    setError(undefined);
    const fd = new FormData();
    fd.set("medio_pago", medioPago);
    fd.set("sucursal", sucursal);
    fd.set("codigo_personal", codigoPersonal);
    fd.set("items", JSON.stringify(items.map(({ _key, descuento_max, stockeable, ...rest }) => rest)));
    startTransition(() => {
      registrarVenta(fd).then((res) => {
        if (res?.error) {
          setError(res.error);
        } else if (res?.ok) {
          for (const item of items) {
            if (!item.producto_id || !item.stockeable) continue;
            setStockLocal((prev) => ({
              ...prev,
              [item.producto_id!]: Math.max(0, (prev[item.producto_id!] ?? 0) - item.cantidad),
            }));
          }
          setVentaOk(res.numero!);
          setItems([]);
          setCodigoPersonal("");
        }
      });
    });
  };

  const resetVenta = () => { setVentaOk(null); codigoRef.current?.focus(); };

  if (ventaOk) {
    return (
      <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-10 text-center space-y-4">
        <h2 className="text-2xl font-black text-emerald-600">Venta registrada</h2>
        <p className="text-zinc-500">
          Venta <span className="font-mono font-bold text-[#1a1a2e]">#{ventaOk}</span> guardada correctamente.
        </p>
        <button type="button" onClick={resetVenta}
          className="mt-2 px-8 py-3 rounded-md bg-[#f5a623] text-[#1a1a2e] font-black text-sm hover:bg-amber-400 transition">
          Nueva venta
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(180px,240px)_1fr] gap-4 items-end">
        <div>
          <h1 className="text-2xl font-bold text-zinc-800">Ventas</h1>
          <p className="text-xs text-zinc-400 mt-0.5">Punto de venta</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[220px_1fr_210px_180px] gap-2">
          <input
            ref={codigoRef}
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") buscarPorCodigo(); }}
            placeholder="Codigo de barras"
            suppressHydrationWarning
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:border-[#f5a623] focus:ring-1 focus:ring-[#f5a623]"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre del articulo"
            suppressHydrationWarning
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:border-[#f5a623] focus:ring-1 focus:ring-[#f5a623]"
          />
          <select value={cat} onChange={(e) => setCat(e.target.value)}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:border-[#f5a623]">
            <option value="">Todas las categorias</option>
            {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={sucursal} onChange={(e) => setSucursal(e.target.value)}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:border-[#f5a623]">
            {sucursales.length === 0 ? (
              <option value="">Sin sucursal</option>
            ) : (
              sucursales.map((s) => <option key={s.id} value={s.nombre}>{s.nombre}</option>)
            )}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
      <div className="xl:col-span-3 space-y-4">
        <div className="bg-white rounded-md border border-zinc-200 p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-zinc-800">Contador de PDFs</h2>
            <button type="button" onClick={() => pdfRef.current?.click()}
              className="px-3 py-2 rounded-md bg-[#1a1a2e] text-white text-xs font-bold hover:bg-zinc-800">
              Cargar PDFs
            </button>
            <input ref={pdfRef} type="file" accept="application/pdf" multiple className="hidden" onChange={handlePDFs} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <label className="grid gap-1 text-[11px] font-bold uppercase tracking-wide text-zinc-500">
              Faz
              <select value={faz} onChange={(e) => setFaz(e.target.value as Faz)}
                className="rounded-md border border-zinc-300 px-2 py-2 text-sm normal-case font-normal tracking-normal text-zinc-900">
                <option value="simple">Simple faz</option>
                <option value="doble">Doble faz</option>
              </select>
            </label>
            <label className="grid gap-1 text-[11px] font-bold uppercase tracking-wide text-zinc-500">
              Pag/hoja
              <select value={pagPorHoja} onChange={(e) => setPagPorHoja(parseInt(e.target.value) as PagPorHoja)}
                className="rounded-md border border-zinc-300 px-2 py-2 text-sm normal-case font-normal tracking-normal text-zinc-900">
                <option value="1">1 pag/hoja</option>
                <option value="2">2 pag/hoja</option>
                <option value="4">4 pag/hoja</option>
              </select>
            </label>
            <label className="grid gap-1 text-[11px] font-bold uppercase tracking-wide text-zinc-500">
              Tipo papel
              <select value={papel} onChange={(e) => setPapel(e.target.value)}
                className="rounded-md border border-zinc-300 px-2 py-2 text-sm normal-case font-normal tracking-normal text-zinc-900">
                {papeles.map((p) => <option key={p.nombre} value={p.nombre}>{p.nombre}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-[11px] font-bold uppercase tracking-wide text-zinc-500">
              Copias
              <input
                type="number"
                min="1"
                value={copias}
                onChange={(e) => setCopias(Math.max(1, parseInt(e.target.value) || 1))}
                suppressHydrationWarning
                className="rounded-md border border-zinc-300 px-2 py-2 text-sm normal-case font-normal tracking-normal text-zinc-900"
              />
            </label>
          </div>
          {pdfs.length > 0 && (
            <div className="rounded-md bg-zinc-50 border border-zinc-200 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-semibold text-zinc-700">{totalPaginas} paginas</span>
                <span className="text-zinc-400">/</span>
                <span className="font-semibold text-zinc-700">{copias} copia{copias > 1 ? "s" : ""}</span>
                <span className="text-zinc-400">/</span>
                <span className="font-semibold text-zinc-700">{hojasPorCopia} hojas c/u</span>
                <span className="text-zinc-400">/</span>
                <span className="font-semibold text-zinc-700">{hojas} hojas total</span>
                <span className="text-zinc-400">/</span>
                <span className="font-semibold text-zinc-700">{fmt(precioHoja)} c/hoja</span>
                <span className="ml-auto font-black text-[#f5a623]">{fmt(totalImpresion)}</span>
                <button type="button" onClick={agregarImpresion}
                  className="px-3 py-1.5 rounded-md bg-[#f5a623] text-[#1a1a2e] text-xs font-black">
                  Agregar al carrito
                </button>
              </div>
              <ul className="mt-2 text-xs text-zinc-500 space-y-1">
                {pdfs.map((p) => (
                  <li key={p.name}>
                    {p.name} - {p.paginas} pag - {calcularHojasArchivo(p.paginas, pagPorHoja, faz)} hojas
                  </li>
                ))}
              </ul>
            </div>
          )}
          {contando && <p className="text-xs text-zinc-400">Contando paginas...</p>}
        </div>

        <div className="bg-white rounded-md border border-zinc-200 p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-zinc-800">Carga rapida de hojas</h2>
              <p className="text-xs text-zinc-400 mt-0.5">Precio editable en vivo, sin abrir otra ventana.</p>
            </div>
            <button type="button" onClick={agregarManual}
              className="px-3 py-2 rounded-md bg-[#1a1a2e] text-white text-xs font-bold hover:bg-zinc-800">
              Agregar
            </button>
          </div>
          {presetsImpresion.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {presetsImpresion.map((preset) => (
                <button key={`${preset.nombre}-${preset.hojas}-${preset.papel}`} type="button" onClick={() => aplicarPreset(preset)}
                  className="px-3 py-1.5 rounded-full border border-amber-300 bg-amber-50 text-[#1a1a2e] text-xs font-black hover:bg-amber-100">
                  {preset.nombre}
                </button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <label className="grid gap-1 text-[11px] font-bold uppercase tracking-wide text-zinc-500">
              Canti de hojas
              <input type="number" min="1" value={manualHojas}
                onChange={(e) => setManualHojas(Math.max(1, parseInt(e.target.value) || 1))}
                className="rounded-md border border-zinc-300 px-2 py-2 text-sm normal-case font-normal tracking-normal text-zinc-900" />
            </label>
            <label className="grid gap-1 text-[11px] font-bold uppercase tracking-wide text-zinc-500">
              Tipo de papel
              <select value={manualPapel}
                onChange={(e) => {
                  const nextPaper = e.target.value;
                  setManualPapel(nextPaper);
                  setManualPrecioUnitario(precioPapelPorHojas(papeles.find((p) => p.nombre === nextPaper), manualHojas));
                }}
                className="rounded-md border border-zinc-300 px-2 py-2 text-sm normal-case font-normal tracking-normal text-zinc-900">
                {papeles.map((p) => <option key={p.nombre} value={p.nombre}>{p.nombre}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-[11px] font-bold uppercase tracking-wide text-zinc-500">
              Precio c/hoja
              <input type="number" min="0" step="0.01" value={manualPrecioUnitario}
                onChange={(e) => setManualPrecioUnitario(Math.max(0, parseFloat(e.target.value) || 0))}
                className="rounded-md border border-zinc-300 px-2 py-2 text-sm normal-case font-normal tracking-normal text-zinc-900" />
            </label>
            <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">Precio</p>
              <p className="text-lg font-black text-[#f5a623]">{fmt(totalManual)}</p>
            </div>
          </div>
        </div>

        {filtrados.length === 0 ? (
          <div className="text-center py-16 text-zinc-400 text-sm">
            {busquedaActiva ? `Sin resultados para "${q || cat}"` : "Sin productos vendidos aun. Busca por nombre para agregarlos."}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filtrados.map((prod) => {
              const stock = stockLocal[prod.id] ?? 0;
              const sinStock = stock <= 0;
              const enCarrito = items.find((i) => i.producto_id === prod.id);
              return (
                <button
                  key={prod.id}
                  type="button"
                  onClick={() => agregarProducto(prod)}
                  disabled={sinStock}
                  className={[
                    "relative rounded-md border text-left overflow-hidden transition bg-white",
                    sinStock ? "opacity-40 cursor-not-allowed border-zinc-100" : "border-zinc-200 hover:border-[#f5a623] hover:shadow-sm cursor-pointer",
                    enCarrito ? "ring-2 ring-[#f5a623] border-[#f5a623]" : "",
                  ].join(" ")}
                >
                  <div className="h-24 bg-zinc-100 flex items-center justify-center overflow-hidden">
                    {prod.foto_url
                      ? <img src={prod.foto_url} alt={prod.nombre} className="w-full h-full object-cover" />
                      : <span className="text-3xl opacity-30">&#128722;</span>}
                  </div>
                  <div className="p-2.5 space-y-1">
                    <p className="font-semibold text-zinc-800 text-xs leading-tight line-clamp-2">{prod.nombre}</p>
                    <div className="flex items-center justify-between">
                      <span className="font-black text-[#f5a623] text-sm">
                        {prod.precio != null ? fmt(prod.precio) : "-"}
                      </span>
                      <span className={`text-xs font-bold ${stock <= 3 && stock > 0 ? "text-amber-500" : sinStock ? "text-red-500" : "text-emerald-600"}`}>
                        {sinStock ? "Sin stock" : `x${stock}`}
                      </span>
                    </div>
                    {prod.codigo_barras && <p className="text-[10px] text-zinc-400 font-mono">{prod.codigo_barras}</p>}
                  </div>
                  {enCarrito && (
                    <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-[#f5a623] rounded-full text-[#1a1a2e] text-xs font-black flex items-center justify-center">
                      {enCarrito.cantidad}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="xl:col-span-2">
        <div className="bg-white rounded-md border border-zinc-200 shadow-sm p-5 space-y-4 sticky top-4">
          <h2 className="font-black text-zinc-800 text-base flex items-center gap-2">
            Carrito
            {items.length > 0 && (
              <span className="text-xs font-bold bg-[#f5a623] text-[#1a1a2e] px-2 py-0.5 rounded-full ml-auto">
                {items.reduce((a, i) => a + i.cantidad, 0)} items
              </span>
            )}
          </h2>

          {items.length === 0 ? (
            <p className="text-zinc-400 text-sm text-center py-8">Escanea un codigo o toca un producto</p>
          ) : (
            <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
              {items.map((item) => (
                <div key={item._key} className="bg-zinc-50 rounded-md p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-zinc-800 text-sm leading-tight flex-1">{item.producto_nombre}</p>
                    <button type="button" onClick={() => removeItem(item._key)}
                      className="text-red-400 hover:text-red-600 text-lg leading-none shrink-0">x</button>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <button type="button"
                        onClick={() => {
                          if (item.cantidad <= 1) removeItem(item._key);
                          else updateItem(item._key, { cantidad: item.cantidad - 1 });
                        }}
                        className="w-7 h-7 rounded-md bg-white border border-zinc-200 hover:bg-zinc-100 text-sm font-black flex items-center justify-center">
                        -
                      </button>
                      <span className="w-7 text-center font-black text-sm">{item.cantidad}</span>
                      <button type="button"
                        onClick={() => updateItem(item._key, { cantidad: item.cantidad + 1 })}
                        className="w-7 h-7 rounded-md bg-white border border-zinc-200 hover:bg-zinc-100 text-sm font-black flex items-center justify-center">
                        +
                      </button>
                    </div>
                    {item.descuento_max > 0 && (
                      <div className="flex items-center gap-1 ml-auto">
                        <span className="text-xs text-zinc-400">Dto.</span>
                        <input
                          type="number"
                          value={item.descuento_pct || ""}
                          onChange={(e) => {
                            const v = Math.min(item.descuento_max, Math.max(0, parseInt(e.target.value) || 0));
                            updateItem(item._key, { descuento_pct: v });
                          }}
                          suppressHydrationWarning
                          min="0" max={item.descuento_max}
                          placeholder="0"
                          className="w-12 text-center rounded-md border border-zinc-300 px-1 py-0.5 text-xs focus:outline-none focus:border-[#f5a623]"
                        />
                        <span className="text-xs text-zinc-400">%</span>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-between items-center text-xs text-zinc-500">
                    <span>{fmt(item.precio_venta ?? 0)} c/u{item.descuento_pct > 0 ? ` - ${item.descuento_pct}%` : ""}</span>
                    <span className="font-black text-sm text-zinc-800">{fmt(calcSubtotal(item))}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {items.length > 0 && (
            <div className="flex justify-between items-center border-t pt-3">
              <span className="font-black text-zinc-700">TOTAL</span>
              <span className="font-black text-2xl text-[#f5a623]">{fmt(total)}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">Medio de pago</label>
            <select value={medioPago} onChange={(e) => setMedioPago(e.target.value)}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:border-[#f5a623]">
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
              <option value="debito">Debito</option>
              <option value="credito">Credito</option>
              <option value="qr">QR / Mercado Pago</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">Codigo de operador</label>
            <input
              type="password"
              value={codigoPersonal}
              onChange={(e) => setCodigoPersonal(e.target.value)}
              suppressHydrationWarning
              placeholder="Tu codigo personal"
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:border-[#f5a623]"
            />
          </div>
          {error && <p className="text-xs text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>}
          <button
            type="button"
            onClick={handleVenta}
            disabled={isPending || !items.length}
            className="w-full py-3 rounded-md bg-[#f5a623] text-[#1a1a2e] font-black text-sm hover:bg-amber-400 disabled:opacity-40 transition"
          >
            {isPending ? "Registrando..." : "Confirmar venta"}
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}
