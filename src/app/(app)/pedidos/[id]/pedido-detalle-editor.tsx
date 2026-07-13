"use client";

import { useMemo, useState, useTransition } from "react";
import { actualizarEstado, actualizarEstadoArchivo, guardarDetallePedido } from "./actions";

type Pedido = Record<string, any>;
type Item = Record<string, any>;

const ESTADOS = ["Encargo recibido", "En proceso", "Listo para retirar", "Entregado", "Cancelado"];
const MEDIOS_PAGO = ["", "Efectivo", "Transferencia", "Debito", "Credito", "QR", "Cuenta corriente"];
const VIAS_CONTACTO = ["", "Presencial", "WhatsApp", "Telefono", "Instagram", "Email", "Facebook"];
const PRIORIDADES = ["normal", "urgente"];

const fmt = (n: number | null | undefined) =>
  n != null ? new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(n) : "-";

const dateTimeLocal = (value: string | null | undefined) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

function mercadoPagoFallback(mensaje: string | null | undefined) {
  const text = String(mensaje ?? "");
  const match = text.match(/MP:\s*(\d+)\s*\|\s*Monto:\s*([0-9.,]+)\s*\|\s*Hora:\s*([^\n]+)/);
  if (!match) return null;
  return { id: match[1], monto: match[2], hora: match[3] };
}

function cleanPedidoMensaje(mensaje: string | null | undefined) {
  return String(mensaje ?? "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("MP:"))
    .join("\n")
    .trim();
}

export default function PedidoDetalleEditor({
  pedido,
  itemsIniciales,
  archivos,
}: {
  pedido: Pedido;
  itemsIniciales: Item[];
  archivos: Item[];
}) {
  const [items, setItems] = useState<Item[]>(itemsIniciales);
  const [archivosLista, setArchivosLista] = useState<Item[]>(archivos);
  const [pedidoEstado, setPedidoEstado] = useState(pedido.estado ?? "Encargo recibido");
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [estadoPending, startEstadoTransition] = useTransition();
  const [msg, setMsg] = useState<string>();
  const [pendingAcceso, setPendingAcceso] = useState<
    | { kind: "descargar"; nombre: string; archivoId: string }
    | { kind: "imprimir"; nombre: string; archivoId: string }
    | null
  >(null);
  const [aplicandoCambio, setAplicandoCambio] = useState(false);

  const total = useMemo(
    () => items.reduce((acc, item) => acc + (Number(item.precio) || 0), 0),
    [items],
  );
  const mpFallback = mercadoPagoFallback(pedido.mensaje);
  const mensajePedido = cleanPedidoMensaje(pedido.mensaje);

  const updateItem = (id: string, key: string, value: string) => {
    setItems((prev) => prev.map((item) => item.id === id ? { ...item, [key]: value } : item));
  };

  const abrirImpressPrint = (archivoId: string) => {
    setMsg(undefined);
    fetch("/api/print-jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pedidoId: pedido.id, archivoId }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "No pude crear el trabajo de impresion");
        window.location.href = data.protocolUrl;
      })
      .catch((error) => setMsg(error.message));
  };

  const pasarAEnProceso = async () => {
    const res = await fetch(`/api/pedidos/${pedido.id}/estado`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: "En proceso" }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.error) {
      throw new Error(json.error ?? "No pude cambiar el estado del pedido");
    }
    setPedidoEstado("En proceso");
  };

  const iniciarAccesoArchivo = (
    accion:
      | { kind: "descargar"; nombre: string; archivoId: string }
      | { kind: "imprimir"; nombre: string; archivoId: string }
  ) => {
    if (pedidoEstado === "Encargo recibido") {
      setPendingAcceso(accion);
    } else {
      ejecutarAccion(accion);
    }
  };

  const ejecutarAccion = (
    accion:
      | { kind: "descargar"; nombre: string; archivoId: string }
      | { kind: "imprimir"; nombre: string; archivoId: string }
  ) => {
    if (accion.kind === "descargar") {
      window.open(`/api/archivos/${accion.archivoId}`, "_blank", "noopener,noreferrer");
    } else {
      abrirImpressPrint(accion.archivoId);
    }
  };

  const confirmarAcceso = async () => {
    if (!pendingAcceso) return;
    setAplicandoCambio(true);
    setMsg(undefined);
    try {
      await pasarAEnProceso();
      ejecutarAccion(pendingAcceso);
      setPendingAcceso(null);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Error al cambiar estado");
    }
    setAplicandoCambio(false);
  };

  const cambiarEstadoPedido = (nuevoEstado: string) => {
    setPedidoEstado(nuevoEstado);
    setMsg(undefined);
    startEstadoTransition(async () => {
      const res = await actualizarEstado(pedido.id, nuevoEstado);
      setMsg(res?.error ? res.error : "Estado guardado");
    });
  };

  const submit = (formData: FormData) => {
    setMsg(undefined);
    formData.set("items", JSON.stringify(items));
    startTransition(async () => {
      const res = await guardarDetallePedido(pedido.id, formData);
      if (res?.error) {
        setMsg(res.error);
      } else {
        setMsg("Pedido guardado");
        setEditing(false);
      }
    });
  };

  return (
    <form action={submit} className="space-y-6">
      <div className="flex justify-end gap-2">
        {!editing ? (
          <button type="button" onClick={() => setEditing(true)}
            className="px-4 py-2 rounded-lg bg-[#1a1a2e] text-white text-sm font-bold hover:bg-zinc-800 transition">
            Editar pedido
          </button>
        ) : (
          <button type="button" onClick={() => setEditing(false)}
            className="px-4 py-2 rounded-lg bg-zinc-200 text-zinc-700 text-sm font-semibold hover:bg-zinc-300 transition">
            Cancelar edicion
          </button>
        )}
      </div>

      <section className="bg-white rounded-xl border-2 border-[#f5a623] shadow-sm p-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-black text-[#1a1a2e] uppercase tracking-wide">Cosas a imprimir</h2>
          <span className="text-xs font-bold text-zinc-500">{archivosLista.length} archivo(s)</span>
        </div>
        {archivosLista.length === 0 ? (
          <p className="text-sm text-zinc-400">No hay archivos cargados para imprimir.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
                  <th className="text-left py-2 pr-3">Archivo</th>
                  <th className="text-left py-2 px-3">Indicaciones</th>
                  <th className="text-left py-2 px-3">Estado</th>
                  <th className="text-right py-2 pl-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {archivosLista.map((archivo) => (
                  <tr key={archivo.id} className="align-middle">
                    <td className="py-3 pr-3">
                      <button
                        type="button"
                        onClick={() => iniciarAccesoArchivo({
                          kind: "descargar",
                          nombre: archivo.nombre_archivo,
                          archivoId: archivo.id,
                        })}
                        className="font-semibold text-blue-700 hover:underline text-left"
                      >
                        {archivo.nombre_archivo}
                      </button>
                    </td>
                    <td className="py-3 px-3 text-zinc-600">
                      {archivo.copias ?? 1} cop. · {archivo.color ? "Color" : "B&N"} · {archivo.doble_faz ? "Doble faz" : "Simple"} · {archivo.tamano_papel ?? "A4"}
                    </td>
                    <td className="py-3 px-3">
                      <select
                        value={archivo.estado ?? pedidoEstado}
                        disabled={estadoPending}
                        onChange={(e) => {
                          const nuevoEstado = e.target.value;
                          setArchivosLista((prev) => prev.map((a) => a.id === archivo.id ? { ...a, estado: nuevoEstado } : a));
                          startEstadoTransition(async () => {
                            const res = await actualizarEstadoArchivo(pedido.id, archivo.id, nuevoEstado);
                            if (res?.estadoPedido) setPedidoEstado(res.estadoPedido);
                            if (res?.error) setMsg(res.error);
                          });
                        }}
                        className="rounded-md border border-zinc-300 px-2 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#f5a623]"
                      >
                        {ESTADOS.map((estado) => <option key={estado}>{estado}</option>)}
                      </select>
                    </td>
                    <td className="py-3 pl-3 text-right">
                      <button
                        type="button"
                        onClick={() => iniciarAccesoArchivo({
                          kind: "imprimir",
                          nombre: archivo.nombre_archivo,
                          archivoId: archivo.id,
                        })}
                        className="px-3 py-1.5 rounded-md bg-[#f5a623] text-[#1a1a2e] text-xs font-black hover:bg-amber-400 transition">
                        Imprimir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <section className="bg-white rounded-xl border border-zinc-200 shadow-sm p-5 space-y-4">
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Datos del pedido</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Fecha">
                <input name="fecha" type="datetime-local" defaultValue={dateTimeLocal(pedido.fecha)}
                  className="input" disabled={!editing} suppressHydrationWarning />
              </Field>
              <Field label="Estado">
                <select name="estado" value={pedidoEstado} onChange={(e) => cambiarEstadoPedido(e.target.value)} className="input" disabled={!editing || estadoPending}>
                  {ESTADOS.map((estado) => <option key={estado}>{estado}</option>)}
                </select>
              </Field>
              <Field label="Sena">
                <input name="senia" type="number" step="0.01" defaultValue={pedido.senia ?? 0}
                  className="input" disabled={!editing} suppressHydrationWarning />
              </Field>
              <Field label="Medio de pago">
                <select name="medio_pago" defaultValue={pedido.medio_pago ?? ""} className="input" disabled={!editing}>
                  {MEDIOS_PAGO.map((m) => <option key={m} value={m}>{m || "-"}</option>)}
                </select>
              </Field>
              <Field label="Via de contacto">
                <select name="via_contacto" defaultValue={pedido.via_contacto ?? ""} className="input" disabled={!editing}>
                  {VIAS_CONTACTO.map((v) => <option key={v} value={v}>{v || "-"}</option>)}
                </select>
              </Field>
              <Field label="Telefono contacto">
                <input name="telefono_contacto" defaultValue={pedido.telefono_contacto ?? ""}
                  className="input" disabled={!editing} suppressHydrationWarning />
              </Field>
              <Field label="Sucursal produccion">
                <input name="sucursal_produccion" defaultValue={pedido.sucursal_produccion ?? ""}
                  className="input" disabled={!editing} suppressHydrationWarning />
              </Field>
              <Field label="Sucursal retiro">
                <input name="sucursal_retiro" defaultValue={pedido.sucursal_retiro ?? ""}
                  className="input" disabled={!editing} suppressHydrationWarning />
              </Field>
              <Field label="Prioridad">
                <select name="prioridad" defaultValue={pedido.prioridad ?? "normal"} className="input" disabled={!editing}>
                  {PRIORIDADES.map((p) => <option key={p}>{p}</option>)}
                </select>
              </Field>
              <Field label="Codigo operador">
                <input name="quien_cargo_codigo" defaultValue={pedido.quien_cargo_codigo ?? ""}
                  className="input" disabled={!editing} suppressHydrationWarning />
              </Field>
              <div className="md:col-span-2">
                <Field label="Mensaje">
                  <textarea name="mensaje" defaultValue={mensajePedido}
                    className="input min-h-24" disabled={!editing} suppressHydrationWarning />
                </Field>
              </div>
            </div>
          </section>

          <section className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">
                Productos ({items.length})
              </h2>
              <span className="text-sm font-black text-[#f5a623]">{fmt(total)}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[920px]">
                <thead className="bg-zinc-50 border-y border-zinc-200">
                  <tr>
                    <th className="text-left px-3 py-2">Producto</th>
                    <th className="text-left px-3 py-2">Modo</th>
                    <th className="text-left px-3 py-2">Pag.</th>
                    <th className="text-left px-3 py-2">Precio</th>
                    <th className="text-left px-3 py-2">Dto.</th>
                    <th className="text-left px-3 py-2">Estado</th>
                    <th className="text-left px-3 py-2">Anotacion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-3 py-2">
                        <input value={item.producto ?? ""} onChange={(e) => updateItem(item.id, "producto", e.target.value)}
                          className="input min-w-52" disabled={!editing} />
                      </td>
                      <td className="px-3 py-2">
                        <input value={item.modo ?? ""} onChange={(e) => updateItem(item.id, "modo", e.target.value)}
                          className="input min-w-44" disabled={!editing} />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" value={item.paginas ?? ""} onChange={(e) => updateItem(item.id, "paginas", e.target.value)}
                          className="input w-20" disabled={!editing} />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" step="0.01" value={item.precio ?? ""} onChange={(e) => updateItem(item.id, "precio", e.target.value)}
                          className="input w-28" disabled={!editing} />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" step="0.01" value={item.descuento ?? ""} onChange={(e) => updateItem(item.id, "descuento", e.target.value)}
                          className="input w-20" disabled={!editing} />
                      </td>
                      <td className="px-3 py-2">
                        <select value={item.estado ?? pedido.estado ?? "Encargo recibido"}
                          onChange={(e) => updateItem(item.id, "estado", e.target.value)}
                          className="input min-w-40"
                          disabled={!editing}>
                          {ESTADOS.map((estado) => <option key={estado}>{estado}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input value={item.anotacion ?? ""} onChange={(e) => updateItem(item.id, "anotacion", e.target.value)}
                          className="input min-w-56" disabled={!editing} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="bg-white rounded-xl border border-zinc-200 shadow-sm p-5 space-y-3">
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Cliente</h2>
            <p className="font-semibold text-zinc-800">{pedido.clientes?.nombre ?? "-"}</p>
            {pedido.clientes?.telefono && <p className="text-sm text-zinc-500">{pedido.clientes.telefono}</p>}
            {pedido.clientes?.mail && <p className="text-sm text-zinc-500">{pedido.clientes.mail}</p>}
          </section>

          <section className="bg-white rounded-xl border border-zinc-200 shadow-sm p-5 space-y-3 text-sm">
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Resumen</h2>
            <Info label="Numero" value={pedido.numero} />
            <Info label="Codigo unico" value={pedido.codigo_unico} />
            <Info label="Total" value={fmt(total)} />
            <Info label="Resta" value={fmt(Math.max(0, total - (Number(pedido.senia) || 0)))} />
          </section>

          {(pedido.mercado_pago_payment_id || pedido.mercado_pago_monto || pedido.mercado_pago_hora || mpFallback) && (
            <section className="bg-white rounded-xl border border-emerald-200 shadow-sm p-5 space-y-3 text-sm">
              <h2 className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Pago Mercado Pago</h2>
              <Info label="Referencia" value={pedido.mercado_pago_payment_id ?? mpFallback?.id} />
              <Info label="Monto" value={pedido.mercado_pago_monto ? fmt(Number(pedido.mercado_pago_monto)) : mpFallback?.monto ? fmt(Number(mpFallback.monto)) : null} />
              <Info label="Hora" value={pedido.mercado_pago_hora ? new Date(pedido.mercado_pago_hora).toLocaleString("es-AR") : mpFallback?.hora ?? null} />
            </section>
          )}

          <section className="bg-white rounded-xl border border-zinc-200 shadow-sm p-5 space-y-3 text-sm">
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Tickets</h2>
            <a href={`/api/pdf/pedido/${pedido.id}?tipo=ticket`} target="_blank" rel="noopener noreferrer"
              className="block text-center px-3 py-2 rounded-lg bg-[#1a1a2e] text-white text-xs font-black hover:bg-zinc-800 transition">
              Ticket de pedido
            </a>
            {["Listo para retirar", "Entregado"].includes(pedidoEstado) ? (
              <a href={`/api/pdf/pedido/${pedido.id}?tipo=entrega`} target="_blank" rel="noopener noreferrer"
                className="block text-center px-3 py-2 rounded-lg bg-[#f5a623] text-[#1a1a2e] text-xs font-black hover:bg-amber-400 transition">
                Ticket de entrega
              </a>
            ) : (
              <p className="rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-500">
                El ticket de entrega aparece cuando el pedido esta listo para retirar.
              </p>
            )}
          </section>

          {msg && (
            <p className={`rounded-lg px-3 py-2 text-xs ${msg.includes("guardado") ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
              {msg}
            </p>
          )}

          {editing && <button type="submit" disabled={isPending}
            className="w-full py-3 rounded-xl bg-[#f5a623] text-[#1a1a2e] font-black text-sm hover:bg-amber-400 disabled:opacity-50 transition">
            {isPending ? "Guardando..." : "Guardar cambios"}
          </button>}
        </aside>
      </div>

      <style jsx>{`
        .input {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid rgb(212 212 216);
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          outline: none;
          background: white;
        }
        .input:focus {
          border-color: #f5a623;
          box-shadow: 0 0 0 1px #f5a623;
        }
        .input:disabled {
          background: #f8fafc;
          color: #3f3f46;
          border-color: #e4e4e7;
          opacity: 1;
        }
      `}</style>

      {pendingAcceso && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !aplicandoCambio && setPendingAcceso(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-[440px] max-w-[95vw] space-y-4">
            <div className="flex items-start gap-3">
              <div className="text-3xl">🖨️</div>
              <div className="flex-1">
                <h3 className="font-black text-zinc-800 text-lg leading-tight">
                  Estás por {pendingAcceso.kind === "imprimir" ? "imprimir" : "descargar"} un archivo del pedido
                </h3>
                <p className="text-sm text-zinc-500 mt-1">
                  <span className="font-semibold text-zinc-700">{pendingAcceso.nombre}</span>
                </p>
              </div>
            </div>
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">
              Este pedido está en <span className="font-bold">Encargo recibido</span>. Al continuar, pasa automáticamente a <span className="font-bold">En producción</span>.
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={confirmarAcceso}
                disabled={aplicandoCambio}
                className="flex-1 py-3 rounded-xl bg-[#f5a623] text-[#1a1a2e] font-black text-sm hover:bg-[#d4881a] disabled:opacity-50 transition"
              >
                {aplicandoCambio ? "Guardando..." : "✓ Continuar y pasar a producción"}
              </button>
              <button
                type="button"
                onClick={() => setPendingAcceso(null)}
                disabled={aplicandoCambio}
                className="px-4 py-3 rounded-xl bg-zinc-100 text-zinc-600 text-sm font-semibold hover:bg-zinc-200 disabled:opacity-50 transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">{label}</span>
      {children}
    </label>
  );
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-zinc-500">{label}</span>
      <span className="font-medium text-zinc-800 text-right">{value || "-"}</span>
    </div>
  );
}
