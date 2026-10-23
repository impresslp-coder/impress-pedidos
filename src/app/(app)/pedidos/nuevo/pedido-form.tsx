"use client";

import { useEffect, useState, useTransition, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { crearPedido, type ItemPedidoInput } from "./actions";
import { useUpload } from "../../upload-context";
import { preferenciasDesdeItem } from "@/lib/archivo-prefs";

async function contarPaginasPDF(file: File): Promise<number> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let text = "";

  for (let i = 0; i < bytes.length; i += chunkSize) {
    text += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }

  const pageMatches = text.match(/\/Type\s*\/Page\b/g);
  return Math.max(pageMatches?.length ?? 0, 1);
}

type Cliente = { id: string; nombre: string; telefono: string | null; cod_pais: string | null };
type Producto = {
  id: string; nombre: string; paginas: number | null;
  precio: number | null;
  precio_sin_anillado?: number | null;
  precio_anillo?: number | null;
  precio_anillado?: number | null;
  categoria: string | null;
  tipo?: string | null; es_servicio?: boolean | null;
};
type PdfEntry = { id: number; file: File; paginas: number | null; contando: boolean };
type Faz = "simple" | "doble";
type Presentacion = "suelto" | "abrochado" | "anillado" | "encuadernado";
type PagPorHoja = 1 | 2 | 4;
type PapelCodigo = "comun" | "fotografico" | "chambril";
type Tamano = "A3" | "A4" | "A5";
type CotizacionTrabajo = {
  paginas: number; hojas: number; tipo_papel: PapelCodigo; tamano: Tamano;
  precio_impresion: number; precio_anillado: number; precio_encuadernado: number; total: number;
};

const PAPELES: { codigo: PapelCodigo; nombre: string }[] = [
  { codigo: "comun", nombre: "Común" },
  { codigo: "fotografico", nombre: "Fotográfico" },
  { codigo: "chambril", nombre: "Chambril" },
];

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(n);

const fmtSize = (bytes: number) => {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
};

const fmtEtaEstimado = (bytes: number) => {
  const secs = bytes / (10 * 1024 * 1024 / 8);
  if (secs < 5) return null;
  if (secs < 60) return `~${Math.round(secs)}s`;
  if (secs < 3600) return `~${Math.round(secs / 60)}min`;
  return `~${(secs / 3600).toFixed(1)}h`;
};

const fmtEta = (secs: number) => {
  if (secs < 60) return `${Math.round(secs)}s`;
  if (secs < 3600) return `${Math.round(secs / 60)}min`;
  return `${(secs / 3600).toFixed(1)}h`;
};

const IcoSimpleFaz = ({ s }: { s: boolean }) => (
  <svg width="30" height="22" viewBox="0 0 30 22" fill="none">
    <rect x="7" y="1" width="16" height="20" rx="1.5" fill={s ? "#1a1a2e" : "white"} stroke={s ? "#1a1a2e" : "#9ca3af"} strokeWidth="1.5"/>
    <line x1="10" y1="6" x2="20" y2="6" stroke={s ? "#f5a623" : "#d1d5db"} strokeWidth="1.2"/>
    <line x1="10" y1="10" x2="20" y2="10" stroke={s ? "#f5a623" : "#d1d5db"} strokeWidth="1.2"/>
    <line x1="10" y1="14" x2="16" y2="14" stroke={s ? "#f5a623" : "#d1d5db"} strokeWidth="1.2"/>
  </svg>
);
const IcoDobleFaz = ({ s }: { s: boolean }) => (
  <svg width="38" height="22" viewBox="0 0 38 22" fill="none">
    <rect x="1" y="1" width="15" height="20" rx="1.5" fill={s ? "#1a1a2e" : "white"} stroke={s ? "#1a1a2e" : "#9ca3af"} strokeWidth="1.5"/>
    <rect x="22" y="1" width="15" height="20" rx="1.5" fill={s ? "#1a1a2e" : "white"} stroke={s ? "#1a1a2e" : "#9ca3af"} strokeWidth="1.5"/>
    <line x1="4" y1="7" x2="13" y2="7" stroke={s ? "#f5a623" : "#d1d5db"} strokeWidth="1"/>
    <line x1="4" y1="11" x2="13" y2="11" stroke={s ? "#f5a623" : "#d1d5db"} strokeWidth="1"/>
    <line x1="25" y1="7" x2="34" y2="7" stroke={s ? "#f5a623" : "#d1d5db"} strokeWidth="1"/>
    <line x1="25" y1="11" x2="34" y2="11" stroke={s ? "#f5a623" : "#d1d5db"} strokeWidth="1"/>
    <path d="M18 8.5L20 11L18 13.5M20 8.5L22 11L20 13.5" stroke={s ? "#f5a623" : "#9ca3af"} strokeWidth="1" fill="none"/>
  </svg>
);
const IcoSinEnc = ({ s }: { s: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
    <rect x="3" y="1" width="16" height="20" rx="1.5" fill={s ? "#7c3aed" : "white"} stroke={s ? "#7c3aed" : "#9ca3af"} strokeWidth="1.5"/>
    <line x1="6" y1="7" x2="16" y2="7" stroke={s ? "#c4b5fd" : "#d1d5db"} strokeWidth="1"/>
    <line x1="6" y1="11" x2="16" y2="11" stroke={s ? "#c4b5fd" : "#d1d5db"} strokeWidth="1"/>
    <line x1="6" y1="15" x2="12" y2="15" stroke={s ? "#c4b5fd" : "#d1d5db"} strokeWidth="1"/>
  </svg>
);
const IcoAnillado = ({ s }: { s: boolean }) => (
  <svg width="26" height="22" viewBox="0 0 26 22" fill="none">
    <rect x="7" y="1" width="16" height="20" rx="1.5" fill={s ? "#7c3aed" : "white"} stroke={s ? "#7c3aed" : "#9ca3af"} strokeWidth="1.5"/>
    <circle cx="5" cy="5" r="2" fill={s ? "#c4b5fd" : "white"} stroke={s ? "#7c3aed" : "#9ca3af"} strokeWidth="1.2"/>
    <circle cx="5" cy="11" r="2" fill={s ? "#c4b5fd" : "white"} stroke={s ? "#7c3aed" : "#9ca3af"} strokeWidth="1.2"/>
    <circle cx="5" cy="17" r="2" fill={s ? "#c4b5fd" : "white"} stroke={s ? "#7c3aed" : "#9ca3af"} strokeWidth="1.2"/>
    <line x1="10" y1="8" x2="20" y2="8" stroke={s ? "#c4b5fd" : "#d1d5db"} strokeWidth="1"/>
    <line x1="10" y1="12" x2="20" y2="12" stroke={s ? "#c4b5fd" : "#d1d5db"} strokeWidth="1"/>
  </svg>
);
const IcoEncuadernado = ({ s }: { s: boolean }) => (
  <svg width="26" height="22" viewBox="0 0 26 22" fill="none">
    <rect x="5" y="1" width="17" height="20" rx="1.5" fill={s ? "#7c3aed" : "white"} stroke={s ? "#7c3aed" : "#9ca3af"} strokeWidth="1.5"/>
    <rect x="3" y="1" width="4" height="20" rx="1" fill={s ? "#c4b5fd" : "#e5e7eb"} stroke={s ? "#7c3aed" : "#9ca3af"} strokeWidth="1"/>
    <line x1="10" y1="8" x2="20" y2="8" stroke={s ? "#c4b5fd" : "#d1d5db"} strokeWidth="1"/>
    <line x1="10" y1="12" x2="20" y2="12" stroke={s ? "#c4b5fd" : "#d1d5db"} strokeWidth="1"/>
  </svg>
);
const IcoPag = ({ n, s }: { n: number; s: boolean }) => {
  const fill = s ? "#0e7490" : "white"; const stroke = s ? "#0e7490" : "#9ca3af"; const line = s ? "#67e8f9" : "#e5e7eb";
  if (n === 1) return (
    <svg width="18" height="22" viewBox="0 0 18 22" fill="none">
      <rect x="1" y="1" width="16" height="20" rx="1" fill={fill} stroke={stroke} strokeWidth="1.5"/>
      <line x1="4" y1="7" x2="14" y2="7" stroke={line} strokeWidth="1"/>
      <line x1="4" y1="11" x2="14" y2="11" stroke={line} strokeWidth="1"/>
    </svg>
  );
  if (n === 2) return (
    <svg width="28" height="22" viewBox="0 0 28 22" fill="none">
      <rect x="1" y="2" width="11" height="18" rx="1" fill={fill} stroke={stroke} strokeWidth="1.3"/>
      <rect x="16" y="2" width="11" height="18" rx="1" fill={fill} stroke={stroke} strokeWidth="1.3"/>
      <line x1="3" y1="8" x2="10" y2="8" stroke={line} strokeWidth="1"/>
      <line x1="18" y1="8" x2="25" y2="8" stroke={line} strokeWidth="1"/>
    </svg>
  );
  return (
    <svg width="28" height="22" viewBox="0 0 28 22" fill="none">
      <rect x="1" y="1" width="11" height="9" rx="1" fill={fill} stroke={stroke} strokeWidth="1.2"/>
      <rect x="16" y="1" width="11" height="9" rx="1" fill={fill} stroke={stroke} strokeWidth="1.2"/>
      <rect x="1" y="12" width="11" height="9" rx="1" fill={fill} stroke={stroke} strokeWidth="1.2"/>
      <rect x="16" y="12" width="11" height="9" rx="1" fill={fill} stroke={stroke} strokeWidth="1.2"/>
    </svg>
  );
};
const IcoSinAbrochar = ({ s }: { s: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
    <rect x="2" y="4" width="18" height="2" rx="1" fill={s ? "#065f46" : "#e5e7eb"} stroke={s ? "#065f46" : "#9ca3af"} strokeWidth="1"/>
    <rect x="4" y="8" width="14" height="13" rx="1" fill={s ? "#059669" : "white"} stroke={s ? "#059669" : "#9ca3af"} strokeWidth="1.5"/>
    <line x1="7" y1="13" x2="15" y2="13" stroke={s ? "#6ee7b7" : "#d1d5db"} strokeWidth="1"/>
    <line x1="7" y1="17" x2="12" y2="17" stroke={s ? "#6ee7b7" : "#d1d5db"} strokeWidth="1"/>
  </svg>
);
const IcoAbrochado = ({ s }: { s: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
    <rect x="2" y="4" width="18" height="2" rx="1" fill={s ? "#065f46" : "#e5e7eb"} stroke={s ? "#065f46" : "#9ca3af"} strokeWidth="1"/>
    <rect x="4" y="8" width="14" height="13" rx="1" fill={s ? "#059669" : "white"} stroke={s ? "#059669" : "#9ca3af"} strokeWidth="1.5"/>
    <rect x="9" y="3" width="4" height="7" rx="1" fill={s ? "#34d399" : "#9ca3af"} stroke={s ? "#059669" : "#6b7280"} strokeWidth="1"/>
    <line x1="7" y1="14" x2="15" y2="14" stroke={s ? "#6ee7b7" : "#d1d5db"} strokeWidth="1"/>
    <line x1="7" y1="17" x2="12" y2="17" stroke={s ? "#6ee7b7" : "#d1d5db"} strokeWidth="1"/>
  </svg>
);

function OptBtn({ sel, onClick, icon, label, accent = "amber" }: {
  sel: boolean; onClick: () => void; icon: React.ReactNode; label: string; accent?: string;
}) {
  const borders: Record<string, string> = {
    amber:   "border-[#f5a623] bg-amber-50 text-[#1a1a2e]",
    violet:  "border-violet-500 bg-violet-50 text-violet-800",
    cyan:    "border-cyan-500 bg-cyan-50 text-cyan-800",
    emerald: "border-emerald-500 bg-emerald-50 text-emerald-800",
  };
  return (
    <button type="button" onClick={onClick}
      className={`flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-xl border-2 transition text-xs font-semibold min-w-[64px] ${
        sel ? borders[accent] : "border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300 hover:bg-zinc-50"
      }`}>
      {icon}
      <span className="leading-tight text-center whitespace-nowrap">{label}</span>
    </button>
  );
}

function DescuentoModal({ descuento, maxDesc, predefinidos, onApply, onClose }: {
  descuento: string; maxDesc: number; predefinidos: number[];
  onApply: (v: string) => void; onClose: () => void;
}) {
  const [val, setVal] = useState(descuento);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-80 space-y-4 border border-zinc-100">
        <div className="flex items-center justify-between">
          <h3 className="font-black text-zinc-800 text-lg">Descuento</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-full hover:bg-zinc-100">×</button>
        </div>
        {predefinidos.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {predefinidos.map((d) => (
              <button key={d} type="button" onClick={() => { onApply(String(d)); onClose(); }}
                className={`px-4 py-2 rounded-full text-sm font-bold transition ${
                  parseFloat(val) === d ? "bg-[#f5a623] text-[#1a1a2e]" : "bg-zinc-100 text-zinc-700 hover:bg-amber-100 hover:text-amber-800"
                }`}>
                {d}%
              </button>
            ))}
          </div>
        )}
        <div>
          {maxDesc < 100 && <p className="text-xs text-zinc-400 mb-2">Máximo permitido: {maxDesc}%</p>}
          <div className="flex items-center gap-2">
            <input type="number" value={val} onChange={(e) => setVal(e.target.value)}
              suppressHydrationWarning min="0" max={maxDesc} placeholder="0"
              className="flex-1 rounded-xl border-2 border-zinc-200 px-3 py-2 text-2xl font-black text-center text-zinc-800 focus:outline-none focus:border-[#f5a623]" />
            <span className="text-2xl font-black text-zinc-400">%</span>
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={() => { onApply(val); onClose(); }}
            className="flex-1 py-2.5 rounded-xl bg-[#f5a623] text-[#1a1a2e] font-black text-sm hover:bg-[#d4881a] transition">
            Aplicar
          </button>
          <button type="button" onClick={() => { onApply("0"); onClose(); }}
            className="px-4 py-2.5 rounded-xl bg-zinc-100 text-zinc-600 text-sm font-semibold hover:bg-zinc-200 transition">
            Quitar
          </button>
        </div>
      </div>
    </div>
  );
}

type Sucursal = { id: string; nombre: string };
const MEDIOS_PAGO = ["Efectivo", "Transferencia", "Débito", "Crédito", "QR", "Cuenta corriente"];
const VIAS_CONTACTO = ["Presencial", "WhatsApp", "Teléfono", "Instagram", "Email", "Facebook"];

function SucursalModal({ sucursales, total, clienteTelefono, codigoPersonal, onConfirm, onClose }: {
  sucursales: Sucursal[];
  total: number;
  clienteTelefono: string;
  codigoPersonal: string | null;
  onConfirm: (data: {
    sucursalProd: string; sucursalRetiro: string;
    esEnvio: boolean; senia: number; medioPago: string; viaContacto: string;
    mensaje: string; codigoOperador: string;
  }) => void;
  onClose: () => void;
}) {
  const defaultSenia = Math.round(total / 2 * 100) / 100;
  const sucursalGuardada = typeof window !== "undefined"
    ? (localStorage.getItem("impress_sucursal_activa") ?? "")
    : "";
  const sucursalDefault = sucursalGuardada || sucursales[0]?.nombre || "";
  const [sucProd, setSucProd] = useState(sucursalDefault);
  const [sucRetiro, setSucRetiro] = useState(sucursalDefault);
  const [esEnvio, setEsEnvio] = useState(false);
  const [senia, setSenia] = useState("");
  const [codigoOp, setCodigoOp] = useState("");
  const [errorSenia, setErrorSenia] = useState<string>();
  const [errorCodigo, setErrorCodigo] = useState<string>();
  const [medioPago, setMedioPago] = useState(MEDIOS_PAGO[0]);
  const [viaContacto, setViaContacto] = useState(VIAS_CONTACTO[0]);
  const [mensaje, setMensaje] = useState("");
  const [errorEntrega, setErrorEntrega] = useState<string>();
  const telefono = clienteTelefono;

  const seniaReal = senia === "" ? 0 : (parseFloat(senia) || 0);
  const fmt2 = (n: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(n);

  const handleConfirm = () => {
    setErrorSenia(undefined);
    setErrorCodigo(undefined);
    setErrorEntrega(undefined);
    if (seniaReal <= 0) {
      setErrorSenia("Debés ingresar una seña mayor a $0");
      return;
    }
    if (codigoPersonal) {
      if (!codigoOp.trim()) {
        setErrorCodigo("Ingresá tu código de operador");
        return;
      }
      if (codigoOp.trim() !== codigoPersonal.trim()) {
        setErrorCodigo("Código de operador incorrecto");
        return;
      }
    }
    if (!sucProd.trim()) {
      setErrorEntrega("Indicá la sucursal de producción");
      return;
    }
    if (!esEnvio && !sucRetiro.trim()) {
      setErrorEntrega("Elegí la sucursal de retiro o marcá envío a domicilio");
      return;
    }
    onConfirm({ sucursalProd: sucProd, sucursalRetiro: esEnvio ? "" : sucRetiro, esEnvio,
      senia: seniaReal, medioPago, viaContacto, mensaje, codigoOperador: codigoOp });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-[480px] max-w-[95vw] space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-black text-zinc-800 text-lg">Confirmar pedido</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 text-2xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-zinc-100">×</button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">Dónde se produce</label>
            {sucursales.length > 0 ? (
              <select value={sucProd} onChange={(e) => setSucProd(e.target.value)}
                className="w-full rounded-xl border-2 border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:border-[#f5a623]">
                {sucursales.map((s) => <option key={s.id} value={s.nombre}>{s.nombre}</option>)}
              </select>
            ) : (
              <input value={sucProd} onChange={(e) => setSucProd(e.target.value)} suppressHydrationWarning
                placeholder="Nombre sucursal"
                className="w-full rounded-xl border-2 border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:border-[#f5a623]" />
            )}
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">Entrega</label>
            <div className="flex rounded-xl border-2 border-zinc-200 overflow-hidden text-xs font-bold">
              <button type="button" onClick={() => setEsEnvio(false)} className={`flex-1 px-2 py-2 ${!esEnvio ? "bg-[#1a1a2e] text-white" : "bg-white text-zinc-500"}`}>Retiro</button>
              <button type="button" onClick={() => setEsEnvio(true)} className={`flex-1 px-2 py-2 ${esEnvio ? "bg-[#1a1a2e] text-white" : "bg-white text-zinc-500"}`}>Envío</button>
            </div>
            {!esEnvio ? (sucursales.length > 0 ? (
              <select value={sucRetiro} onChange={(e) => setSucRetiro(e.target.value)} className="mt-2 w-full rounded-xl border-2 border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:border-[#f5a623]">
                {sucursales.map((s) => <option key={s.id} value={s.nombre}>{s.nombre}</option>)}
              </select>
            ) : <input value={sucRetiro} onChange={(e) => setSucRetiro(e.target.value)} placeholder="Nombre sucursal" className="mt-2 w-full rounded-xl border-2 border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:border-[#f5a623]" />) : (
              <p className="mt-2 text-xs text-zinc-500">Se coordinará día y franja horaria por WhatsApp.</p>
            )}
          </div>
        </div>

        {/* Resumen total */}
        <div className="rounded-xl bg-[#1a1a2e] px-4 py-3 flex justify-between items-center">
          <span className="text-zinc-400 text-sm">Total del pedido</span>
          <span className="text-[#f5a623] font-black text-xl">{fmt2(total)}</span>
        </div>

        {/* Código de operador — va justo debajo del resumen */}
        <div>
          <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">
            Tu código de operador{codigoPersonal ? <span className="text-red-500 ml-1">*</span> : null}
          </label>
          {codigoPersonal ? (
            <input value={codigoOp} onChange={(e) => { setCodigoOp(e.target.value); setErrorCodigo(undefined); }}
              suppressHydrationWarning placeholder="Ingresá tu código"
              className="w-full rounded-xl border-2 border-zinc-200 px-3 py-2 text-sm font-mono focus:outline-none focus:border-[#f5a623]" />
          ) : (
            <p className="text-xs text-zinc-400 italic px-1">Sin código asignado — dejá vacío</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">Seña</label>
            <input type="number" value={senia} onChange={(e) => { setSenia(e.target.value); setErrorSenia(undefined); }}
              suppressHydrationWarning min="0" placeholder={`${defaultSenia} (mitad)`}
              className="w-full rounded-xl border-2 border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:border-[#f5a623] placeholder:text-zinc-300" />
            {senia !== "" && (
              <p className="text-xs text-zinc-400 mt-0.5">Resto: {fmt2(Math.max(0, total - seniaReal))}</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">Medio de pago</label>
            <select value={medioPago} onChange={(e) => setMedioPago(e.target.value)}
              className="w-full rounded-xl border-2 border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:border-[#f5a623]">
              {MEDIOS_PAGO.map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">Vía de contacto</label>
            <select value={viaContacto} onChange={(e) => setViaContacto(e.target.value)}
              className="w-full rounded-xl border-2 border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:border-[#f5a623]">
              {VIAS_CONTACTO.map((v) => <option key={v}>{v}</option>)}
            </select>
          </div>
          <p className="self-end pb-2 text-xs text-zinc-500">La prioridad se administra por ítem una vez creado el pedido.</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">Teléfono del cliente</label>
            <p className={`rounded-xl border-2 border-zinc-100 bg-zinc-50 px-3 py-2 text-sm ${telefono ? "text-zinc-700" : "text-zinc-400 italic"}`}>
              {telefono || "Sin teléfono registrado"}
            </p>
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">Mensaje</label>
            <input value={mensaje} onChange={(e) => setMensaje(e.target.value)} suppressHydrationWarning
              placeholder="Ej: llamar antes de pasar, entregar en caja chica..."
              className="w-full rounded-xl border-2 border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:border-[#f5a623]" />
          </div>
        </div>

        {errorSenia && (
          <p className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{errorSenia}</p>
        )}
        {errorCodigo && (
          <p className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{errorCodigo}</p>
        )}
        {errorEntrega && <p className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{errorEntrega}</p>}

        <button type="button" onClick={handleConfirm}
          className="w-full py-3 rounded-xl bg-[#f5a623] text-[#1a1a2e] font-black text-sm hover:bg-[#d4881a] transition shadow-lg shadow-amber-500/20">
          ✓ Confirmar y guardar
        </button>
      </div>
    </div>
  );
}

export default function PedidoForm({
  clientes: clientesIniciales, productos, config, sucursales, codigoPersonal, precioEncuadernado, descuentoCatalogoPct,
}: {
  clientes: Cliente[]; productos: Producto[];
  config: Record<string, string>; sucursales: Sucursal[]; codigoPersonal: string | null;
  precioEncuadernado: number | null;
  descuentoCatalogoPct: number;
}) {
  const router = useRouter();
  const { startUploads } = useUpload();
  const [isPending, startTransition] = useTransition();
  const [isPendingPresup, startTransitionPresup] = useTransition();
  const [error, setError] = useState<string>();
  const [showSucursalModal, setShowSucursalModal] = useState(false);
  const [savedPedido, setSavedPedido] = useState<{ pedidoId: string; numero: string; codigoUnico?: string; mode: "pedido" | "presupuesto" } | null>(null);

  const defaultFaz       = (config.default_faz            ?? "simple") as Faz;
  const defaultPPH       = parseInt(config.default_pag_por_hoja ?? "1") as PagPorHoja;
  const defaultPresentacion: Presentacion = (() => {
    const nueva = config.default_presentacion;
    if (nueva === "suelto" || nueva === "abrochado" || nueva === "anillado" || nueva === "encuadernado") return nueva;
    const enc = config.default_encuadernacion;
    if (enc === "anillado" || enc === "encuadernado") return enc;
    if (config.default_abrochado === "true") return "abrochado";
    return "suelto";
  })();
  const descMaximoConfig = parseFloat(config.pedidos_desc_maximo ?? "100") || 100;
  const descuentosPredefinidos = (config.descuentos_predefinidos ?? "").split(",").map(Number).filter(Boolean);

  const [clientes, setClientes] = useState<Cliente[]>(clientesIniciales);
  const [clienteId, setClienteId] = useState("");
  const [clienteQuery, setClienteQuery] = useState("");
  const [mostrarNuevoCliente, setMostrarNuevoCliente] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoTel, setNuevoTel] = useState("");
  const [creandoCliente, setCreandoCliente] = useState(false);
  const [errorCliente, setErrorCliente] = useState<string>();

  const [pdfs, setPdfs] = useState<PdfEntry[]>([]);
  const [pdfIdCounter, setPdfIdCounter] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [prodQuery, setProdQuery] = useState("");
  const [prodSelId, setProdSelId] = useState("");

  const [faz, setFaz] = useState<Faz>(defaultFaz);
  const [presentacion, setPresentacion] = useState<Presentacion>(defaultPresentacion);
  const [pagPorHoja, setPagPorHoja] = useState<PagPorHoja>(defaultPPH);
  const [papel, setPapel] = useState<PapelCodigo>("comun");
  const [tamano, setTamano] = useState<Tamano>("A4");
  const [cotizacionTrabajo, setCotizacionTrabajo] = useState<CotizacionTrabajo | null>(null);
  const [cotizandoTrabajo, setCotizandoTrabajo] = useState(false);

  const [descuento, setDescuento] = useState("0");
  const [cantidad, setCantidad] = useState("1");
  const [anotacion, setAnotacion] = useState("");
  const [imprimirTapas, setImprimirTapas] = useState(false);
  const [showDescModal, setShowDescModal] = useState(false);

  const [items, setItems] = useState<(ItemPedidoInput & { _key: number; _pdfs?: File[] })[]>([]);
  const [nextKey, setNextKey] = useState(0);

  const maxDesc = descMaximoConfig;
  const desc    = Math.min(parseFloat(descuento) || 0, maxDesc);
  const prodSel = productos.find((p) => p.id === prodSelId);
  const esApunteCatalogo = !!prodSel && prodSel.tipo === "encargo" && !prodSel.es_servicio;

  const paginasPorHojaEfectivas = pagPorHoja * (faz === "doble" ? 2 : 1);
  const calcHojas = (paginas: number) =>
    paginas > 0 ? Math.ceil(paginas / paginasPorHojaEfectivas) : 0;

  const totalPaginas = pdfs.reduce((acc, p) => acc + (p.paginas ?? 0), 0);
  const totalHojas   = calcHojas(totalPaginas);
  const hayTrabajo   = totalPaginas > 0;
  const todoContado  = pdfs.length > 0 && pdfs.every((p) => !p.contando && p.paginas !== null);

  useEffect(() => {
    let vigente = true;
    if (!hayTrabajo || !todoContado || esApunteCatalogo) {
      setCotizacionTrabajo(null);
      setCotizandoTrabajo(false);
      return;
    }

    setCotizacionTrabajo(null);
    setCotizandoTrabajo(true);
    fetch("/api/precios/pedido", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paginas: totalPaginas,
        hojas: totalHojas,
        tipo_papel: papel,
        tamano,
        anillado: presentacion === "anillado",
        encuadernado: presentacion === "encuadernado",
      }),
    })
      .then(async (response) => {
        const json = await response.json();
        if (!response.ok) throw new Error(json.error ?? "No se pudo cotizar el trabajo.");
        return json as CotizacionTrabajo;
      })
      .then((data) => vigente && setCotizacionTrabajo(data))
      .catch((err) => vigente && setError(err.message))
      .finally(() => vigente && setCotizandoTrabajo(false));

    return () => { vigente = false; };
  }, [hayTrabajo, todoContado, esApunteCatalogo, totalPaginas, totalHojas, papel, tamano, presentacion]);

  const precioBase = cotizacionTrabajo?.precio_impresion ?? 0;
  const extraPresentacion = presentacion === "anillado"
    ? (cotizacionTrabajo?.precio_anillado ?? 0)
    : presentacion === "encuadernado"
      ? (cotizacionTrabajo?.precio_encuadernado ?? 0)
      : 0;
  const precioCatalogoSinAnillo = prodSel?.precio_sin_anillado ?? prodSel?.precio ?? 0;
  const precioCatalogoConAnillo = prodSel?.precio_anillado ?? precioCatalogoSinAnillo;
  // Un apunte entra anillado por defecto. Suelto quita sólo el anillo;
  // encuadernado conserva el anillado y agrega el acabado vigente.
  const precioCatalogoAntesDescuentoRegistrado = presentacion === "suelto"
    ? precioCatalogoSinAnillo
    : presentacion === "encuadernado"
      ? precioCatalogoConAnillo + (precioEncuadernado ?? 0)
      : precioCatalogoConAnillo;
  const precioCatalogoPresentacion = esApunteCatalogo
    ? Math.round((precioCatalogoAntesDescuentoRegistrado - (presentacion === "encuadernado" ? (precioEncuadernado ?? 0) : 0)) * (1 - descuentoCatalogoPct / 100))
      + (presentacion === "encuadernado" ? (precioEncuadernado ?? 0) : 0)
    : precioCatalogoAntesDescuentoRegistrado;
  const precioAntesDescuento = prodSel
    ? precioCatalogoPresentacion / pagPorHoja
    : cotizacionTrabajo?.total ?? 0;
  const descuentoMonto = precioAntesDescuento * (desc / 100);
  const precioFinal  = prodSel
    ? Math.round(precioAntesDescuento * (1 - desc / 100))
    : cotizacionTrabajo ? Math.round(precioAntesDescuento * (1 - desc / 100)) : 0;
  const cantidadReal = Math.max(1, Math.floor(Number(cantidad) || 1));
  const subtotalItem = precioFinal * cantidadReal;

  const handleFaz = (v: Faz) => { setFaz(v); };

  const handlePDFs = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const nuevos: PdfEntry[] = files.map((f, i) => ({ id: pdfIdCounter + i, file: f, paginas: null, contando: true }));
    setPdfIdCounter((c) => c + files.length);
    setPdfs((prev) => [...prev, ...nuevos]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    const conteos = await Promise.all(files.map(contarPaginasPDF));
    setPdfs((prev) => prev.map((p) => {
      const idx = nuevos.findIndex((n) => n.id === p.id);
      return idx === -1 ? p : { ...p, paginas: conteos[idx], contando: false };
    }));
  };

  const buildModo = () => {
    const parts = [faz === "doble" ? "Doble faz" : "Simple faz"];
    if (pagPorHoja > 1) parts.push(`${pagPorHoja} p/hoja`);
    if (pdfs.length > 0) {
      const nombrePapel = PAPELES.find((item) => item.codigo === papel)?.nombre ?? papel;
      parts.push(`${nombrePapel} ${tamano}`);
    }
    if (presentacion === "abrochado") parts.push("Abrochado");
    else if (presentacion === "anillado") parts.push("Anillado");
    else if (presentacion === "encuadernado") parts.push("Encuadernado");
    return parts.join(" · ");
  };

  const resetItem = () => {
    setProdQuery(""); setProdSelId(""); setPdfs([]);
    setDescuento("0"); setAnotacion("");
    setCantidad("1");
    setFaz(defaultFaz); setPresentacion(defaultPresentacion);
    setPagPorHoja(defaultPPH);
    setPapel("comun"); setTamano("A4");
    setImprimirTapas(false);
  };

  const agregarItem = () => {
    if (!prodSel && (!todoContado || !cotizacionTrabajo)) return;
    const nombre = prodSel?.nombre ?? (prodQuery || (pdfs[0]?.file.name.replace(/\.pdf$/i, "") ?? "Documento"));
    const item: ItemPedidoInput & { _key: number; _pdfs?: File[] } = {
      _key: nextKey,
      _pdfs: pdfs.map((p) => p.file),
      producto: nombre,
      anotacion: anotacion || undefined,
      paginas: totalPaginas || prodSel?.paginas || undefined,
      modo: buildModo(),
      cantidad: cantidadReal,
      precio_unitario: precioFinal,
      precio: subtotalItem,
      descuento: desc || undefined,
    };
    setItems((prev) => [...prev, item]);
    setNextKey((k) => k + 1);
    resetItem();
  };

  const quitarItem = (key: number) => setItems((prev) => prev.filter((i) => i._key !== key));
  const total = items.reduce((acc, i) => acc + i.precio, 0);

  const crearCliente = async () => {
    if (!nuevoNombre.trim()) return;
    setCreandoCliente(true); setErrorCliente(undefined);
    const fd = new FormData();
    fd.set("nombre", nuevoNombre); fd.set("telefono", nuevoTel); fd.set("cod_pais", "54"); fd.set("mail", "");
    const res = await fetch("/api/clientes/crear", { method: "POST", body: fd });
    const json = await res.json();
    if (json.error) { setErrorCliente(json.error); setCreandoCliente(false); return; }
    if (json.cliente) {
      setClientes((prev) => [...prev, json.cliente]);
      setClienteId(json.cliente.id); setClienteQuery(json.cliente.nombre);
    }
    setNuevoNombre(""); setNuevoTel(""); setMostrarNuevoCliente(false); setCreandoCliente(false);
  };

  const handleSubmit = () => {
    if (!clienteId) { setError("Seleccioná un cliente"); return; }
    if (!items.length) { setError("Agregá al menos un producto"); return; }
    setError(undefined);
    setShowSucursalModal(true);
  };

  const guardarPedido = (modalData: {
    sucursalProd: string; sucursalRetiro: string;
    esEnvio: boolean; senia: number; medioPago: string; viaContacto: string;
    mensaje: string; codigoOperador: string;
  }) => {
    setShowSucursalModal(false);
    const fd = new FormData();
    fd.set("cliente_id",         clienteId);
    fd.set("items",              JSON.stringify(items.map(({ _key, _pdfs, ...rest }) => rest)));
    fd.set("senia",              String(modalData.senia));
    fd.set("medio_pago",         modalData.medioPago);
    fd.set("via_contacto",       modalData.viaContacto);
    fd.set("mensaje",            modalData.mensaje);
    fd.set("telefono_contacto",  clienteTelefono);
    fd.set("quien_cargo_codigo", modalData.codigoOperador);
    fd.set("sucursal_produccion", modalData.sucursalProd);
    fd.set("sucursal_retiro",    modalData.sucursalRetiro);
    fd.set("es_envio",           String(modalData.esEnvio));
    fd.set("imprimir_tapas",     String(imprimirTapas));

    startTransition(() => {
      crearPedido(fd).then(async (res) => {
        if (!res || res.error) { if (res?.error) setError(res.error); return; }

        const allPdfs: { file: File; pedidoId: string; printPrefs: ReturnType<typeof preferenciasDesdeItem> }[] = [];
        for (const item of items) for (const pdf of item._pdfs ?? []) {
          allPdfs.push({ file: pdf, pedidoId: res.pedidoId!, printPrefs: preferenciasDesdeItem(item) });
        }

        // Navigate immediately — uploads continue in background via context
        if (allPdfs.length) startUploads(allPdfs);
        setSavedPedido({ pedidoId: res.pedidoId!, numero: res.numero ?? "", codigoUnico: res.codigoUnico, mode: "pedido" });
      });
    });
  };

  const handleSaveAsPresupuesto = () => {
    if (!clienteId) { setError("Seleccioná un cliente"); return; }
    if (!items.length) { setError("Agregá al menos un producto"); return; }
    setError(undefined);
    const fd = new FormData();
    fd.set("cliente_id",      clienteId);
    fd.set("items",           JSON.stringify(items.map(({ _key, _pdfs, ...rest }) => rest)));
    fd.set("como_presupuesto", "true");
    fd.set("senia",           "0");
    fd.set("medio_pago",      "");
    fd.set("via_contacto",    "");
    fd.set("mensaje",         "");
    fd.set("telefono_contacto", clienteTelefono);
    fd.set("quien_cargo_codigo", "");
    fd.set("sucursal_produccion", "");
    fd.set("sucursal_retiro", "");
    fd.set("es_envio",        "false");
    startTransitionPresup(() => {
      crearPedido(fd).then(async (res) => {
        if (!res || res.error) { if (res?.error) setError(res.error); return; }
        const allPdfs: { file: File; pedidoId: string; printPrefs: ReturnType<typeof preferenciasDesdeItem> }[] = [];
        for (const item of items) for (const pdf of item._pdfs ?? []) {
          allPdfs.push({ file: pdf, pedidoId: res.pedidoId!, printPrefs: preferenciasDesdeItem(item) });
        }
        if (allPdfs.length) startUploads(allPdfs);
        setSavedPedido({ pedidoId: res.pedidoId!, numero: res.numero ?? "", codigoUnico: res.codigoUnico, mode: "presupuesto" });
      });
    });
  };

  const clienteSel = clientes.find((c) => c.id === clienteId);
  const clienteTelefono = clienteSel ? `${clienteSel.cod_pais ? "+" + clienteSel.cod_pais : ""}${clienteSel.telefono ?? ""}`.trim() : "";

  const clientesFiltrados = clienteQuery
    ? clientes.filter((c) => c.nombre.toLowerCase().includes(clienteQuery.toLowerCase()))
    : clientes.slice(0, 15);
  const prodsFiltrados = prodQuery
    ? productos.filter((p) => p.nombre.toLowerCase().includes(prodQuery.toLowerCase()))
    : productos.slice(0, 15);

  const canAdd = !!prodSel || (pdfs.length > 0 && todoContado && !!cotizacionTrabajo && !cotizandoTrabajo);

  // ── Success screen ──
  if (savedPedido) {
    const esPresupuesto = savedPedido.mode === "presupuesto";
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] py-12 space-y-6 text-center">
        <div className={`w-20 h-20 rounded-full flex items-center justify-center ${esPresupuesto ? "bg-blue-100" : "bg-emerald-100"}`}>
          {esPresupuesto ? (
            <span className="text-4xl">📄</span>
          ) : (
            <svg className="w-10 h-10 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
        <div>
          <h2 className="text-2xl font-black text-zinc-800">
            {esPresupuesto ? "¡Presupuesto guardado!" : "¡Pedido guardado!"}
          </h2>
          <p className="text-zinc-500 mt-1 font-mono text-sm">N° {savedPedido.numero}</p>
          {savedPedido.codigoUnico && (
            <p className="text-xs text-zinc-400 font-mono mt-0.5">{savedPedido.codigoUnico}</p>
          )}
          {esPresupuesto && (
            <p className="text-sm text-blue-600 mt-2 bg-blue-50 border border-blue-100 rounded-xl px-4 py-2">
              Podés convertirlo en pedido cuando el cliente confirme.
            </p>
          )}
        </div>
        {!esPresupuesto && (
          <div className="flex gap-3 flex-wrap justify-center">
            <a href={`/api/pdf/pedido/${savedPedido.pedidoId}?tipo=resumen`} target="_blank" rel="noopener noreferrer"
              className="px-5 py-3 rounded-xl bg-[#1a1a2e] text-white font-bold text-sm hover:bg-zinc-800 transition flex items-center gap-2">
              📄 Bajar resumen
            </a>
            <a href={`/api/pdf/pedido/${savedPedido.pedidoId}?tipo=ticket`} target="_blank" rel="noopener noreferrer"
              className="px-5 py-3 rounded-xl bg-[#f5a623] text-[#1a1a2e] font-bold text-sm hover:bg-amber-400 transition flex items-center gap-2">
              🖨️ Bajar ticket
            </a>
          </div>
        )}
        <div className="flex gap-4 flex-wrap justify-center">
          <Link href={`/pedidos/${savedPedido.pedidoId}`}
            className="text-sm text-zinc-500 underline underline-offset-2 hover:text-zinc-700">
            {esPresupuesto ? "Ver presupuesto →" : "Ver detalle del pedido →"}
          </Link>
          <button type="button" onClick={() => { setSavedPedido(null); }}
            className="text-sm text-[#f5a623] font-semibold hover:underline">
            + Nuevo pedido
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {showDescModal && (
        <DescuentoModal descuento={descuento} maxDesc={maxDesc} predefinidos={descuentosPredefinidos}
          onApply={setDescuento} onClose={() => setShowDescModal(false)} />
      )}
      {showSucursalModal && (
        <SucursalModal sucursales={sucursales} total={total} clienteTelefono={clienteTelefono}
          codigoPersonal={codigoPersonal}
          onConfirm={guardarPedido} onClose={() => setShowSucursalModal(false)} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 items-start">

        {/* ─── Izquierda ─── */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-4 space-y-3">
            <h2 className="text-xs font-black text-zinc-400 uppercase tracking-widest">Cliente</h2>
            <div className="relative">
              <input value={clienteQuery} onChange={(e) => { setClienteQuery(e.target.value); setClienteId(""); }}
                placeholder="Buscar cliente..." suppressHydrationWarning
                className="w-full rounded-xl border-2 border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:border-[#f5a623] transition" />
              {clienteQuery && !clienteId && clientesFiltrados.length > 0 && (
                <ul className="absolute z-20 w-full border border-zinc-200 rounded-xl mt-1 max-h-44 overflow-y-auto shadow-xl bg-white">
                  {clientesFiltrados.map((c) => (
                    <li key={c.id} className="px-3 py-2.5 text-sm hover:bg-amber-50 cursor-pointer border-b border-zinc-50 last:border-0"
                      onClick={() => { setClienteId(c.id); setClienteQuery(c.nombre); }}>
                      <p className="font-semibold text-zinc-800">{c.nombre}</p>
                      {c.telefono && <p className="text-zinc-400 text-xs">{c.telefono}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {clienteId
              ? <p className="text-xs text-emerald-600 font-bold flex items-center gap-1">✓ Seleccionado</p>
              : <p className="text-xs text-zinc-400">Escribí para buscar</p>
            }
            {!mostrarNuevoCliente ? (
              <button type="button" onClick={() => setMostrarNuevoCliente(true)}
                className="w-full text-xs text-[#f5a623] border-2 border-dashed border-amber-200 rounded-xl py-2 font-semibold hover:bg-amber-50 transition">
                + Nuevo cliente
              </button>
            ) : (
              <div className="space-y-2 border-2 border-amber-100 rounded-xl p-3 bg-amber-50">
                <p className="text-xs font-bold text-amber-800">Nuevo cliente</p>
                <input value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} placeholder="Nombre *"
                  suppressHydrationWarning className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#f5a623] bg-white" />
                <input value={nuevoTel} onChange={(e) => setNuevoTel(e.target.value)} placeholder="Teléfono"
                  suppressHydrationWarning className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#f5a623] bg-white" />
                {errorCliente && <p className="text-xs text-red-600 font-medium">{errorCliente}</p>}
                <div className="flex gap-2">
                  <button type="button" onClick={crearCliente} disabled={!nuevoNombre || creandoCliente}
                    className="flex-1 py-1.5 rounded-lg bg-[#1a1a2e] text-white text-xs font-bold hover:bg-[#16213e] disabled:opacity-50 transition">
                    {creandoCliente ? "..." : "Crear"}
                  </button>
                  <button type="button" onClick={() => { setMostrarNuevoCliente(false); setNuevoNombre(""); setNuevoTel(""); setErrorCliente(undefined); }}
                    className="px-3 py-1.5 rounded-lg bg-white text-zinc-500 text-xs border border-zinc-200 hover:bg-zinc-100 transition">✕</button>
                </div>
              </div>
            )}
          </div>

          {/* Resumen */}
          <div className="bg-[#1a1a2e] rounded-2xl shadow-lg p-4 space-y-3 sticky top-4">
            <h2 className="text-xs font-black text-zinc-400 uppercase tracking-widest">Resumen</h2>
            {items.length === 0 ? (
              <p className="text-zinc-500 text-sm text-center py-4">Sin productos</p>
            ) : (
              <ul className="space-y-2">
                {items.map((item) => (
                  <li key={item._key} className="flex items-start justify-between gap-2 border-b border-zinc-700 pb-2 last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white text-xs truncate">{item.producto}</p>
                      {item.modo && <p className="text-zinc-500 text-xs truncate">{item.modo}</p>}
                      {item.paginas ? <p className="text-zinc-500 text-xs">{item.paginas} pág</p> : null}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold text-[#f5a623]">{fmt(item.precio)}</p>
                      {item.descuento ? <p className="text-xs text-zinc-500">{item.descuento}% off</p> : null}
                    </div>
                    <button type="button" onClick={() => quitarItem(item._key)}
                      className="text-zinc-600 hover:text-red-400 text-base leading-none shrink-0 transition">×</button>
                  </li>
                ))}
              </ul>
            )}
            {items.length > 0 && (
              <div className="border-t border-zinc-700 pt-2 flex justify-between font-black text-white">
                <span>Total</span>
                <span className="text-[#f5a623] text-lg">{fmt(total)}</span>
              </div>
            )}
            {error && <p className="rounded-xl bg-red-900/30 border border-red-500/30 px-3 py-2 text-xs text-red-400">{error}</p>}
            <button type="button" onClick={handleSubmit} disabled={isPending || isPendingPresup || !clienteId || items.length === 0}
              className="w-full py-3 rounded-xl bg-[#f5a623] text-[#1a1a2e] font-black text-sm hover:bg-[#d4881a] disabled:opacity-40 transition shadow-lg shadow-amber-500/20">
              {isPending ? "Guardando..." : "✓ Confirmar pedido"}
            </button>
            <button type="button" onClick={handleSaveAsPresupuesto} disabled={isPending || isPendingPresup || !clienteId || items.length === 0}
              className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 disabled:opacity-40 transition">
              {isPendingPresup ? "Guardando..." : "📄 Guardar como Presupuesto"}
            </button>
            <button type="button" onClick={() => router.back()}
              className="w-full py-2 rounded-xl bg-zinc-800 text-zinc-400 text-xs font-medium hover:bg-zinc-700 transition">
              Cancelar
            </button>
          </div>
        </div>

        {/* ─── Derecha ─── */}
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-100 bg-gradient-to-r from-zinc-50 to-amber-50">
            <h2 className="text-sm font-black text-zinc-700 uppercase tracking-wider">Agregar producto</h2>
            <div className="ml-auto flex items-center gap-2">
              <div className="text-right">
                {precioFinal > 0 ? (
                  <>
                    <p className="text-2xl font-black text-[#f5a623] leading-none">{fmt(precioFinal)}</p>
                    {desc > 0 && <p className="text-xs text-zinc-400 line-through">{fmt(precioAntesDescuento)}</p>}
                  </>
                ) : (
                  <p className="text-xl font-black text-zinc-200 leading-none">—</p>
                )}
              </div>
              <button type="button" onClick={() => setShowDescModal(true)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 text-xs font-bold transition ${
                  desc > 0
                    ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                    : "border-zinc-200 bg-white text-zinc-500 hover:border-amber-300 hover:text-amber-700"
                }`}>
                <span>%</span>
                <span>{desc > 0 ? `${desc}% off` : "Descuento"}</span>
              </button>
            </div>
          </div>

          <div className="p-5 space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1.5">Producto</label>
                <input value={prodQuery} onChange={(e) => { setProdQuery(e.target.value); setProdSelId(""); }}
                  placeholder="Buscar o escribir..." suppressHydrationWarning
                  className="w-full rounded-xl border-2 border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:border-[#f5a623] transition" />
                {prodQuery && !prodSelId && prodsFiltrados.length > 0 && (
                  <ul className="absolute z-20 w-full border border-zinc-200 rounded-xl mt-1 max-h-44 overflow-y-auto shadow-xl bg-white">
                    {prodsFiltrados.map((p) => (
                      <li key={p.id} className="px-3 py-2 text-sm hover:bg-amber-50 cursor-pointer border-b border-zinc-50 last:border-0"
                        onClick={() => { setProdSelId(p.id); setProdQuery(p.nombre); if (p.tipo === "encargo" && !p.es_servicio) { setPresentacion("anillado"); setTamano("A4"); setImprimirTapas(false); } }}>
                        <span className="font-semibold text-zinc-800">{p.nombre}</span>
                    {p.categoria && <span className="text-zinc-400 ml-2 text-xs">{p.categoria}</span>}
                        {p.precio_anillado != null && <span className="text-[#f5a623] ml-2 text-xs font-bold">{fmt(p.precio_anillado * (p.tipo === "encargo" && !p.es_servicio ? (1 - descuentoCatalogoPct / 100) : 1))}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1.5">
                  Archivos PDF <span className="text-zinc-300 font-normal normal-case">(varios)</span>
                </label>
                <label className="flex items-center gap-2 border-2 border-dashed border-zinc-200 rounded-xl px-3 py-2 cursor-pointer hover:border-[#f5a623] hover:bg-amber-50 transition h-[38px]">
                  <input ref={fileInputRef} type="file" accept="application/pdf" multiple className="hidden"
                    onChange={handlePDFs} suppressHydrationWarning />
                  <span className="text-lg">📄</span>
                  <span className="text-sm text-zinc-400">Agregar PDF(s)</span>
                </label>
              </div>
            </div>

            {pdfs.length > 0 && (
              <div className="space-y-1.5">
                {pdfs.map((p) => {
                  const pHojas  = p.paginas ? calcHojas(p.paginas) : null;
                  return (
                    <div key={p.id} className="flex items-center gap-2 bg-gradient-to-r from-zinc-50 to-amber-50 rounded-xl px-3 py-2.5 text-xs border border-zinc-100">
                      <span className="text-base shrink-0">📄</span>
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-semibold text-zinc-700">{p.file.name}</p>
                        <p className="text-zinc-400 text-[10px]">
                          {fmtSize(p.file.size)}
                          {(() => { const eta = fmtEtaEstimado(p.file.size); return eta ? <span className="ml-1.5 text-amber-500 font-medium">subida {eta}</span> : null; })()}
                        </p>
                      </div>
                      {p.contando ? (
                        <span className="text-zinc-400 italic shrink-0">contando...</span>
                      ) : (
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-zinc-400">{p.paginas} pág</span>
                          {pHojas !== null && <span className="text-zinc-500 font-medium">{pHojas} hojas</span>}
                        </div>
                      )}
                      <button type="button" onClick={() => setPdfs((prev) => prev.filter((x) => x.id !== p.id))}
                        className="text-zinc-300 hover:text-red-500 shrink-0 text-base transition ml-1">×</button>
                    </div>
                  );
                })}
                {todoContado && pdfs.length > 1 && (
                  <div className="flex items-center gap-3 px-3 py-2 bg-[#f5a623]/10 rounded-xl border border-[#f5a623]/20 text-xs font-semibold">
                    <span className="text-zinc-600">Total: {totalPaginas} pág</span>
                    <span className="text-zinc-400">·</span>
                    <span className="text-zinc-600">{totalHojas} hojas</span>
                    <span className="text-zinc-400">·</span>
                    <span className="text-[#f5a623] font-black">{cotizandoTrabajo ? "Calculando…" : fmt(precioFinal)}</span>
                  </div>
                )}
              </div>
            )}

            <div>
              <p className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-3">Tipo de impresión</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border-2 border-amber-100 bg-amber-50/50 p-3">
                  <p className="text-xs font-black text-amber-600 uppercase tracking-wide mb-2">Faz</p>
                  <div className="flex gap-2 flex-wrap">
                    <OptBtn sel={faz === "simple"} onClick={() => handleFaz("simple")} accent="amber"
                      icon={<IcoSimpleFaz s={faz === "simple"} />} label="Simple" />
                    <OptBtn sel={faz === "doble"} onClick={() => handleFaz("doble")} accent="amber"
                      icon={<IcoDobleFaz s={faz === "doble"} />} label="Doble" />
                  </div>
                </div>
                <div className="rounded-2xl border-2 border-cyan-100 bg-cyan-50/50 p-3">
                  <p className="text-xs font-black text-cyan-600 uppercase tracking-wide mb-2">Páginas / hoja</p>
                  <div className="flex gap-2 flex-wrap">
                    {([1, 2, 4] as PagPorHoja[]).map((n) => (
                      <OptBtn key={n} sel={pagPorHoja === n} onClick={() => setPagPorHoja(n)} accent="cyan"
                        icon={<IcoPag n={n} s={pagPorHoja === n} />} label={`${n} p/h`} />
                    ))}
                  </div>
                </div>
                <div className="col-span-2 rounded-2xl border-2 border-emerald-100 bg-emerald-50/50 p-3">
                  <p className="text-xs font-black text-emerald-700 uppercase tracking-wide mb-2">Papel y tamaño</p>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="grid gap-1 text-xs font-semibold text-zinc-600">
                      Papel
                      <select value={papel} onChange={(e) => setPapel(e.target.value as PapelCodigo)}
                        className="rounded-xl border-2 border-zinc-200 bg-white px-3 py-2 text-sm font-normal focus:outline-none focus:border-emerald-500">
                        {PAPELES.map((item) => <option key={item.codigo} value={item.codigo}>{item.nombre}</option>)}
                      </select>
                    </label>
                    <label className="grid gap-1 text-xs font-semibold text-zinc-600">
                      Tamaño
                      <select value={tamano} onChange={(e) => {
                        const siguiente = e.target.value as Tamano;
                        setTamano(siguiente);
                        if (siguiente !== "A4" && presentacion === "encuadernado") setPresentacion("suelto");
                      }} className="rounded-xl border-2 border-zinc-200 bg-white px-3 py-2 text-sm font-normal focus:outline-none focus:border-emerald-500">
                        <option value="A3">A3</option>
                        <option value="A4">A4</option>
                        <option value="A5">A5</option>
                      </select>
                    </label>
                  </div>
                </div>
                <div className="col-span-2 rounded-2xl border-2 border-violet-100 bg-violet-50/50 p-3">
                  <p className="text-xs font-black text-violet-600 uppercase tracking-wide mb-2">Presentación</p>
                  <div className="flex gap-2 flex-wrap">
                    <OptBtn sel={presentacion === "suelto"} onClick={() => { setPresentacion("suelto"); setImprimirTapas(false); }} accent="violet"
                      icon={<IcoSinEnc s={presentacion === "suelto"} />} label="Suelto" />
                    {!esApunteCatalogo && <OptBtn sel={presentacion === "abrochado"} onClick={() => { setPresentacion("abrochado"); setImprimirTapas(false); }} accent="violet"
                      icon={<IcoAbrochado s={presentacion === "abrochado"} />} label="Abrochado" />}
                    <OptBtn sel={presentacion === "anillado"} onClick={() => { setPresentacion("anillado"); setImprimirTapas(false); }} accent="violet"
                      icon={<IcoAnillado s={presentacion === "anillado"} />} label="Anillado" />
                    {tamano === "A4" && <OptBtn sel={presentacion === "encuadernado"} onClick={() => setPresentacion("encuadernado")} accent="violet"
                      icon={<IcoEncuadernado s={presentacion === "encuadernado"} />} label="Encuadernado" />
                    }
                  </div>
                  {presentacion === "encuadernado" && (
                    <button type="button" onClick={() => setImprimirTapas((v) => !v)}
                      className={`mt-2 w-full flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-xs font-bold transition ${
                        imprimirTapas
                          ? "border-violet-500 bg-violet-100 text-violet-800"
                          : "border-zinc-200 bg-white text-zinc-500 hover:border-violet-300"
                      }`}>
                      <span className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${imprimirTapas ? "border-violet-500 bg-violet-500" : "border-zinc-300"}`}>
                        {imprimirTapas && <span className="text-white text-[10px] leading-none">✓</span>}
                      </span>
                      Imprimir tapa y contratapa
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1.5">Anotación</label>
              <input value={anotacion} onChange={(e) => setAnotacion(e.target.value)}
                suppressHydrationWarning placeholder="Notas especiales (opcional)"
                className="w-full rounded-xl border-2 border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:border-[#f5a623] transition" />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1.5">Cantidad</label>
              <input type="number" min="1" step="1" value={cantidad} onChange={(e) => setCantidad(e.target.value)}
                suppressHydrationWarning className="w-32 rounded-xl border-2 border-zinc-200 px-3 py-2 text-sm font-bold focus:outline-none focus:border-[#f5a623] transition" />
              <p className="mt-1 text-xs text-zinc-400">Precio unitario: {fmt(precioFinal)}</p>
            </div>

            {hayTrabajo && todoContado && (
              <div className="rounded-2xl border-2 border-amber-100 bg-amber-50/40 p-4">
                <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest mb-2">Desglose</p>
                {cotizandoTrabajo || !cotizacionTrabajo ? (
                  <p className="text-sm text-zinc-500">Calculando con el motor de precios vigente…</p>
                ) : <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between text-zinc-700">
                    <span>Impresión · {totalHojas} {totalHojas === 1 ? "hoja" : "hojas"} · {PAPELES.find((item) => item.codigo === papel)?.nombre} {tamano}</span>
                    <span className="font-semibold">{fmt(precioBase)}</span>
                  </div>
                  {desc > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span>Descuento ({desc}%)</span>
                      <span className="font-semibold">−{fmt(descuentoMonto)}</span>
                    </div>
                  )}
                  {extraPresentacion > 0 && (
                    <div className="flex justify-between text-zinc-700">
                      <span>{presentacion === "anillado" ? "Anillado" : "Encuadernado"}</span>
                      <span className="font-semibold">+{fmt(extraPresentacion)}</span>
                    </div>
                  )}
                  {cantidadReal > 1 && <div className="flex justify-between text-zinc-700"><span>{cantidadReal} unidades × {fmt(precioFinal)}</span><span className="font-semibold">{fmt(subtotalItem)}</span></div>}
                  <div className="flex justify-between pt-2 border-t border-amber-200 text-[#1a1a2e] font-black text-base">
                    <span>Total del ítem</span>
                    <span>{fmt(subtotalItem)}</span>
                  </div>
                </div>}
              </div>
            )}

            {esApunteCatalogo && descuentoCatalogoPct > 0 && (
              <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
                Este apunte registrado incluye {descuentoCatalogoPct}% de descuento sobre su precio de catálogo.
              </p>
            )}

            <button type="button" onClick={agregarItem} disabled={!canAdd}
              className="w-full py-3 rounded-xl bg-[#1a1a2e] text-white font-black text-sm hover:bg-[#16213e] disabled:opacity-40 transition shadow-lg">
              {cotizandoTrabajo ? "Calculando…" : "+ Agregar al pedido"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
