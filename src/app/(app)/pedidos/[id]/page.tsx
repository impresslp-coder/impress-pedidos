import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import PedidoDetalleEditor from "./pedido-detalle-editor";

export const dynamic = "force-dynamic";

function fmtInt(value: number) {
  return new Intl.NumberFormat("es-AR").format(value);
}

function fmtDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("es-AR");
}

function fmtDuration(ms: number | null) {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return "-";
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}

function firstDate(events: any[], predicate: (event: any) => boolean) {
  const dates = events
    .filter(predicate)
    .map((event) => new Date(event.completed_at || event.creado_en || ""))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());
  return dates[0] ?? null;
}

function PrintStatsPanel({ events, error }: { events: any[]; error?: string }) {
  const totalJobs = events.length;
  const pdfJobs = events.filter((event) => event.source_type === "pdf").length;
  const ticketJobs = events.filter((event) => event.source_type === "ticket").length;
  const pdfEvents = events.filter((event) => event.source_type === "pdf");
  const ticketPrints = events
    .filter((event) => event.source_type === "ticket")
    .reduce((acc, event) => acc + (Number(event.copias) || 1), 0);
  const pages = pdfEvents.reduce((acc, event) => acc + (Number(event.paginas_impresas) || 0), 0);
  const sheets = pdfEvents.reduce((acc, event) => acc + (Number(event.hojas_estimadas) || 0), 0);
  const firstPedidoTicket = firstDate(events, (event) => event.source_type === "ticket" && event.ticket_type === "pedido");
  const firstEntregaTicket = firstDate(events, (event) => event.source_type === "ticket" && event.ticket_type === "entrega");
  const productionMs = firstPedidoTicket
    ? (firstEntregaTicket ?? new Date()).getTime() - firstPedidoTicket.getTime()
    : null;
  const cards = [
    ["Trabajos", fmtInt(totalJobs), `${pdfJobs} PDF · ${ticketJobs} tickets`],
    ["Hojas usadas", fmtInt(sheets), `${fmtInt(pages)} pagina(s) enviadas`],
    ["Tickets impresos", fmtInt(ticketPrints), "No cuentan como paginas ni hojas"],
    ["Produccion", fmtDuration(productionMs), firstEntregaTicket ? "Cerrado con ticket de entrega" : firstPedidoTicket ? "En curso" : "Sin ticket inicial"],
  ];

  return (
    <section className="bg-white rounded-xl border border-zinc-200 shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Estadistica de impresion</h2>
          <p className="text-xs text-zinc-400 mt-1">Registrada desde IMPRESS Print cuando se ejecuta la cola.</p>
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
          No pude cargar la estadistica: {error}
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {cards.map(([label, value, detail]) => (
          <div key={label} className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">{label}</p>
            <p className="mt-1 text-xl font-black text-[#1a1a2e]">{value}</p>
            <p className="mt-1 text-xs text-zinc-500">{detail}</p>
          </div>
        ))}
      </div>

      {events.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-xs">
            <thead>
              <tr className="border-b border-zinc-200 text-left uppercase tracking-wide text-zinc-500">
                <th className="py-2 pr-3">Fecha</th>
                <th className="py-2 px-3">Trabajo</th>
                <th className="py-2 px-3">Impresora</th>
                <th className="py-2 px-3 text-right">Pag.</th>
                <th className="py-2 px-3 text-right">Hojas</th>
                <th className="py-2 pl-3">Config.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {events.slice(0, 8).map((event) => (
                <tr key={event.id}>
                  <td className="py-2 pr-3 text-zinc-500">{fmtDateTime(event.completed_at)}</td>
                  <td className="py-2 px-3 font-semibold text-zinc-800">{event.job_name || event.source_type}</td>
                  <td className="py-2 px-3 text-zinc-600">{event.printer_name || "-"}</td>
                  <td className="py-2 px-3 text-right font-mono">{event.source_type === "ticket" ? "-" : fmtInt(Number(event.paginas_impresas) || 0)}</td>
                  <td className="py-2 px-3 text-right font-mono">{event.source_type === "ticket" ? "-" : fmtInt(Number(event.hojas_estimadas) || 0)}</td>
                  <td className="py-2 pl-3 text-zinc-500">
                    {event.source_type === "ticket"
                      ? `${event.copias || 1} ticket(s)`
                      : `${event.copias || 1} cop. · ${event.duplex_mode === "simplex" ? "simple" : "doble"} · ${event.color ? "color" : "B&N"}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default async function DetallePedidoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();
  const admin = createAdminClient();

  const { data: pedido } = await admin
    .from("pedidos")
    .select(`
      *,
      clientes ( nombre, telefono, cod_pais, mail ),
      items_pedido ( * ),
      archivos_pedido ( * ),
      usuarios_sistema ( nombre )
    `)
    .eq("id", id)
    .single();

  if (!pedido) notFound();

  const items = ((pedido as any).items_pedido as any[]) ?? [];
  const archivos = ((pedido as any).archivos_pedido as any[]) ?? [];
  const usuario = (pedido as any).usuarios_sistema as any;
  const { data: printEvents, error: printEventsError } = await admin
    .from("pedido_print_events")
    .select("*")
    .eq("pedido_id", id)
    .order("completed_at", { ascending: false });

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3">
            <Link href="/pedidos" className="text-zinc-400 hover:text-zinc-600 text-sm">
              Volver a pedidos
            </Link>
            <span className="text-zinc-300">|</span>
            <h1 className="text-2xl font-black font-mono text-[#1a1a2e]">#{(pedido as any).numero}</h1>
          </div>
          <p className="text-zinc-500 text-sm mt-1">
            {(pedido as any).fecha ? new Date((pedido as any).fecha).toLocaleString("es-AR") : "-"}
            {usuario?.nombre && ` · Por ${usuario.nombre}`}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <a href={`/api/pdf/pedido/${id}?tipo=resumen`} target="_blank" rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-lg bg-[#1a1a2e] text-white text-xs font-bold hover:bg-zinc-800 transition">
            Resumen PDF
          </a>
          <a href={`/api/pdf/pedido/${id}?tipo=ticket`} target="_blank" rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-lg bg-[#f5a623] text-[#1a1a2e] text-xs font-bold hover:bg-amber-400 transition">
            Ticket pedido
          </a>
          {["Listo para retirar", "Entregado"].includes(String((pedido as any).estado ?? "")) && (
            <a href={`/api/pdf/pedido/${id}?tipo=entrega`} target="_blank" rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition">
              Ticket entrega
            </a>
          )}
        </div>
      </div>

      <PrintStatsPanel events={(printEvents as any[]) ?? []} error={printEventsError?.message} />
      <PedidoDetalleEditor pedido={pedido as any} itemsIniciales={items} archivos={archivos} />
    </div>
  );
}
