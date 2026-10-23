"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  abrirConversacionWhatsapp,
  enviarMensajeWhatsapp,
  marcarConversacionWhatsappLeida,
} from "./actions";

export type ClienteWhatsapp = {
  id: string;
  nombre: string;
  telefono: string | null;
  cod_pais: string | null;
  mail: string | null;
};

export type ConversacionWhatsapp = {
  id: string;
  telefono: string;
  nombreContacto: string | null;
  ultimoMensaje: string | null;
  ultimoMensajeEn: string | null;
  ultimoMensajeTipo: "entrante" | "saliente" | null;
  noLeidos: number;
  cliente: ClienteWhatsapp | null;
};

export type MensajeWhatsapp = {
  id: string;
  tipo: "entrante" | "saliente";
  tipoContenido: string;
  contenido: string;
  estado: string;
  errorMensaje: string | null;
  creadoEn: string;
};

export type PedidoWhatsapp = {
  id: string;
  numero: string;
  estado: string | null;
  fecha: string | null;
};

type Props = {
  conversaciones: ConversacionWhatsapp[];
  seleccionada: ConversacionWhatsapp | null;
  mensajes: MensajeWhatsapp[];
  pedidos: PedidoWhatsapp[];
  configurada: boolean;
  ventanaAbierta: boolean;
  stats: { conversaciones: number; noLeidos: number; mensajesHoy: number };
};

const fechaHora = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Buenos_Aires",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const soloHora = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Buenos_Aires",
  hour: "2-digit",
  minute: "2-digit",
});

function nombreConversacion(conversacion: ConversacionWhatsapp) {
  return conversacion.cliente?.nombre || conversacion.nombreContacto || `+${conversacion.telefono}`;
}

function iniciales(nombre: string) {
  return nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((parte) => parte[0]?.toUpperCase()).join("") || "WA";
}

function estadoMensaje(estado: string) {
  if (estado === "leido") return "✓✓";
  if (estado === "entregado") return "✓✓";
  if (estado === "enviado") return "✓";
  if (estado === "error") return "!";
  return "";
}

export function CrmClient({
  conversaciones,
  seleccionada,
  mensajes,
  pedidos,
  configurada,
  ventanaAbierta,
  stats,
}: Props) {
  const router = useRouter();
  const [busqueda, setBusqueda] = useState("");
  const [nuevoTelefono, setNuevoTelefono] = useState("");
  const [mostrarNuevo, setMostrarNuevo] = useState(false);
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, startTransition] = useTransition();
  const finalChat = useRef<HTMLDivElement>(null);

  useEffect(() => {
    finalChat.current?.scrollIntoView({ behavior: "instant" });
  }, [seleccionada?.id, mensajes.length]);

  const conversacionSeleccionadaId = seleccionada?.id;
  const conversacionSeleccionadaNoLeidos = seleccionada?.noLeidos ?? 0;

  useEffect(() => {
    if (!conversacionSeleccionadaId || conversacionSeleccionadaNoLeidos === 0) return;
    void marcarConversacionWhatsappLeida(conversacionSeleccionadaId);
  }, [conversacionSeleccionadaId, conversacionSeleccionadaNoLeidos]);

  useEffect(() => {
    const interval = window.setInterval(() => router.refresh(), 12_000);
    return () => window.clearInterval(interval);
  }, [router]);

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return conversaciones;
    return conversaciones.filter((conversacion) =>
      nombreConversacion(conversacion).toLowerCase().includes(q)
      || conversacion.telefono.includes(q)
      || conversacion.ultimoMensaje?.toLowerCase().includes(q));
  }, [busqueda, conversaciones]);

  function abrirNueva(event: FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const resultado = await abrirConversacionWhatsapp(nuevoTelefono);
      if (!resultado.ok || !resultado.telefono) {
        setError(resultado.error || "No se pudo abrir la conversación.");
        return;
      }
      setNuevoTelefono("");
      setMostrarNuevo(false);
      router.push(`/whatsapp?telefono=${encodeURIComponent(resultado.telefono)}`);
      router.refresh();
    });
  }

  function enviar(event: FormEvent) {
    event.preventDefault();
    if (!seleccionada) return;
    setError(null);
    startTransition(async () => {
      const resultado = await enviarMensajeWhatsapp(seleccionada.id, seleccionada.telefono, texto);
      if (!resultado.ok) {
        setError(resultado.error || "No se pudo enviar el mensaje.");
        router.refresh();
        return;
      }
      setTexto("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-zinc-900">WhatsApp CRM</h1>
          <p className="mt-1 text-sm text-zinc-500">Conversaciones con clientes desde el número de IMPRESS.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-bold">
          <span className={`rounded-full px-3 py-1.5 ${configurada ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>
            {configurada ? "Meta conectado" : "Faltan credenciales de Meta"}
          </span>
          <span className="rounded-full bg-white px-3 py-1.5 text-zinc-600 shadow-sm ring-1 ring-zinc-200">
            {stats.conversaciones} conversaciones
          </span>
          <span className="rounded-full bg-[#e6007e]/10 px-3 py-1.5 text-[#b00060]">
            {stats.noLeidos} sin leer
          </span>
          <span className="rounded-full bg-[#139ce8]/10 px-3 py-1.5 text-[#0874ad]">
            {stats.mensajesHoy} mensajes hoy
          </span>
        </div>
      </div>

      {error && (
        <div className="flex items-start justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="ml-4">×</button>
        </div>
      )}

      <div className="grid min-h-[720px] overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm xl:grid-cols-[310px_minmax(0,1fr)_300px]">
        <aside className="flex min-h-[360px] flex-col border-b border-zinc-200 xl:border-b-0 xl:border-r">
          <div className="border-b border-zinc-200 p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-black text-zinc-800">Conversaciones</h2>
              <button
                type="button"
                onClick={() => setMostrarNuevo((actual) => !actual)}
                className="rounded-lg bg-[#1a1a2e] px-3 py-1.5 text-xs font-black text-white hover:bg-black"
              >
                + Nueva
              </button>
            </div>
            {mostrarNuevo && (
              <form onSubmit={abrirNueva} className="mt-3 flex gap-2">
                <input
                  value={nuevoTelefono}
                  onChange={(event) => setNuevoTelefono(event.target.value)}
                  placeholder="Ej. 221 555 1234"
                  className="min-w-0 flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#139ce8]"
                  suppressHydrationWarning
                />
                <button disabled={enviando} className="rounded-lg bg-[#fff200] px-3 text-xs font-black text-black disabled:opacity-50">
                  Abrir
                </button>
              </form>
            )}
            <input
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
              placeholder="Buscar cliente, teléfono o texto..."
              className="mt-3 w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-[#139ce8] focus:bg-white"
              suppressHydrationWarning
            />
          </div>
          <div className="max-h-[620px] flex-1 overflow-y-auto">
            {filtradas.length ? filtradas.map((conversacion) => {
              const activa = seleccionada?.id === conversacion.id;
              const nombre = nombreConversacion(conversacion);
              return (
                <Link
                  key={conversacion.id}
                  href={`/whatsapp?telefono=${encodeURIComponent(conversacion.telefono)}`}
                  className={`flex gap-3 border-b border-zinc-100 px-4 py-3 transition ${activa ? "bg-[#139ce8]/10" : "hover:bg-zinc-50"}`}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1a1a2e] text-xs font-black text-white">
                    {iniciales(nombre)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <strong className="truncate text-sm text-zinc-900">{nombre}</strong>
                      {conversacion.ultimoMensajeEn && <small className="shrink-0 text-[10px] text-zinc-400">{soloHora.format(new Date(conversacion.ultimoMensajeEn))}</small>}
                    </span>
                    <span className="mt-0.5 flex items-center justify-between gap-2">
                      <span className="truncate text-xs text-zinc-500">
                        {conversacion.ultimoMensajeTipo === "saliente" ? "Vos: " : ""}{conversacion.ultimoMensaje || "Conversación nueva"}
                      </span>
                      {conversacion.noLeidos > 0 && (
                        <span className="flex min-w-5 shrink-0 justify-center rounded-full bg-[#e6007e] px-1.5 py-0.5 text-[10px] font-black text-white">
                          {conversacion.noLeidos}
                        </span>
                      )}
                    </span>
                  </span>
                </Link>
              );
            }) : <p className="px-5 py-10 text-center text-sm text-zinc-400">No hay conversaciones para mostrar.</p>}
          </div>
        </aside>

        <section className="flex min-h-[620px] min-w-0 flex-col bg-[#efeae2]">
          {seleccionada ? (
            <>
              <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-5 py-3">
                <div className="min-w-0">
                  <h2 className="truncate font-black text-zinc-900">{nombreConversacion(seleccionada)}</h2>
                  <p className="text-xs text-zinc-500">+{seleccionada.telefono}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-[11px] font-black ${ventanaAbierta ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>
                  {ventanaAbierta ? "Ventana de 24 h abierta" : "Fuera de la ventana de 24 h"}
                </span>
              </header>

              <div className="flex-1 space-y-2 overflow-y-auto p-4 sm:p-6">
                {!mensajes.length && (
                  <div className="mx-auto mt-16 max-w-sm rounded-xl bg-white/90 p-5 text-center text-sm text-zinc-500 shadow-sm">
                    Todavía no hay mensajes con este número. Para iniciar una conversación fuera de la ventana de 24 horas hará falta una plantilla aprobada por Meta.
                  </div>
                )}
                {mensajes.map((mensaje) => (
                  <div key={mensaje.id} className={`flex ${mensaje.tipo === "saliente" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[82%] rounded-xl px-3 py-2 text-sm shadow-sm ${mensaje.tipo === "saliente" ? "rounded-br-sm bg-[#dcf8c6]" : "rounded-bl-sm bg-white"}`}>
                      {mensaje.tipoContenido !== "texto" && (
                        <p className="mb-1 text-[10px] font-black uppercase tracking-wide text-zinc-400">{mensaje.tipoContenido}</p>
                      )}
                      <p className="whitespace-pre-wrap break-words text-zinc-800">{mensaje.contenido}</p>
                      <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-zinc-400">
                        <span>{soloHora.format(new Date(mensaje.creadoEn))}</span>
                        {mensaje.tipo === "saliente" && (
                          <span className={mensaje.estado === "leido" ? "font-black text-[#139ce8]" : mensaje.estado === "error" ? "font-black text-red-600" : ""}>
                            {estadoMensaje(mensaje.estado)}
                          </span>
                        )}
                      </div>
                      {mensaje.errorMensaje && <p className="mt-1 text-xs font-semibold text-red-600">{mensaje.errorMensaje}</p>}
                    </div>
                  </div>
                ))}
                <div ref={finalChat} />
              </div>

              <form onSubmit={enviar} className="border-t border-zinc-200 bg-white p-3">
                {!ventanaAbierta && (
                  <p className="mb-2 text-xs font-semibold text-amber-700">
                    La respuesta libre está bloqueada: pasaron más de 24 horas desde el último mensaje del cliente.
                  </p>
                )}
                <div className="flex gap-2">
                  <textarea
                    value={texto}
                    onChange={(event) => setTexto(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        event.currentTarget.form?.requestSubmit();
                      }
                    }}
                    rows={1}
                    placeholder="Escribí una respuesta..."
                    className="min-h-11 flex-1 resize-none rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none focus:border-[#139ce8]"
                    suppressHydrationWarning
                  />
                  <button
                    disabled={enviando || !texto.trim() || !configurada || !ventanaAbierta}
                    className="rounded-xl bg-[#1a1a2e] px-5 text-sm font-black text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {enviando ? "Enviando..." : "Enviar"}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-8 text-center">
              <div>
                <div className="mx-auto mb-4 h-16 w-16 rounded-2xl bg-[#1a1a2e] p-4 text-2xl font-black text-[#fff200]">WA</div>
                <h2 className="text-lg font-black text-zinc-800">Seleccioná una conversación</h2>
                <p className="mt-1 max-w-sm text-sm text-zinc-500">Elegí un cliente de la lista o abrí una conversación con un número nuevo.</p>
              </div>
            </div>
          )}
        </section>

        <aside className="border-t border-zinc-200 bg-zinc-50 p-5 xl:border-l xl:border-t-0">
          {seleccionada ? (
            <div className="space-y-5">
              <div>
                <p className="text-[11px] font-black uppercase tracking-wider text-zinc-400">Ficha del cliente</p>
                <h3 className="mt-2 text-lg font-black text-zinc-900">{nombreConversacion(seleccionada)}</h3>
                <p className="text-sm text-zinc-500">+{seleccionada.telefono}</p>
                {seleccionada.cliente?.mail && <p className="mt-1 break-all text-xs text-zinc-500">{seleccionada.cliente.mail}</p>}
              </div>

              <div className="grid gap-2">
                <Link href="/pedidos/nuevo" className="rounded-xl bg-[#fff200] px-4 py-3 text-center text-sm font-black text-black hover:bg-[#f5df00]">
                  + Nuevo pedido
                </Link>
                {seleccionada.cliente ? (
                  <Link href={`/pedidos?cliente=${encodeURIComponent(seleccionada.cliente.nombre)}`} className="rounded-xl border border-zinc-300 bg-white px-4 py-3 text-center text-sm font-bold text-zinc-700 hover:bg-zinc-100">
                    Ver todos los pedidos
                  </Link>
                ) : (
                  <Link href="/clientes/nuevo" className="rounded-xl border border-zinc-300 bg-white px-4 py-3 text-center text-sm font-bold text-zinc-700 hover:bg-zinc-100">
                    Crear cliente
                  </Link>
                )}
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[11px] font-black uppercase tracking-wider text-zinc-400">Pedidos recientes</p>
                  <span className="rounded-full bg-[#139ce8]/10 px-2 py-0.5 text-[10px] font-black text-[#0874ad]">{pedidos.length}</span>
                </div>
                <div className="space-y-2">
                  {pedidos.length ? pedidos.map((pedido) => (
                    <Link key={pedido.id} href={`/pedidos/${pedido.id}`} className="block rounded-xl border border-zinc-200 bg-white p-3 hover:border-[#139ce8]">
                      <div className="flex items-center justify-between gap-2">
                        <strong className="text-sm text-zinc-800">{pedido.numero}</strong>
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-600">{pedido.estado || "Sin estado"}</span>
                      </div>
                      {pedido.fecha && <p className="mt-1 text-xs text-zinc-400">{fechaHora.format(new Date(pedido.fecha))}</p>}
                    </Link>
                  )) : <p className="rounded-xl border border-dashed border-zinc-300 p-4 text-center text-xs text-zinc-400">No hay pedidos vinculados.</p>}
                </div>
              </div>

              <div className="rounded-xl border border-zinc-200 bg-white p-3 text-xs text-zinc-500">
                <strong className="block text-zinc-700">Vinculación automática</strong>
                El CRM busca un único cliente cuyos últimos 8 dígitos coincidan con el número de WhatsApp.
              </div>
            </div>
          ) : (
            <p className="text-center text-sm text-zinc-400">La información del cliente aparecerá al seleccionar una conversación.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
