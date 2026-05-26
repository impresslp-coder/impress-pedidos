"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  eliminarPedidoOperacion,
  entregarPedidoRapido,
  guardarUbicacionesPedido,
  moverPedidosSucursal,
  registrarQuejaPedido,
} from "./actions";

const ESTADOS = ["Todos", "Presupuesto", "Encargo recibido", "En proceso", "Listo para retirar", "Entregado", "Cancelado"];

type ItemPedido = { producto: string | null; precio: number | null; paginas?: number | null; modo?: string | null };
type Sucursal = { id: string; nombre: string };
type MercadoPagoMovimiento = {
  id: string;
  status: string;
  hora: string;
  amount: number;
  description: string;
  payment_method_id: string;
  payment_type_id: string;
  payer_name: string;
  payer_email: string;
  date_created?: string | null;
  date_approved?: string | null;
};

export type FilaUnificada = {
  id: string;
  numero: string;
  codigo_unico?: string | null;
  fecha: string | null;
  estado: string | null;
  sucursal: string | null;
  ubicacion: string | null;
  cliente: string;
  telefono: string | null;
  cod_pais: string | null;
  tipo: "pedido" | "terciarizado";
  href: string;
  senia: number;
  total: number;
  items: ItemPedido[];
  eliminado: boolean;
  prioridad: string | null;
  queja_motivo: string | null;
};

const fmt = (value: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(value);
const normalize = (value: string) => value.trim().toLowerCase();

function matchesBarcode(pedido: FilaUnificada, query: string) {
  if (pedido.tipo !== "pedido") return false;
  const q = normalize(query);
  if (!q) return false;
  return (
    q === normalize(pedido.numero) ||
    q === normalize(String(parseInt(pedido.numero, 10) || pedido.numero)) ||
    (!!pedido.codigo_unico && q === normalize(pedido.codigo_unico))
  );
}

export default function PedidosListClient({
  filas,
  sucursales,
  initialQ = "",
  initialEstado = "Todos",
}: {
  filas: FilaUnificada[];
  sucursales: Sucursal[];
  initialQ?: string;
  initialEstado?: string;
}) {
  const [q, setQ] = useState(initialQ);
  const [estado, setEstado] = useState(initialEstado || "Todos");
  const [rows, setRows] = useState(filas);
  const [showDeleted, setShowDeleted] = useState(false);
  const [entrega, setEntrega] = useState<FilaUnificada | null>(null);
  const [entregadosOpen, setEntregadosOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [ubicacionOpen, setUbicacionOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FilaUnificada | null>(null);
  const [quejaTarget, setQuejaTarget] = useState<FilaUnificada | null>(null);
  const [lastOpenedId, setLastOpenedId] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  const visibles = useMemo(
    () => rows.filter((r) => showDeleted ? r.eliminado : !r.eliminado && r.estado !== "Entregado"),
    [rows, showDeleted],
  );
  const prioridadRows = visibles.filter((r) => r.prioridad === "queja" || r.queja_motivo);

  const filtrados = useMemo(() => {
    const txt = normalize(q);
    return visibles.filter((p) => {
      if (estado && estado !== "Todos" && p.estado !== estado) return false;
      if (!txt) return true;
      return [p.numero, String(parseInt(p.numero, 10) || ""), p.codigo_unico ?? "", p.cliente, p.ubicacion ?? ""]
        .some((field) => normalize(field).includes(txt));
    });
  }, [visibles, q, estado]);

  useEffect(() => {
    const exact = rows.find((p) => !p.eliminado && matchesBarcode(p, q));
    if (!exact || exact.id === lastOpenedId || entrega?.id === exact.id) return;
    if (exact.estado === "Listo para retirar") {
      setEntrega(exact);
      setLastOpenedId(exact.id);
      setModalError(null);
    } else {
      setModalError(`Pedido ${exact.numero}: estado actual "${exact.estado ?? "-"}". Solo se puede entregar si esta listo para retirar.`);
      setLastOpenedId(exact.id);
    }
  }, [rows, q, lastOpenedId, entrega?.id]);

  const patchRow = (id: string, patch: Partial<FilaUnificada>) =>
    setRows((prev) => prev.map((row) => row.id === id ? { ...row, ...patch } : row));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2 items-end">
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setModalError(null);
            if (!e.target.value.trim()) setLastOpenedId(null);
          }}
          placeholder="Buscar nro, cliente o escanear codigo..."
          suppressHydrationWarning
          autoFocus
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#f5a623] w-72"
        />
        <select value={estado} onChange={(e) => setEstado(e.target.value)}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#f5a623]">
          {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        <button type="button" onClick={() => setTransferOpen(true)}
          className="px-4 py-2 rounded-lg bg-[#1a1a2e] text-white text-sm font-bold hover:bg-zinc-800">
          Pasar de sucursal
        </button>
        <button type="button" onClick={() => setUbicacionOpen(true)}
          className="px-4 py-2 rounded-lg bg-zinc-800 text-white text-sm font-bold hover:bg-zinc-700">
          Establecer ubicacion
        </button>
        <button type="button" onClick={() => setEntregadosOpen(true)}
          className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700">
          Entregados
        </button>
        <button type="button" onClick={() => setShowDeleted((v) => !v)}
          className="px-4 py-2 rounded-lg bg-zinc-200 text-zinc-700 text-sm font-bold hover:bg-zinc-300">
          {showDeleted ? "Ver activos" : "Eliminados"}
        </button>
        {(estado !== "Todos" || q) && (
          <button type="button" onClick={() => { setQ(""); setEstado("Todos"); setLastOpenedId(null); }}
            className="px-4 py-2 rounded-lg bg-zinc-200 text-zinc-700 text-sm hover:bg-zinc-300">
            Limpiar
          </button>
        )}
      </div>

      {modalError && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{modalError}</p>}

      {prioridadRows.length > 0 && !showDeleted && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3">
          <p className="text-xs font-black uppercase tracking-wide text-red-700 mb-2">Prioridad por aviso de queja</p>
          <div className="flex flex-wrap gap-2">
            {prioridadRows.map((p) => (
              <span key={p.id} className="rounded-lg bg-white border border-red-200 px-3 py-1 text-sm text-red-700">
                <b>{p.numero}</b> - {p.cliente}: {p.queja_motivo}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-x-auto">
        {filtrados.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <Th>Nro</Th><Th>Cliente</Th><Th>Estado</Th><Th>Sucursal</Th><Th>Ubicacion</Th><Th>Ver</Th><Th>Eliminar</Th><Th>Aviso de queja</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filtrados.map((p) => (
                <tr key={`${p.tipo}-${p.id}`} className={[
                  "hover:bg-zinc-50 transition",
                  p.queja_motivo ? "bg-red-50/70" : "",
                  p.eliminado ? "opacity-60 bg-zinc-50" : "",
                ].join(" ")}>
                  <td className="px-4 py-3 font-mono font-bold text-[#1a1a2e]">
                    {p.numero} {p.tipo === "terciarizado" && <span className="ml-2 inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#f5a623] text-[#1a1a2e]">E</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-zinc-800">{p.cliente}</div>
                    {p.telefono && <a href={`https://wa.me/${p.cod_pais ?? "54"}${p.telefono}`} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-600 hover:underline">{p.telefono}</a>}
                  </td>
                  <td className="px-4 py-3"><EstadoBadge estado={p.estado} /></td>
                  <td className="px-4 py-3 text-zinc-500">{p.sucursal || "-"}</td>
                  <td className="px-4 py-3 text-zinc-600 max-w-[180px] truncate">{p.ubicacion || "-"}</td>
                  <td className="px-4 py-3"><Link href={p.href} className="text-blue-600 hover:underline text-xs font-bold">Ver &rarr;</Link></td>
                  <td className="px-4 py-3">
                    {p.tipo === "pedido" && !p.eliminado && (
                      <button type="button" onClick={() => setDeleteTarget(p)} className="text-xs font-bold text-red-600 hover:underline">Eliminar</button>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {p.tipo === "pedido" && !p.eliminado && (
                      <button type="button" onClick={() => setQuejaTarget(p)} className="text-xs font-bold text-amber-700 hover:underline">
                        {p.queja_motivo ? "Editar queja" : "Aviso de queja"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="text-zinc-400 text-center py-12">Sin pedidos</p>}
      </div>

      <p className="text-xs text-zinc-400">Mostrando {filtrados.length} registros</p>

      {entrega && <EntregaModal pedido={entrega} onClose={() => setEntrega(null)} onDelivered={(id) => { patchRow(id, { estado: "Entregado", senia: entrega.total }); setEntrega(null); setQ(""); setLastOpenedId(null); }} />}
      {entregadosOpen && <EntregadosModal rows={rows.filter((r) => r.tipo === "pedido" && !r.eliminado && r.estado === "Entregado")} sucursales={sucursales} onClose={() => setEntregadosOpen(false)} />}
      {transferOpen && <TransferModal rows={rows.filter((r) => r.tipo === "pedido" && !r.eliminado)} sucursales={sucursales} onClose={() => setTransferOpen(false)} onSaved={(updates) => { updates.forEach((u) => patchRow(u.pedidoId, { sucursal: u.sucursal })); setTransferOpen(false); }} />}
      {ubicacionOpen && <UbicacionModal rows={rows.filter((r) => r.tipo === "pedido" && !r.eliminado && r.estado === "Listo para retirar" && !r.ubicacion)} onClose={() => setUbicacionOpen(false)} onSaved={(updates) => { updates.forEach((u) => patchRow(u.pedidoId, { ubicacion: u.ubicacion })); setUbicacionOpen(false); }} />}
      {deleteTarget && <DeleteModal pedido={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={(id) => { patchRow(id, { eliminado: true }); setDeleteTarget(null); }} />}
      {quejaTarget && <QuejaModal pedido={quejaTarget} onClose={() => setQuejaTarget(null)} onSaved={(id, motivo) => { patchRow(id, { prioridad: "queja", queja_motivo: motivo }); setQuejaTarget(null); }} />}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left px-4 py-3 font-semibold text-zinc-600">{children}</th>;
}

function OperatorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">Codigo personal</span>
      <input type="password" value={value} onChange={(e) => onChange(e.target.value)} suppressHydrationWarning
        className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#f5a623]" />
    </label>
  );
}

function ModalShell({ title, children, footer, onClose, wide = false }: { title: string; children: React.ReactNode; footer: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3">
      <div className={`bg-white rounded-xl shadow-2xl w-full ${wide ? "max-w-[92vw]" : "max-w-2xl"} max-h-[88vh] overflow-hidden flex flex-col`}>
        <div className="px-5 py-3 border-b border-zinc-200 flex items-center justify-between gap-4 shrink-0">
          <h2 className="text-xl font-black text-[#1a1a2e]">{title}</h2>
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-zinc-700 text-2xl leading-none">x</button>
        </div>
        <div className="p-5 overflow-auto flex-1">{children}</div>
        <div className="px-5 py-3 border-t border-zinc-200 shrink-0">{footer}</div>
      </div>
    </div>
  );
}

function EntregaModal({ pedido, onClose, onDelivered }: { pedido: FilaUnificada; onClose: () => void; onDelivered: (pedidoId: string) => void }) {
  const restante = Math.max(0, pedido.total - pedido.senia);
  const [monto, setMonto] = useState(restante ? String(restante) : "");
  const [medioPago, setMedioPago] = useState("efectivo");
  const [codigo, setCodigo] = useState("");
  const [mpMovements, setMpMovements] = useState<MercadoPagoMovimiento[]>([]);
  const [mpSelected, setMpSelected] = useState<MercadoPagoMovimiento | null>(null);
  const [mpLoading, setMpLoading] = useState(false);
  const [mpError, setMpError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const vuelto = Math.max(0, (Number(monto) || 0) - restante);

  const cargarMercadoPago = async () => {
    setMpLoading(true);
    setMpError(null);
    try {
      const res = await fetch("/api/mercadopago/movimientos", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "No pude consultar Mercado Pago");
      setMpMovements(data.movements ?? []);
    } catch (err) {
      setMpError(err instanceof Error ? err.message : String(err));
    } finally {
      setMpLoading(false);
    }
  };

  useEffect(() => {
    if (medioPago === "transferencia" && mpMovements.length === 0 && !mpLoading) {
      cargarMercadoPago();
    }
  }, [medioPago]);

  const confirmar = () => {
    if (restante > 0 && (Number(monto) || 0) < restante) return setError("El monto recibido es menor al restante a abonar.");
    startTransition(() => entregarPedidoRapido(pedido.id, medioPago, codigo, medioPago === "transferencia" ? mpSelected : null).then((res) => res?.error ? setError(res.error) : onDelivered(pedido.id)));
  };

  return (
    <ModalShell title={`Entrega de pedido ${pedido.numero}`} onClose={onClose} footer={<ModalButtons error={error} pending={isPending} onCancel={onClose} onConfirm={confirmar} confirmText="Marcar como entregado" />}>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_250px] gap-5">
        <div className="rounded-lg border border-zinc-200 divide-y divide-zinc-100 max-h-72 overflow-y-auto">
          {pedido.items.map((item, index) => (
            <div key={index} className="px-3 py-2 flex justify-between gap-3">
              <p className="font-semibold text-zinc-800 text-sm">{item.producto || "-"}</p>
              <p className="font-black text-zinc-800 text-sm">{fmt(Number(item.precio) || 0)}</p>
            </div>
          ))}
        </div>
        <div className="space-y-3">
          <div className="rounded-lg bg-[#1a1a2e] p-4 text-white">
            <p className="text-xs uppercase tracking-wide text-white/60">Restante a abonar</p>
            <p className="text-3xl font-black text-[#fff200] mt-1">{fmt(restante)}</p>
            <p className="text-xs text-white/70 mt-2">Total {fmt(pedido.total)} - Abonado {fmt(pedido.senia)}</p>
          </div>
          <label className="block"><span className="block text-xs font-bold text-zinc-500 uppercase mb-1">Paga con</span><input type="number" min="0" step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-lg font-black" /></label>
          <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2"><p className="text-xs font-bold uppercase text-emerald-700">Vuelto</p><p className="text-2xl font-black text-emerald-700">{fmt(vuelto)}</p></div>
          <label className="block"><span className="block text-xs font-bold text-zinc-500 uppercase mb-1">Medio de pago restante</span><select value={medioPago} onChange={(e) => setMedioPago(e.target.value)} className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"><PagoOptions /></select></label>
          {medioPago === "transferencia" && (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-black uppercase tracking-wide text-zinc-600">Mercado Pago hoy</p>
                <button type="button" onClick={cargarMercadoPago} disabled={mpLoading}
                  className="px-2 py-1 rounded-md bg-[#1a1a2e] text-white text-xs font-bold disabled:opacity-50">
                  {mpLoading ? "Actualizando..." : "Actualizar"}
                </button>
              </div>
              {mpError && <p className="text-xs text-red-600 bg-red-50 rounded-md px-2 py-1">{mpError}</p>}
              <div className="max-h-52 overflow-y-auto space-y-1">
                {mpMovements.length === 0 && !mpLoading ? (
                  <p className="text-xs text-zinc-400">Sin movimientos cargados.</p>
                ) : mpMovements.map((mov) => (
                  <label key={mov.id} className={[
                    "flex items-start gap-2 rounded-md border px-2 py-2 bg-white cursor-pointer",
                    mpSelected?.id === mov.id ? "border-[#f5a623] ring-1 ring-[#f5a623]" : "border-zinc-200",
                  ].join(" ")}>
                    <input
                      type="checkbox"
                      checked={mpSelected?.id === mov.id}
                      onChange={(e) => setMpSelected(e.target.checked ? mov : null)}
                      className="mt-1"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <b className="text-xs text-zinc-800">{mov.hora || "--:--"}</b>
                        <b className="text-sm text-zinc-900">{fmt(mov.amount)}</b>
                      </span>
                      <span className="block text-[11px] text-zinc-500 truncate">
                        #{mov.id} · {mov.status} · {mov.payment_type_id || mov.payment_method_id}
                      </span>
                      {(mov.payer_name || mov.payer_email || mov.description) && (
                        <span className="block text-[11px] text-zinc-400 truncate">{mov.payer_name || mov.payer_email || mov.description}</span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <OperatorInput value={codigo} onChange={setCodigo} />
        </div>
      </div>
    </ModalShell>
  );
}

function TransferModal({ rows, sucursales, onClose, onSaved }: { rows: FilaUnificada[]; sucursales: Sucursal[]; onClose: () => void; onSaved: (updates: { pedidoId: string; sucursal: string | null }[]) => void }) {
  const [draft, setDraft] = useState<Record<string, string | null>>(() => Object.fromEntries(rows.map((r) => [r.id, r.sucursal])));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<Record<string, string | null>[]>([]);
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const cols = [{ id: "__sin__", nombre: "Sin sucursal", value: null as string | null }, ...sucursales.map((s) => ({ id: s.id, nombre: s.nombre, value: s.nombre as string | null }))];
  const moveTo = (target: string | null) => {
    const ids = selected.size ? Array.from(selected) : [];
    if (!ids.length) return;
    setHistory((h) => [...h, draft]);
    setDraft((prev) => ({ ...prev, ...Object.fromEntries(ids.map((id) => [id, target])) }));
  };
  const changed = rows.filter((r) => (draft[r.id] ?? null) !== (r.sucursal ?? null)).map((r) => ({ pedidoId: r.id, sucursal: draft[r.id] ?? null }));
  const save = () => startTransition(() => moverPedidosSucursal(changed, codigo).then((res) => res?.error ? setError(res.error) : onSaved(changed)));

  return (
    <ModalShell title="Pasar de sucursal" wide onClose={onClose} footer={<ModalButtons error={error} pending={isPending} onCancel={onClose} onConfirm={save} confirmText="Aceptar cambios" extra={<><button type="button" onClick={() => setHistory((h) => { const last = h[h.length - 1]; if (last) setDraft(last); return h.slice(0, -1); })} className="px-4 py-2 rounded-lg bg-zinc-200 text-zinc-700 text-sm font-bold">Deshacer</button><OperatorInput value={codigo} onChange={setCodigo} /></>} />}>
      <p className="text-xs text-zinc-500 mb-3">Tilda uno o varios pedidos y arrastralos a la columna destino. Tambien podés soltar cualquier pedido seleccionado sobre una sucursal.</p>
      <div className="flex gap-3 min-w-max">
        {cols.map((col) => (
          <div key={col.id} onDragOver={(e) => e.preventDefault()} onDrop={() => moveTo(col.value)} className="rounded-lg border border-zinc-200 bg-zinc-50 w-44 max-h-[56vh] p-2 flex flex-col">
            <h3 className="font-black text-sm text-zinc-700 mb-2 shrink-0">{col.nombre}</h3>
            <div className="space-y-2 overflow-y-auto pr-1">
              {rows.filter((r) => (draft[r.id] ?? null) === col.value).map((r) => (
                <label key={r.id} draggable onDragStart={() => { if (!selected.has(r.id)) setSelected(new Set([r.id])); }} className="flex items-center gap-2 rounded-md bg-white border border-zinc-200 px-2 py-1.5 cursor-move">
                  <input type="checkbox" checked={selected.has(r.id)} onChange={(e) => setSelected((prev) => { const next = new Set(prev); e.target.checked ? next.add(r.id) : next.delete(r.id); return next; })} />
                  <span className="font-mono font-bold text-xs">{r.numero}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </ModalShell>
  );
}

function EntregadosModal({ rows, sucursales, onClose }: { rows: FilaUnificada[]; sucursales: Sucursal[]; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [sucursal, setSucursal] = useState("Todas");
  const filtrados = useMemo(() => {
    const txt = normalize(q);
    return rows.filter((p) => {
      if (sucursal !== "Todas" && (p.sucursal || "") !== sucursal) return false;
      if (!txt) return true;
      return [p.numero, String(parseInt(p.numero, 10) || ""), p.cliente, p.telefono ?? "", p.ubicacion ?? ""]
        .some((field) => normalize(field).includes(txt));
    });
  }, [rows, q, sucursal]);

  return (
    <ModalShell
      title="Pedidos entregados"
      wide
      onClose={onClose}
      footer={
        <div className="flex justify-between items-center gap-3">
          <p className="text-xs text-zinc-400">Mostrando {filtrados.length} de {rows.length}</p>
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-zinc-200 text-zinc-700 text-sm font-bold">Cerrar</button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filtrar entregados por nro, cliente, telefono..."
            suppressHydrationWarning
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#f5a623] w-80"
          />
          <select
            value={sucursal}
            onChange={(e) => setSucursal(e.target.value)}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#f5a623]"
          >
            <option value="Todas">Todas las sucursales</option>
            <option value="">Sin sucursal</option>
            {sucursales.map((s) => <option key={s.id} value={s.nombre}>{s.nombre}</option>)}
          </select>
        </div>
        <div className="border border-zinc-200 rounded-lg overflow-x-auto max-h-[60vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 sticky top-0">
              <tr>
                <Th>Nro</Th><Th>Cliente</Th><Th>Sucursal</Th><Th>Ubicacion</Th><Th>Total</Th><Th>Fecha</Th><Th>Ver</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filtrados.map((p) => (
                <tr key={p.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-3 font-mono font-bold">{p.numero}</td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-zinc-800">{p.cliente}</div>
                    {p.telefono && <p className="text-xs text-emerald-600">{p.telefono}</p>}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{p.sucursal || "-"}</td>
                  <td className="px-4 py-3 text-zinc-500">{p.ubicacion || "-"}</td>
                  <td className="px-4 py-3 font-black text-zinc-800">{fmt(p.total)}</td>
                  <td className="px-4 py-3 text-zinc-500">{p.fecha ? new Date(p.fecha).toLocaleDateString("es-AR") : "-"}</td>
                  <td className="px-4 py-3"><Link href={p.href} className="text-blue-600 hover:underline text-xs font-bold">Ver &rarr;</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtrados.length === 0 && <p className="text-center text-zinc-400 py-10">Sin entregados para ese filtro</p>}
        </div>
      </div>
    </ModalShell>
  );
}

function UbicacionModal({ rows, onClose, onSaved }: { rows: FilaUnificada[]; onClose: () => void; onSaved: (updates: { pedidoId: string; ubicacion: string }[]) => void }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const updates = Object.entries(values).filter(([, ubicacion]) => ubicacion.trim()).map(([pedidoId, ubicacion]) => ({ pedidoId, ubicacion }));
  const save = () => startTransition(() => guardarUbicacionesPedido(updates, codigo).then((res) => res?.error ? setError(res.error) : onSaved(updates)));
  return (
    <ModalShell title="Establecer ubicacion" onClose={onClose} footer={<ModalButtons error={error} pending={isPending} onCancel={onClose} onConfirm={save} confirmText="Guardar ubicaciones" extra={<OperatorInput value={codigo} onChange={setCodigo} />} />}>
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {rows.length === 0 ? <p className="text-sm text-zinc-400">No hay pedidos listos para retirar sin ubicacion.</p> : rows.map((r) => (
          <label key={r.id} className="grid grid-cols-[110px_1fr] gap-2 items-center">
            <span className="font-mono font-bold text-sm">{r.numero}</span>
            <input value={values[r.id] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [r.id]: e.target.value }))} placeholder="Texto libre de ubicacion" className="rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
          </label>
        ))}
      </div>
    </ModalShell>
  );
}

function DeleteModal({ pedido, onClose, onDeleted }: { pedido: FilaUnificada; onClose: () => void; onDeleted: (id: string) => void }) {
  const [codigo, setCodigo] = useState(""); const [error, setError] = useState<string | null>(null); const [isPending, startTransition] = useTransition();
  const confirm = () => startTransition(() => eliminarPedidoOperacion(pedido.id, codigo).then((res) => res?.error ? setError(res.error) : onDeleted(pedido.id)));
  return <ModalShell title={`Eliminar pedido ${pedido.numero}`} onClose={onClose} footer={<ModalButtons error={error} pending={isPending} onCancel={onClose} onConfirm={confirm} confirmText="Si, eliminar" danger extra={<OperatorInput value={codigo} onChange={setCodigo} />} />}><p className="text-sm text-zinc-600">El pedido pasa a la lista de eliminados. Esta accion pide codigo de operador.</p></ModalShell>;
}

function QuejaModal({ pedido, onClose, onSaved }: { pedido: FilaUnificada; onClose: () => void; onSaved: (id: string, motivo: string) => void }) {
  const [motivo, setMotivo] = useState(pedido.queja_motivo ?? ""); const [codigo, setCodigo] = useState(""); const [error, setError] = useState<string | null>(null); const [isPending, startTransition] = useTransition();
  const confirm = () => startTransition(() => registrarQuejaPedido(pedido.id, motivo, codigo).then((res) => res?.error ? setError(res.error) : onSaved(pedido.id, motivo)));
  return <ModalShell title={`Aviso de queja ${pedido.numero}`} onClose={onClose} footer={<ModalButtons error={error} pending={isPending} onCancel={onClose} onConfirm={confirm} confirmText="Guardar queja" extra={<OperatorInput value={codigo} onChange={setCodigo} />} />}><label className="block"><span className="block text-xs font-bold text-zinc-500 uppercase mb-1">Motivo de queja</span><textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} className="w-full min-h-32 rounded-lg border border-zinc-300 px-3 py-2 text-sm" /></label></ModalShell>;
}

function ModalButtons({ error, pending, onCancel, onConfirm, confirmText, danger, extra }: { error: string | null; pending: boolean; onCancel: () => void; onConfirm: () => void; confirmText: string; danger?: boolean; extra?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-end gap-2">
      {error && <p className="mr-auto text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      {extra}
      <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg bg-zinc-200 text-zinc-700 text-sm font-bold">Cancelar</button>
      <button type="button" onClick={onConfirm} disabled={pending} className={`px-5 py-2 rounded-lg text-sm font-black disabled:opacity-50 ${danger ? "bg-red-600 text-white" : "bg-[#f5a623] text-[#1a1a2e]"}`}>{pending ? "Guardando..." : confirmText}</button>
    </div>
  );
}

function PagoOptions() {
  return <><option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option><option value="pendiente">Pendiente de pago</option><option value="debito">Debito</option><option value="credito">Credito</option><option value="qr">QR / Mercado Pago</option></>;
}

function EstadoBadge({ estado }: { estado: string | null }) {
  const colores: Record<string, string> = {
    "Encargo recibido": "bg-blue-100 text-blue-700",
    "En proceso": "bg-amber-100 text-amber-700",
    "Listo para retirar": "bg-emerald-100 text-emerald-700",
    "Entregado": "bg-zinc-100 text-zinc-500",
    "Cancelado": "bg-red-100 text-red-600",
  };
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${colores[estado ?? ""] ?? "bg-zinc-100 text-zinc-500"}`}>{estado ?? "-"}</span>;
}
