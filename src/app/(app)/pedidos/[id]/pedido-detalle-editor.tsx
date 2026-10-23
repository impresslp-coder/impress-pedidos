"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { actualizarEstado, actualizarEstadoArchivo, guardarDetallePedido, registrarMensajeWhatsApp, tomarPedidoEnProduccion } from "./actions";
import { resolverPreferenciasArchivo } from "@/lib/archivo-prefs";

type Pedido = Record<string, any>;
type Item = Record<string, any>;
type MensajeEnviado = { id: string; enviado_en: string; plantilla: string | null; enviado_por_nombre?: string | null };
type PlantillaMensaje = { codigo: string; cuerpo: string };
type SucursalRetiro = { codigo: string; nombre: string; direccion: string; horario?: string | null };
type TicketPedido = { id: string; tipo: string; generado_en: string; generado_por_nombre?: string | null; impreso: boolean; impreso_en?: string | null; impreso_por_nombre?: string | null };

const ESTADOS = ["Presupuesto", "Encargo recibido", "En producción", "Listo para entregar", "Entregado", "Cancelado"];
const MEDIOS_PAGO = ["", "Efectivo", "Transferencia", "Debito", "Credito", "QR", "Mercado Pago", "Cuenta corriente"];
const VIAS_CONTACTO = ["", "Presencial", "WhatsApp", "Telefono", "Instagram", "Email", "Facebook"];
const PRIORIDADES_ITEM = ["baja", "normal", "alta"] as const;

function ArchivoParaImprimir({
  archivo,
  items,
  pedidoEstado,
  estadoPending,
  webSinPago,
  iniciarAccesoArchivo,
  onCambiarEstado,
}: {
  archivo: Item;
  items: Item[];
  pedidoEstado: string;
  estadoPending: boolean;
  webSinPago: boolean;
  iniciarAccesoArchivo: (accion: { kind: "descargar" | "imprimir"; nombre: string; archivoId: string }) => void;
  onCambiarEstado: (estado: string) => void;
}) {
  const preferencias = resolverPreferenciasArchivo(archivo, items);

  return (
    <tr className="align-middle">
      <td className="py-3 pr-3">
        <button
          type="button"
          onClick={() => iniciarAccesoArchivo({ kind: "descargar", nombre: archivo.nombre_archivo, archivoId: archivo.id })}
          className="font-semibold text-blue-700 hover:underline text-left"
        >
          {archivo.nombre_archivo}
        </button>
      </td>
      <td className="py-3 px-3 text-zinc-600">
        {preferencias.copias} cop. · {preferencias.color ? "Color" : "B&N"} · {preferencias.doble_faz ? "Doble faz" : "Simple"} · {preferencias.tamano_papel}
      </td>
      <td className="py-3 px-3">
        <select
          value={archivo.estado ?? pedidoEstado}
          disabled={estadoPending}
          onChange={(e) => onCambiarEstado(e.target.value)}
          className="rounded-md border border-zinc-300 px-2 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#f5a623]"
        >
          {ESTADOS.map((estado) => <option key={estado}>{estado}</option>)}
        </select>
      </td>
      <td className="py-3 pl-3 text-right">
        <button
          type="button"
          onClick={() => iniciarAccesoArchivo({ kind: "imprimir", nombre: archivo.nombre_archivo, archivoId: archivo.id })}
          disabled={webSinPago}
          title={webSinPago ? "Esperando el pago de Mercado Pago" : undefined}
          className="px-3 py-1.5 rounded-md bg-[#f5a623] text-[#1a1a2e] text-xs font-black hover:bg-amber-400 disabled:bg-zinc-200 disabled:text-zinc-500 disabled:cursor-not-allowed transition"
        >
          Imprimir
        </button>
      </td>
    </tr>
  );
}

const fmt = (n: number | null | undefined) =>
  n != null ? new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(n) : "-";

const fmtNumero = (n: number) =>
  new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(n);

function parseNumeroFormateado(value: string) {
  const clean = value.replace(/[^\d,.-]/g, "");
  if (!clean) return 0;

  const decimalIndex = Math.max(clean.lastIndexOf(","), clean.lastIndexOf("."));
  const fractional = decimalIndex >= 0 ? clean.slice(decimalIndex + 1).replace(/\D/g, "") : "";
  const integer = decimalIndex >= 0 ? clean.slice(0, decimalIndex).replace(/\D/g, "") : clean.replace(/\D/g, "");

  // Un separador seguido por tres dígitos se interpreta como miles: 40.000.
  if (fractional.length > 0 && fractional.length <= 2) {
    return Number(`${integer || "0"}.${fractional}`) || 0;
  }
  return Number(clean.replace(/\D/g, "")) || 0;
}

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

function duracionHasta(value: string | null | undefined, ahora = Date.now()) {
  if (!value) return "Sin vencimiento calculado";
  const diff = new Date(value).getTime() - ahora;
  if (!Number.isFinite(diff)) return "Sin vencimiento calculado";
  const abs = Math.abs(diff);
  const horas = Math.floor(abs / 3_600_000);
  const minutos = Math.floor((abs % 3_600_000) / 60_000);
  const texto = horas > 0 ? `${horas} h ${minutos} min` : `${minutos} min`;
  return diff >= 0 ? `Faltan ${texto}` : `Vencido hace ${texto}`;
}

function etiquetaTicket(tipo: string) {
  return ({ pedido: "Ticket de pedido", entrega: "Ticket de entrega", resumen: "Resumen" } as Record<string, string>)[tipo] ?? tipo;
}

function renderizarPlantilla(cuerpo: string, valores: Record<string, string>) {
  return cuerpo.replace(/{{(.*?)}}/g, (_, clave: string) => valores[clave.trim()] ?? "").replace(/\n{3,}/g, "\n\n").trim();
}

export default function PedidoDetalleEditor({
  pedido,
  itemsIniciales,
  archivos,
  mensajesIniciales,
  plantillas,
  sucursalRetiro,
  puedeGestionarPrioridad,
  otrosPedidos,
  responsableProduccion,
  ticketsIniciales,
  usuarioActualNombre,
}: {
  pedido: Pedido;
  itemsIniciales: Item[];
  archivos: Item[];
  mensajesIniciales: MensajeEnviado[];
  plantillas: PlantillaMensaje[];
  sucursalRetiro: SucursalRetiro | null;
  puedeGestionarPrioridad: boolean;
  otrosPedidos: number;
  responsableProduccion: string | null;
  ticketsIniciales: TicketPedido[];
  usuarioActualNombre: string | null;
}) {
  const [items, setItems] = useState<Item[]>(itemsIniciales);
  const [archivosLista, setArchivosLista] = useState<Item[]>(archivos);
  const [pedidoEstado, setPedidoEstado] = useState(pedido.estado ?? "Encargo recibido");
  const [seniaInput, setSeniaInput] = useState(() => fmtNumero(Number(pedido.senia) || 0));
  const [mensajes, setMensajes] = useState<MensajeEnviado[]>(mensajesIniciales);
  const [produccionVence, setProduccionVence] = useState<string | null>(pedido.produccion_vence_en ?? null);
  const [produccionInicio, setProduccionInicio] = useState<string | null>(pedido.produccion_iniciada_en ?? null);
  const [responsableActual, setResponsableActual] = useState<string | null>(responsableProduccion);
  const [ahora, setAhora] = useState(() => Date.now());
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [estadoPending, startEstadoTransition] = useTransition();
  const [whatsAppPending, startWhatsAppTransition] = useTransition();
  const [msg, setMsg] = useState<string>();
  const [accesoError, setAccesoError] = useState<string>();
  const [produccionError, setProduccionError] = useState<string>();
  const [pendingAcceso, setPendingAcceso] = useState<
    | { kind: "descargar"; nombre: string; archivoId: string }
    | { kind: "imprimir"; nombre: string; archivoId: string }
    | null
  >(null);
  const [aplicandoCambio, setAplicandoCambio] = useState(false);
  const [confirmarTomaProduccion, setConfirmarTomaProduccion] = useState(false);

  useEffect(() => {
    const interval = window.setInterval(() => setAhora(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const total = useMemo(
    () => items.reduce((acc, item) => acc + (Number(item.precio) || 0), 0),
    [items],
  );
  const totalPaginas = useMemo(
    () => items.reduce((acc, item) => acc + Math.max(0, Number(item.paginas) || 0) * Math.max(1, Number(item.cantidad) || 1), 0),
    [items],
  );
  const mpFallback = mercadoPagoFallback(pedido.mensaje);
  const mensajePedido = cleanPedidoMensaje(pedido.mensaje);
  const webSinPago = /^(Pedido|Compra) web/.test(String(pedido.mensaje ?? "")) && !pedido.mercado_pago_payment_id;
  const viaWhatsApp = String(pedido.via_contacto ?? "").trim().toLowerCase() === "whatsapp";
  const telefonoContacto = String(pedido.telefono_contacto ?? "").trim()
    || (viaWhatsApp ? String(pedido.clientes?.telefono ?? "").trim() : "");
  const esEnvio = Boolean(pedido.es_envio);
  const plantillaCodigo = esEnvio ? "envio" : "retiro";
  const plantilla = plantillas.find((item) => item.codigo === plantillaCodigo);
  const detalleWhatsApp = items
    .map((item) => `${Number(item.cantidad) || 1} × ${String(item.producto ?? "Producto sin nombre").trim()}`)
    .join("\n");
  const cantidadItems = items.length;
  const cuerpoPorDefecto = esEnvio
    ? "Hola {{nombre}}! {{pedido_listo}}\n\n{{detalle}}\n\nComo pediste envío, decinos qué día y en qué franja horaria te viene bien recibirlo."
    : "Hola {{nombre}}! {{pedido_listo_retiro}}\n\n{{detalle}}\n\nTe esperamos en {{sucursal_nombre}}, {{sucursal_direccion}}.\n{{sucursal_horario}}";
  const mensajeWhatsApp = renderizarPlantilla(plantilla?.cuerpo ?? cuerpoPorDefecto, {
    nombre: String(pedido.clientes?.nombre ?? "").trim(),
    detalle: detalleWhatsApp,
    pedido_listo: cantidadItems === 1 ? "Tu pedido está listo." : "Tus pedidos están listos.",
    pedido_listo_retiro: cantidadItems === 1 ? "Tu pedido ya está listo para retirar." : "Tus pedidos ya están listos para retirar.",
    sucursal_nombre: sucursalRetiro?.nombre ?? "la sucursal elegida",
    sucursal_direccion: sucursalRetiro?.direccion ?? "",
    sucursal_horario: sucursalRetiro?.horario ?? "",
  });
  const telefonoWhatsApp = `${String(pedido.clientes?.cod_pais ?? "54")}${String(pedido.clientes?.telefono ?? telefonoContacto)}`.replace(/\D/g, "");
  const whatsappUrl = telefonoWhatsApp ? `https://wa.me/${telefonoWhatsApp}?text=${encodeURIComponent(mensajeWhatsApp)}` : null;
  const puedeAvisarWhatsApp = ["Listo para entregar", "Entregado"].includes(pedidoEstado);

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

  const tomarProduccion = async () => {
    const res = await tomarPedidoEnProduccion(pedido.id);
    if (res?.error) throw new Error(res.error);
    setPedidoEstado("En producción");
    setProduccionVence(res?.venceEn ?? null);
    setProduccionInicio(res?.iniciadoEn ?? new Date().toISOString());
    setResponsableActual(res?.responsable ?? usuarioActualNombre);
  };

  const iniciarAccesoArchivo = (
    accion:
      | { kind: "descargar"; nombre: string; archivoId: string }
      | { kind: "imprimir"; nombre: string; archivoId: string }
  ) => {
    setAccesoError(undefined);
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
    setAccesoError(undefined);
    try {
      await tomarProduccion();
      ejecutarAccion(pendingAcceso);
      setPendingAcceso(null);
    } catch (err) {
      setAccesoError(err instanceof Error ? err.message : "Error al cambiar estado");
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

  const abrirWhatsApp = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!whatsappUrl || !puedeAvisarWhatsApp || whatsAppPending) {
      event.preventDefault();
      return;
    }
    startWhatsAppTransition(async () => {
      const resultado = await registrarMensajeWhatsApp(pedido.id, plantillaCodigo);
      if (resultado?.error) {
        setMsg(resultado.error);
        return;
      }
      if (resultado?.mensaje) setMensajes((prev) => [resultado.mensaje, ...prev]);
      setMsg("Aviso de WhatsApp registrado");
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
          <button type="button" onClick={() => {
            setSeniaInput(fmtNumero(Number(pedido.senia) || 0));
            setEditing(true);
          }}
            className="px-4 py-2 rounded-lg bg-[#1a1a2e] text-white text-sm font-bold hover:bg-zinc-800 transition">
            Editar pedido
          </button>
        ) : (
          <button type="button" onClick={() => {
            setSeniaInput(fmtNumero(Number(pedido.senia) || 0));
            setEditing(false);
          }}
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
                  <ArchivoParaImprimir
                    key={archivo.id}
                    archivo={archivo}
                    items={items}
                    pedidoEstado={pedidoEstado}
                    estadoPending={estadoPending}
                    webSinPago={webSinPago}
                    iniciarAccesoArchivo={iniciarAccesoArchivo}
                    onCambiarEstado={(nuevoEstado) => {
                      setArchivosLista((prev) => prev.map((a) => a.id === archivo.id ? { ...a, estado: nuevoEstado } : a));
                      startEstadoTransition(async () => {
                        const res = await actualizarEstadoArchivo(pedido.id, archivo.id, nuevoEstado);
                        if (res?.estadoPedido) setPedidoEstado(res.estadoPedido);
                        if (res?.error) setMsg(res.error);
                      });
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {pedidoEstado === "En producción" && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
          <p className="text-xs font-black uppercase tracking-wide text-amber-800">Producción en curso</p>
          <p className="mt-1 text-sm font-semibold text-amber-950">
            {produccionVence
              ? `${duracionHasta(produccionVence, ahora)} · vence el ${new Date(produccionVence).toLocaleString("es-AR")} (24 horas corridas).`
              : "El plazo se está calculando."}
          </p>
        </section>
      )}

      {pedidoEstado === "Encargo recibido" && (
        <section className="rounded-xl border border-indigo-200 bg-indigo-50 px-5 py-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-indigo-800">Producción pendiente</p>
            <p className="mt-1 text-sm text-indigo-950">Tomá el pedido para asignártelo e iniciar el plazo de 24 horas corridas.</p>
          </div>
          <button type="button" onClick={() => setConfirmarTomaProduccion(true)}
            className="px-4 py-2 rounded-lg bg-indigo-700 text-white text-xs font-black hover:bg-indigo-800 transition">
            Tomar pedido en producción
          </button>
        </section>
      )}

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
              <Field label="Seña">
                {editing ? (
                  <>
                    <input type="text" inputMode="decimal" value={seniaInput}
                      onChange={(e) => setSeniaInput(e.target.value)}
                      onBlur={() => setSeniaInput(fmtNumero(parseNumeroFormateado(seniaInput)))}
                      aria-label="Seña" className="input" suppressHydrationWarning />
                    <input name="senia" type="hidden" value={String(parseNumeroFormateado(seniaInput))} />
                  </>
                ) : (
                  <div className="input flex items-center font-semibold text-zinc-800">
                    {fmtNumero(Number(pedido.senia) || 0)}
                  </div>
                )}
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
              <Field label="Teléfono de contacto">
                <input name="telefono_contacto" type="tel" defaultValue={telefonoContacto}
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
              <Field label="Ubicación física">
                <input name="ubicacion" defaultValue={pedido.ubicacion ?? ""}
                  placeholder="Ej.: 1A, caja piso, estante Nico" className="input" disabled={!editing} suppressHydrationWarning />
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
                Productos ({items.length}) · {fmtNumero(totalPaginas)} página{totalPaginas === 1 ? "" : "s"}
              </h2>
              <span className="text-sm font-black text-[#f5a623]">{fmt(total)}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[980px]">
                <thead className="bg-zinc-50 border-y border-zinc-200">
                  <tr>
                    <th className="text-left px-3 py-2">Producto</th>
                    <th className="text-left px-3 py-2">Modo</th>
                    <th className="text-left px-3 py-2">Cant.</th>
                    <th className="text-left px-3 py-2">Pag.</th>
                    <th className="text-left px-3 py-2">Precio</th>
                    <th className="text-left px-3 py-2">Dto.</th>
                    <th className="text-left px-3 py-2">Estado</th>
                    <th className="text-left px-3 py-2">Prioridad</th>
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
                        <span className="font-semibold text-zinc-800 tabular-nums">{Math.max(1, Number(item.cantidad) || 1)}</span>
                      </td>
                      <td className="px-3 py-2">
                        {editing ? (
                          <input type="number" min="0" value={item.paginas ?? ""} onChange={(e) => updateItem(item.id, "paginas", e.target.value)}
                            className="input w-20" />
                        ) : (
                          <span className="font-semibold text-zinc-800 tabular-nums whitespace-nowrap">
                            {fmtNumero(Math.max(0, Number(item.paginas) || 0))} pág.
                          </span>
                        )}
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
                        {puedeGestionarPrioridad && editing ? (
                          <select value={item.prioridad ?? "normal"}
                            onChange={(e) => updateItem(item.id, "prioridad", e.target.value)}
                            className="input min-w-24">
                            {PRIORIDADES_ITEM.map((prioridad) => <option key={prioridad} value={prioridad}>{etiquetaPrioridad(prioridad)}</option>)}
                          </select>
                        ) : <PrioridadBadge prioridad={item.prioridad ?? "normal"} />}
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
            <a href={`/clientes?q=${encodeURIComponent(String(pedido.clientes?.nombre ?? ""))}`} className="block font-semibold text-blue-700 hover:underline">
              {pedido.clientes?.nombre ?? "-"}
            </a>
            {pedido.clientes?.telefono && <p className="text-sm text-zinc-500">{pedido.clientes.telefono}</p>}
            {pedido.clientes?.mail && <p className="text-sm text-zinc-500">{pedido.clientes.mail}</p>}
            <a href={`/pedidos?q=${encodeURIComponent(String(pedido.clientes?.nombre ?? ""))}`} className="block text-xs font-semibold text-blue-600 hover:underline">
              {otrosPedidos === 0 ? "Sin otros pedidos" : `Ver ${otrosPedidos} pedido${otrosPedidos === 1 ? "" : "s"} más`}
            </a>
          </section>

          <section className="bg-white rounded-xl border border-zinc-200 shadow-sm p-5 space-y-3 text-sm">
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Resumen</h2>
            <Info label="Numero" value={pedido.numero} />
            <Info label="Codigo unico" value={pedido.codigo_unico} />
            <Info label="Total" value={fmt(total)} />
            <Info label="Restante" value={fmt(Math.max(0, total - (Number(pedido.senia) || 0)))} />
          </section>

          {(produccionInicio || produccionVence || responsableActual) && (
            <section className="bg-white rounded-xl border border-amber-200 shadow-sm p-5 space-y-3 text-sm">
              <h2 className="text-xs font-semibold text-amber-800 uppercase tracking-wide">Producción</h2>
              <Info label="Responsable" value={responsableActual} />
              <Info label="Inicio" value={produccionInicio ? new Date(produccionInicio).toLocaleString("es-AR") : null} />
              <Info label="Vencimiento" value={produccionVence ? new Date(produccionVence).toLocaleString("es-AR") : null} />
              {produccionVence && (
                <p className={`rounded-lg px-3 py-2 text-xs font-semibold ${duracionHasta(produccionVence, ahora).startsWith("Vencido") ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"}`}>
                  {duracionHasta(produccionVence, ahora)} · plazo de 24 horas corridas.
                </p>
              )}
            </section>
          )}

          {pedido.carpeta_url && (
            <section className="bg-white rounded-xl border border-blue-200 shadow-sm p-5 space-y-3 text-sm">
              <h2 className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Carpeta de archivos</h2>
              <p className="text-xs text-zinc-600">Los archivos grandes se guardan en el Drive privado de Impress. Abrí la carpeta con la cuenta impress.lp@gmail.com para verlos o descargarlos.</p>
              <a href={pedido.carpeta_url} target="_blank" rel="noopener noreferrer"
                className="block text-center px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-black hover:bg-blue-700 transition">
                Abrir carpeta en Drive
              </a>
            </section>
          )}

          {(pedido.mercado_pago_payment_id || pedido.mercado_pago_monto || pedido.mercado_pago_hora || mpFallback) && (
            <section className="bg-white rounded-xl border border-emerald-200 shadow-sm p-5 space-y-3 text-sm">
              <h2 className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Pago Mercado Pago</h2>
              <Info label="Referencia" value={pedido.mercado_pago_payment_id ?? mpFallback?.id} />
              <Info label="Monto" value={pedido.mercado_pago_monto ? fmt(Number(pedido.mercado_pago_monto)) : mpFallback?.monto ? fmt(Number(mpFallback.monto)) : null} />
              <Info label="Hora" value={pedido.mercado_pago_hora ? new Date(pedido.mercado_pago_hora).toLocaleString("es-AR") : mpFallback?.hora ?? null} />
            </section>
          )}

          <section className="bg-white rounded-xl border border-emerald-200 shadow-sm p-5 space-y-3 text-sm">
            <h2 className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">WhatsApp</h2>
            {puedeAvisarWhatsApp ? (
              <>
                {whatsappUrl ? (
                  <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" onClick={abrirWhatsApp}
                    className="block text-center px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-black hover:bg-emerald-700 transition">
                    {whatsAppPending ? "Registrando aviso..." : "Abrir WhatsApp y registrar aviso"}
                  </a>
                ) : (
                  <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">El cliente no tiene un teléfono registrado.</p>
                )}
                <details className="rounded-lg bg-zinc-50 px-3 py-2">
                  <summary className="cursor-pointer text-xs font-semibold text-zinc-700">Vista previa del mensaje</summary>
                  <p className="mt-2 whitespace-pre-wrap text-xs text-zinc-600">{mensajeWhatsApp}</p>
                </details>
                {mensajes[0] ? (
                  <p className="text-xs text-emerald-700">
                    Último aviso: {new Date(mensajes[0].enviado_en).toLocaleString("es-AR")}{mensajes[0].enviado_por_nombre ? ` · ${mensajes[0].enviado_por_nombre}` : ""}.
                  </p>
                ) : <p className="text-xs text-zinc-500">Todavía no se registraron avisos.</p>}
              </>
            ) : (
              <p className="rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-500">El aviso estará disponible cuando el pedido esté listo para entregar.</p>
            )}
          </section>

          <section className="bg-white rounded-xl border border-zinc-200 shadow-sm p-5 space-y-3 text-sm">
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Tickets</h2>
            <a href={`/api/pdf/pedido/${pedido.id}?tipo=ticket`} target="_blank" rel="noopener noreferrer"
              className="block text-center px-3 py-2 rounded-lg bg-[#1a1a2e] text-white text-xs font-black hover:bg-zinc-800 transition">
              Ticket de pedido
            </a>
            {["Listo para entregar", "Entregado"].includes(pedidoEstado) ? (
              <a href={`/api/pdf/pedido/${pedido.id}?tipo=entrega`} target="_blank" rel="noopener noreferrer"
                className="block text-center px-3 py-2 rounded-lg bg-[#f5a623] text-[#1a1a2e] text-xs font-black hover:bg-amber-400 transition">
                Ticket de entrega
              </a>
            ) : (
              <p className="rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-500">
                El ticket de entrega aparece cuando el pedido está listo para entregar.
              </p>
            )}
            {ticketsIniciales.length > 0 ? (
              <div className="border-t border-zinc-100 pt-3 space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">Historial</p>
                {ticketsIniciales.map((ticket) => (
                  <div key={ticket.id} className="rounded-lg bg-zinc-50 px-3 py-2 text-xs">
                    <p className="font-semibold text-zinc-800">{etiquetaTicket(ticket.tipo)}</p>
                    <p className="mt-0.5 text-zinc-500">Generado: {new Date(ticket.generado_en).toLocaleString("es-AR")}{ticket.generado_por_nombre ? ` · ${ticket.generado_por_nombre}` : ""}</p>
                    <p className={ticket.impreso ? "mt-0.5 text-emerald-700" : "mt-0.5 text-zinc-500"}>
                      {ticket.impreso && ticket.impreso_en ? `Impreso: ${new Date(ticket.impreso_en).toLocaleString("es-AR")}${ticket.impreso_por_nombre ? ` · ${ticket.impreso_por_nombre}` : ""}` : "Aún sin impresión registrada"}
                    </p>
                  </div>
                ))}
              </div>
            ) : <p className="text-xs text-zinc-500">Todavía no se generaron tickets para este pedido.</p>}
          </section>

          {msg && (
            <p className={`rounded-lg px-3 py-2 text-xs ${/(guardado|registrado)/i.test(msg) ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
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
              Este pedido está en <span className="font-bold">Encargo recibido</span>. Al continuar, pasa automáticamente a <span className="font-bold">Producción</span> y se asigna el plazo de 24 horas corridas.
            </div>
            {accesoError && <p role="alert" className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm font-semibold text-red-800">{accesoError}</p>}
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

      {confirmarTomaProduccion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !aplicandoCambio && setConfirmarTomaProduccion(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-[440px] max-w-[95vw] space-y-4">
            <div className="text-3xl">🖨️</div>
            <div>
              <h3 className="font-black text-zinc-800 text-lg">¿Tomar este pedido en Producción?</h3>
              <p className="mt-1 text-sm text-zinc-500">Quedarás asignado como responsable y comenzará el plazo de 24 horas corridas.</p>
            </div>
            {produccionError && <p role="alert" className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm font-semibold text-red-800">{produccionError}</p>}
            <div className="flex gap-2 pt-1">
              <button type="button" disabled={aplicandoCambio}
                onClick={async () => {
                  setAplicandoCambio(true);
                  setMsg(undefined);
                  setProduccionError(undefined);
                  try {
                    await tomarProduccion();
                    setConfirmarTomaProduccion(false);
                    setMsg("Pedido tomado en producción");
                  } catch (err) {
                    setProduccionError(err instanceof Error ? err.message : "No pude tomar el pedido");
                  }
                  setAplicandoCambio(false);
                }}
                className="flex-1 py-3 rounded-xl bg-indigo-700 text-white font-black text-sm hover:bg-indigo-800 disabled:opacity-50 transition">
                {aplicandoCambio ? "Guardando..." : "Confirmar y tomar pedido"}
              </button>
              <button type="button" onClick={() => setConfirmarTomaProduccion(false)} disabled={aplicandoCambio}
                className="px-4 py-3 rounded-xl bg-zinc-100 text-zinc-600 text-sm font-semibold hover:bg-zinc-200 disabled:opacity-50 transition">
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

function etiquetaPrioridad(prioridad: string) {
  return ({ baja: "Baja", normal: "Normal", alta: "Alta" } as Record<string, string>)[prioridad] ?? "Normal";
}

function PrioridadBadge({ prioridad }: { prioridad: string }) {
  const style = {
    baja: "bg-zinc-100 text-zinc-600",
    normal: "bg-blue-100 text-blue-700",
    alta: "bg-red-100 text-red-700",
  }[prioridad] ?? "bg-blue-100 text-blue-700";
  return <span className={`inline-flex rounded px-2 py-1 text-xs font-bold ${style}`}>{etiquetaPrioridad(prioridad)}</span>;
}
