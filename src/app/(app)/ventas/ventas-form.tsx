"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import CotizadorView, { type ItemDesdeCotizador } from "../cotizador/cotizador-view";
import { guardarPresupuestoDesdeVenta, registrarVenta, type ItemVentaInput } from "./actions";

type Producto = {
  id: string;
  nombre: string;
  categoria?: string | null;
  codigo_barras?: string | null;
  precio?: number | null;
  precio_lista?: number | null;
  descuento_registrado_pct?: number | null;
  descuento_maximo?: number | null;
  foto_url?: string | null;
  tipo?: string | null;
  es_servicio?: boolean | null;
};

type Sucursal = {
  id: string;
  nombre: string;
};

type Cliente = { id: string; nombre: string };
type PresupuestoPendiente = {
  id: string;
  numero: string;
  total: number | null;
  fecha_vencimiento: string | null;
  cliente_id: string | null;
  clientes: { nombre: string } | { nombre: string }[] | null;
  items_presupuesto: {
    producto_id: string | null;
    producto: string;
    precio: number | null;
    descuento: number | null;
    unidades: number | null;
  }[] | null;
};

type CartItem = ItemVentaInput & {
  _key: number;
  descuento_max: number;
  stockeable: boolean;
};

type Faz = "simple" | "doble";
type PagPorHoja = 1 | 2 | 4;
type PapelCodigo = "comun" | "fotografico" | "chambril";
type CotizacionImpresion = { hojas: number; papel: PapelCodigo; total: number };
const PAPELES: { codigo: PapelCodigo; nombre: string }[] = [
  { codigo: "comun", nombre: "Común" },
  { codigo: "fotografico", nombre: "Fotográfico" },
  { codigo: "chambril", nombre: "Chambril" },
];

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

const calcularHojasArchivo = (paginas: number, pagPorHoja: PagPorHoja, faz: Faz) => {
  if (paginas === 2 && pagPorHoja === 1) return 1;
  const caras = Math.ceil(paginas / pagPorHoja);
  return faz === "doble" ? Math.ceil(caras / 2) : caras;
};

export default function VentasForm({
  productos, topIds, stockMap, sucursales, clientes, presupuestosPendientes,
}: {
  productos: Producto[];
  topIds: string[];
  stockMap: Record<string, number>;
  sucursales: Sucursal[];
  clientes: Cliente[];
  presupuestosPendientes: PresupuestoPendiente[];
}) {
  const router = useRouter();
  const [codigo, setCodigo] = useState("");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [items, setItems] = useState<CartItem[]>([]);
  const [nextKey, setNextKey] = useState(0);
  const [stockLocal, setStockLocal] = useState<Record<string, number>>(stockMap);
  const [medioPago, setMedioPago] = useState("efectivo");
  const sucursalGuardada = typeof window !== "undefined"
    ? (localStorage.getItem("impress_sucursal_activa") ?? "")
    : "";
  const [sucursal, setSucursal] = useState(sucursalGuardada || sucursales[0]?.nombre || "");
  const [codigoPersonal, setCodigoPersonal] = useState("");
  const [isPending, startTransition] = useTransition();
  const [ventaOk, setVentaOk] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [modo, setModo] = useState<"venta" | "cotizar" | "presupuestos">("venta");
  const [clienteId, setClienteId] = useState("");
  const [presupuestoActivo, setPresupuestoActivo] = useState<{ id: string; numero: string } | null>(null);
  const [presupuestoOk, setPresupuestoOk] = useState<string | null>(null);
  const codigoRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);

  const [papel, setPapel] = useState<PapelCodigo>("comun");
  const [faz, setFaz] = useState<Faz>("simple");
  const [pagPorHoja, setPagPorHoja] = useState<PagPorHoja>(1);
  const [copias, setCopias] = useState(1);
  const [pdfs, setPdfs] = useState<{ name: string; paginas: number }[]>([]);
  const [contando, setContando] = useState(false);
  const [manualHojas, setManualHojas] = useState(1);
  const [manualPapel, setManualPapel] = useState<PapelCodigo>("comun");
  const [cotizacionPdf, setCotizacionPdf] = useState<CotizacionImpresion | null>(null);
  const [cotizacionManual, setCotizacionManual] = useState<CotizacionImpresion | null>(null);
  const [cotizandoPdf, setCotizandoPdf] = useState(false);
  const [cotizandoManual, setCotizandoManual] = useState(false);

  useEffect(() => { codigoRef.current?.focus(); }, []);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("modo") === "cotizar") setModo("cotizar");
  }, []);

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
    const stockeable = prod.tipo === "producto" && !prod.es_servicio;
    const stockDisp = stockLocal[prod.id] ?? 0;
    if (stockeable && stockDisp <= 0) {
      setError("Producto sin stock");
      return;
    }
    const existe = items.find((i) => i.producto_id === prod.id);
    if (existe) {
      setItems((prev) => prev.map((i) =>
        i.producto_id === prod.id
          ? { ...i, cantidad: stockeable ? Math.min(i.cantidad + 1, stockDisp) : i.cantidad + 1 }
          : i,
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
        stockeable,
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
  const cotizarImpresion = async (cantidadHojas: number, tipoPapel: PapelCodigo) => {
    const response = await fetch("/api/precios/impresion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hojas: cantidadHojas, papel: tipoPapel }),
    });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error ?? "No se pudo cotizar la impresión.");
    return json as CotizacionImpresion;
  };
  useEffect(() => {
    let vigente = true;
    if (!hojas) { setCotizacionPdf(null); return; }
    setCotizacionPdf(null);
    setCotizandoPdf(true);
    cotizarImpresion(hojas, papel).then((data) => vigente && setCotizacionPdf(data)).catch((e) => vigente && setError(e.message)).finally(() => vigente && setCotizandoPdf(false));
    return () => { vigente = false; };
  }, [hojas, papel]);
  useEffect(() => {
    let vigente = true;
    setCotizacionManual(null);
    setCotizandoManual(true);
    cotizarImpresion(manualHojas, manualPapel).then((data) => vigente && setCotizacionManual(data)).catch((e) => vigente && setError(e.message)).finally(() => vigente && setCotizandoManual(false));
    return () => { vigente = false; };
  }, [manualHojas, manualPapel]);
  const totalImpresion = cotizacionPdf?.total ?? 0;
  const totalManual = cotizacionManual?.total ?? 0;

  const agregarManual = () => {
    if (manualHojas <= 0 || !cotizacionManual || totalManual <= 0) return;
    const nombrePapel = PAPELES.find((item) => item.codigo === manualPapel)?.nombre ?? manualPapel;
    setItems((prev) => [
      ...prev,
      {
        _key: nextKey,
        producto_id: null,
        producto_nombre: `Documento (${manualHojas} hojas - ${nombrePapel})`,
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
    if (!totalPaginas || !cotizacionPdf || totalImpresion <= 0) return;
    const nombrePapel = PAPELES.find((item) => item.codigo === papel)?.nombre ?? papel;
    const desc = [
      `${totalPaginas} pag`,
      `${copias} copia${copias > 1 ? "s" : ""}`,
      `${hojas} hojas`,
      faz === "doble" ? "doble faz" : "simple faz",
      `${pagPorHoja} p/hoja`,
      nombrePapel,
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

  const agregarDesdeCotizador = (item: ItemDesdeCotizador) => {
    setItems((prev) => [...prev, {
      _key: nextKey, producto_id: null, producto_nombre: item.producto_nombre,
      precio_venta: item.precio_venta, cantidad: 1, descuento_pct: 0,
      descuento_max: 0, stockeable: false,
    }]);
    setNextKey((key) => key + 1);
    setModo("venta");
    setError(undefined);
  };

  const cargarPresupuesto = (presupuesto: PresupuestoPendiente) => {
    const itemsCargados = (presupuesto.items_presupuesto ?? []).map((item, index) => {
      const producto = item.producto_id ? productos.find((p) => p.id === item.producto_id) : undefined;
      return {
        _key: index,
        producto_id: item.producto_id,
        producto_nombre: item.producto,
        precio_venta: Number(item.precio ?? 0),
        cantidad: Math.max(1, Number(item.unidades ?? 1)),
        descuento_pct: Number(item.descuento ?? 0),
        descuento_max: Number(producto?.descuento_maximo ?? 0),
        stockeable: producto?.tipo === "producto" && !producto.es_servicio,
      };
    });
    if (!itemsCargados.length) { setError("Este presupuesto no tiene ítems para cobrar"); return; }
    setItems(itemsCargados);
    setNextKey(itemsCargados.length);
    setClienteId(presupuesto.cliente_id ?? "");
    setPresupuestoActivo({ id: presupuesto.id, numero: presupuesto.numero });
    setPresupuestoOk(null);
    setModo("venta");
    setError(undefined);
  };

  const guardarPresupuesto = () => {
    if (!items.length) { setError("Agregá productos al carrito"); return; }
    if (!clienteId) { setError("Seleccioná un cliente para guardar el presupuesto"); return; }
    const fd = new FormData();
    fd.set("cliente_id", clienteId);
    fd.set("items", JSON.stringify(items.map(({ _key, descuento_max, stockeable, ...rest }) => rest)));
    setError(undefined);
    startTransition(() => {
      guardarPresupuestoDesdeVenta(fd).then((res) => {
        if (res?.error) setError(res.error);
        else if (res?.ok) {
          setPresupuestoOk(res.numero);
          setItems([]);
          setClienteId("");
          setPresupuestoActivo(null);
          router.refresh();
        }
      });
    });
  };

  const handleVenta = () => {
    if (!items.length) { setError("Agrega productos al carrito"); return; }
    if (!codigoPersonal.trim()) { setError("Ingresa tu codigo de operador"); return; }
    setError(undefined);
    const fd = new FormData();
    fd.set("medio_pago", medioPago);
    fd.set("sucursal", sucursal);
    fd.set("codigo_personal", codigoPersonal);
    fd.set("items", JSON.stringify(items.map(({ _key, descuento_max, stockeable, ...rest }) => rest)));
    if (presupuestoActivo) fd.set("presupuesto_id", presupuestoActivo.id);
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
          setPresupuestoActivo(null);
          setClienteId("");
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
          <h1 className="text-2xl font-bold text-zinc-800">Ventas y presupuestos</h1>
          <p className="text-xs text-zinc-400 mt-0.5">{modo === "venta" ? "Punto de venta" : modo === "cotizar" ? "Cotización de impresión" : "Retomar presupuestos pendientes"}</p>
        </div>
        {modo === "venta" && <div className="grid grid-cols-1 md:grid-cols-[220px_1fr_210px_180px] gap-2">
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
        </div>}
      </div>

      <div className="flex flex-wrap gap-2 border-b border-zinc-200 pb-3">
        {([
          ["venta", "Cobrar ahora"],
          ["cotizar", "Cotizar impresión"],
          ["presupuestos", `Presupuestos pendientes (${presupuestosPendientes.length})`],
        ] as const).map(([valor, etiqueta]) => (
          <button key={valor} type="button" onClick={() => { setModo(valor); setError(undefined); }}
            className={`rounded-md px-4 py-2 text-sm font-bold transition ${modo === valor ? "bg-[#1a1a2e] text-white" : "bg-white text-zinc-600 border border-zinc-200 hover:border-[#f5a623]"}`}>
            {etiqueta}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
      <div className="xl:col-span-3 space-y-4">
        {modo === "venta" && <>
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
              <select value={papel} onChange={(e) => setPapel(e.target.value as PapelCodigo)}
                className="rounded-md border border-zinc-300 px-2 py-2 text-sm normal-case font-normal tracking-normal text-zinc-900">
                {PAPELES.map((p) => <option key={p.codigo} value={p.codigo}>{p.nombre}</option>)}
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
                <span className="font-semibold text-zinc-700">Motor de precios vigente</span>
                <span className="ml-auto font-black text-[#f5a623]">{cotizandoPdf ? "Calculando…" : fmt(totalImpresion)}</span>
                <button type="button" onClick={agregarImpresion} disabled={cotizandoPdf || !cotizacionPdf}
                  className="px-3 py-1.5 rounded-md bg-[#f5a623] text-[#1a1a2e] text-xs font-black disabled:opacity-40">
                  {cotizandoPdf ? "Calculando…" : "Agregar al carrito"}
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
              <p className="text-xs text-zinc-400 mt-0.5">Calculado automáticamente según el tramo vigente.</p>
            </div>
            <button type="button" onClick={agregarManual} disabled={cotizandoManual || !cotizacionManual}
              className="px-3 py-2 rounded-md bg-[#1a1a2e] text-white text-xs font-bold hover:bg-zinc-800 disabled:opacity-40">
              {cotizandoManual ? "Calculando…" : "Agregar"}
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <label className="grid gap-1 text-[11px] font-bold uppercase tracking-wide text-zinc-500">
              Canti de hojas
              <input type="number" min="1" value={manualHojas}
                onChange={(e) => setManualHojas(Math.max(1, parseInt(e.target.value) || 1))}
                className="rounded-md border border-zinc-300 px-2 py-2 text-sm normal-case font-normal tracking-normal text-zinc-900" />
            </label>
            <label className="grid gap-1 text-[11px] font-bold uppercase tracking-wide text-zinc-500">
              Tipo de papel
              <select value={manualPapel} onChange={(e) => setManualPapel(e.target.value as PapelCodigo)}
                className="rounded-md border border-zinc-300 px-2 py-2 text-sm normal-case font-normal tracking-normal text-zinc-900">
                {PAPELES.map((p) => <option key={p.codigo} value={p.codigo}>{p.nombre}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-[11px] font-bold uppercase tracking-wide text-zinc-500">
              Tramo vigente
              <div className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-2 text-sm normal-case font-semibold text-zinc-700">
                {cotizandoManual ? "Calculando…" : `${manualHojas} hoja${manualHojas === 1 ? "" : "s"}`}
              </div>
            </label>
            <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">Precio</p>
              <p className="text-lg font-black text-[#f5a623]">{cotizandoManual ? "…" : fmt(totalManual)}</p>
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
              const stockeable = prod.tipo === "producto" && !prod.es_servicio;
              const stock = stockLocal[prod.id] ?? 0;
              const sinStock = stockeable && stock <= 0;
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
                      <span className={`text-xs font-bold ${stockeable && stock <= 3 && stock > 0 ? "text-amber-500" : sinStock ? "text-red-500" : "text-emerald-600"}`}>
                        {sinStock ? "Sin stock" : stockeable ? `x${stock}` : prod.es_servicio ? "Servicio" : "Apunte"}
                      </span>
                    </div>
                    {(prod.descuento_registrado_pct ?? 0) > 0 && prod.precio_lista != null && (
                      <p className="text-[10px] font-semibold text-emerald-700">
                        <span className="mr-1 line-through text-zinc-400">{fmt(prod.precio_lista)}</span>
                        {prod.descuento_registrado_pct}% registrado
                      </p>
                    )}
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
        </>}

        {modo === "cotizar" && (
          <CotizadorView onAgregarAlCarrito={agregarDesdeCotizador} />
        )}

        {modo === "presupuestos" && (
          <section className="rounded-xl border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-100 p-5">
              <h2 className="font-black text-zinc-800">Presupuestos pendientes</h2>
              <p className="mt-1 text-sm text-zinc-500">Cargá uno en el carrito para cobrarlo sin volver a ingresar sus ítems.</p>
            </div>
            {presupuestosPendientes.length === 0 ? (
              <p className="p-8 text-center text-sm text-zinc-400">No hay presupuestos vigentes.</p>
            ) : (
              <div className="divide-y divide-zinc-100">
                {presupuestosPendientes.map((presupuesto) => {
                  const cliente = Array.isArray(presupuesto.clientes) ? presupuesto.clientes[0] : presupuesto.clientes;
                  return <div key={presupuesto.id} className="flex flex-wrap items-center gap-3 p-4">
                    <div className="min-w-[150px] flex-1">
                      <p className="font-mono text-sm font-black text-[#1a1a2e]">#{presupuesto.numero}</p>
                      <p className="text-sm font-semibold text-zinc-700">{cliente?.nombre ?? "Cliente sin asignar"}</p>
                      <p className="text-xs text-zinc-400">{(presupuesto.items_presupuesto ?? []).length} ítem(s) · vence {presupuesto.fecha_vencimiento ? new Date(`${presupuesto.fecha_vencimiento}T12:00:00`).toLocaleDateString("es-AR") : "sin vencimiento"}</p>
                    </div>
                    <p className="font-black text-[#f5a623]">{fmt(Number(presupuesto.total ?? 0))}</p>
                    <button type="button" onClick={() => cargarPresupuesto(presupuesto)} className="rounded-md bg-[#1a1a2e] px-3 py-2 text-xs font-black text-white hover:bg-zinc-800">
                      Cargar para cobrar
                    </button>
                  </div>;
                })}
              </div>
            )}
          </section>
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

          {presupuestoActivo && (
            <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
              Cobro vinculado al presupuesto <strong className="font-mono">#{presupuestoActivo.numero}</strong>.
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">Cliente {presupuestoActivo ? "del presupuesto" : "(necesario para guardar presupuesto)"}</label>
            <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} disabled={!!presupuestoActivo}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:border-[#f5a623] disabled:bg-zinc-100">
              <option value="">Sin asignar</option>
              {clientes.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.nombre}</option>)}
            </select>
          </div>

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
          {presupuestoOk && <p className="text-xs text-emerald-700 bg-emerald-50 rounded-md px-3 py-2">Presupuesto #{presupuestoOk} guardado. Ya podés atender al siguiente cliente.</p>}
          {!presupuestoActivo && <button
            type="button"
            onClick={guardarPresupuesto}
            disabled={isPending || !items.length || !clienteId}
            className="w-full py-3 rounded-md border border-[#1a1a2e] text-[#1a1a2e] font-black text-sm hover:bg-zinc-100 disabled:opacity-40 transition"
          >
            {isPending ? "Guardando..." : "Guardar como presupuesto"}
          </button>}
          <button
            type="button"
            onClick={handleVenta}
            disabled={isPending || !items.length}
            className="w-full py-3 rounded-md bg-[#f5a623] text-[#1a1a2e] font-black text-sm hover:bg-amber-400 disabled:opacity-40 transition"
          >
            {isPending ? "Registrando..." : presupuestoActivo ? `Cobrar presupuesto #${presupuestoActivo.numero}` : "Confirmar venta"}
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}
