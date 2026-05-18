import { createAdminClient } from "@/lib/supabase/admin";
import { RetiroEfectivoButton } from "./retiro-efectivo-button";
import { VentasSucursalClient } from "./ventas-sucursal-client";

const DENOMINACIONES = [20000, 10000, 2000, 1000, 500, 200, 100, 50, 20] as const;

function todayArg() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function dayRange(from: string, to: string) {
  return {
    start: `${from}T00:00:00-03:00`,
    end: `${to}T23:59:59-03:00`,
  };
}

function formatMoney(value: number) {
  return value.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date(value));
}

function tipoLabel(tipo: string) {
  if (tipo === "inicio") return "Inicio de caja";
  if (tipo === "cierre") return "Cierre de jornada";
  if (tipo === "retiro") return "Retiro de efectivo";
  if (tipo === "gasto") return "Gasto";
  return tipo;
}

function tipoClass(tipo: string) {
  if (tipo === "inicio") return "bg-emerald-100 text-emerald-700";
  if (tipo === "cierre") return "bg-zinc-900 text-white";
  if (tipo === "retiro") return "bg-sky-100 text-sky-700";
  return "bg-rose-100 text-rose-700";
}

export default async function EstadisticasPage({
  searchParams,
}: {
  searchParams?: Promise<{ desde?: string; hasta?: string }>;
}) {
  const params = await searchParams;
  const defaultDay = todayArg();
  const desde = params?.desde || defaultDay;
  const hasta = params?.hasta || desde;
  const { start, end } = dayRange(desde, hasta);

  const admin = createAdminClient();
  let cajaQuery = await admin
    .from("caja_jornadas")
    .select("id, tipo, usuario_nombre, billetes, gastos, total, created_at")
    .gte("created_at", start)
    .lte("created_at", end)
    .order("created_at", { ascending: false });

  if (cajaQuery.error?.message.includes("gastos")) {
    cajaQuery = await admin
      .from("caja_jornadas")
      .select("id, tipo, usuario_nombre, billetes, total, created_at")
      .gte("created_at", start)
      .lte("created_at", end)
      .order("created_at", { ascending: false });
  }

  const { data: ventasData } = await admin
    .from("ventas")
    .select("id, numero_venta, fecha, sucursal, total, items_venta(producto_id, producto_nombre, cantidad, total)")
    .gte("fecha", start)
    .lte("fecha", end)
    .order("fecha", { ascending: false });

  const registros = (cajaQuery.data ?? []) as Array<{
    id: string;
    tipo: "inicio" | "cierre" | "retiro" | "gasto";
    usuario_nombre: string | null;
    billetes: Record<string, number> | null;
    gastos?: Array<{ concepto: string; valor: number; medio_pago: string }> | null;
    total: number | string;
    created_at: string;
  }>;

  const ventas = ((ventasData ?? []) as any[]).map((venta) => {
    const items = ((venta.items_venta ?? []) as any[]).map((item) => ({
      nombre: item.producto_nombre ?? "Item",
      cantidad: Number(item.cantidad) || 0,
      total: Number(item.total) || 0,
      tipo: item.producto_id ? "producto" as const : "impresion" as const,
    }));
    return {
      id: venta.id as string,
      numero: venta.numero_venta as string,
      fecha: (venta.fecha ?? "") as string,
      total: Number(venta.total) || items.reduce((acc, item) => acc + item.total, 0),
      sucursal: (venta.sucursal as string | null) || "Sin sucursal",
      items,
    };
  });

  const grouped = new Map<string, {
    sucursal: string;
    ventas: number;
    total: number;
    impresion: number;
    productos: number;
    detalles: typeof ventas;
  }>();

  for (const venta of ventas) {
    const row = grouped.get(venta.sucursal) ?? {
      sucursal: venta.sucursal,
      ventas: 0,
      total: 0,
      impresion: 0,
      productos: 0,
      detalles: [],
    };
    row.ventas += 1;
    row.total += venta.total;
    row.impresion += venta.items.filter((i) => i.tipo === "impresion").reduce((acc, item) => acc + item.total, 0);
    row.productos += venta.items.filter((i) => i.tipo === "producto").reduce((acc, item) => acc + item.total, 0);
    row.detalles.push(venta);
    grouped.set(venta.sucursal, row);
  }

  const ventasStats = [...grouped.values()].sort((a, b) => b.total - a.total);
  const totalVentas = ventasStats.reduce((acc, row) => acc + row.total, 0);
  const totalRetiros = registros.filter((r) => r.tipo === "retiro").reduce((acc, row) => acc + Number(row.total || 0), 0);
  const totalGastos = registros.filter((r) => r.tipo === "gasto").reduce((acc, row) => acc + Number(row.total || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-black text-brand">Estadisticas</h1>
          <p className="text-sm text-zinc-500">Caja, gastos, retiros y ventas por sucursal.</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <form className="flex flex-wrap items-end gap-3">
            <label>
              <span className="block text-xs font-black uppercase text-zinc-500">Desde</span>
              <input name="desde" type="date" defaultValue={desde} className="mt-1 rounded-lg border border-zinc-300 bg-white px-3 py-3 font-bold text-brand" />
            </label>
            <label>
              <span className="block text-xs font-black uppercase text-zinc-500">Hasta</span>
              <input name="hasta" type="date" defaultValue={hasta} className="mt-1 rounded-lg border border-zinc-300 bg-white px-3 py-3 font-bold text-brand" />
            </label>
            <button type="submit" className="rounded-lg bg-brand px-4 py-3 font-black text-white hover:bg-black">
              Filtrar
            </button>
          </form>
          <RetiroEfectivoButton />
        </div>
      </div>

      {cajaQuery.error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          <p className="font-black">Falta preparar la tabla de caja.</p>
          <p>Corré en Supabase el archivo: scripts/migracion-caja-estadisticas.sql</p>
          <p className="mt-2 text-xs">{cajaQuery.error.message}</p>
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase text-zinc-500">Ventas del rango</p>
          <p className="mt-2 text-3xl font-black text-brand">{formatMoney(totalVentas)}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase text-zinc-500">Retiros de efectivo</p>
          <p className="mt-2 text-3xl font-black text-sky-700">{formatMoney(totalRetiros)}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase text-zinc-500">Gastos declarados</p>
          <p className="mt-2 text-3xl font-black text-rose-700">{formatMoney(totalGastos)}</p>
        </div>
      </section>

      <VentasSucursalClient stats={ventasStats} />

      <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-200 px-5 py-4">
          <h2 className="text-xl font-black text-brand">Movimientos de caja</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-5 py-3">Fecha</th>
                <th className="px-5 py-3">Tipo</th>
                <th className="px-5 py-3">Operador</th>
                <th className="px-5 py-3">Detalle</th>
                <th className="px-5 py-3 text-right">Total</th>
                {DENOMINACIONES.map((denominacion) => (
                  <th key={denominacion} className="px-3 py-3 text-right">
                    $ {denominacion.toLocaleString("es-AR")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {registros.map((registro) => {
                const billetes = registro.billetes ?? {};
                const gastos = registro.gastos ?? [];
                return (
                  <tr key={registro.id} className="border-t border-zinc-100">
                    <td className="px-5 py-4 font-semibold text-zinc-700">{formatDate(registro.created_at)}</td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-3 py-1 text-xs font-black ${tipoClass(registro.tipo)}`}>
                        {tipoLabel(registro.tipo)}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-semibold text-zinc-700">{registro.usuario_nombre || "-"}</td>
                    <td className="px-5 py-4 text-zinc-600">
                      {registro.tipo === "gasto" && gastos.length
                        ? gastos.map((g) => `${g.concepto} · ${g.medio_pago} · ${formatMoney(Number(g.valor) || 0)}`).join(" / ")
                        : "-"}
                    </td>
                    <td className="px-5 py-4 text-right text-lg font-black text-brand">{formatMoney(Number(registro.total) || 0)}</td>
                    {DENOMINACIONES.map((denominacion) => (
                      <td key={denominacion} className="px-3 py-4 text-right font-semibold text-zinc-700">
                        {Number(billetes[String(denominacion)]) || 0}
                      </td>
                    ))}
                  </tr>
                );
              })}
              {!registros.length && !cajaQuery.error && (
                <tr>
                  <td colSpan={14} className="px-5 py-10 text-center text-zinc-500">
                    Todavia no hay registros de caja en este rango.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
