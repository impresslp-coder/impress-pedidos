import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function validateKey(req: NextRequest): boolean {
  const key = req.nextUrl.searchParams.get("key") ?? req.headers.get("x-print-key") ?? "";
  const expected = process.env.PRINT_QUEUE_KEY ?? "";
  return !!expected && key === expected;
}

export async function GET(req: NextRequest) {
  if (!validateKey(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("pedidos")
    .select(`
      id, numero, fecha, estado, senia, sucursal_retiro,
      clientes ( nombre, telefono ),
      items_pedido ( precio )
    `)
    .in("estado", ["Encargo recibido", "En proceso", "Listo para retirar"])
    .order("fecha", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const base = req.nextUrl.origin;
  const key = req.nextUrl.searchParams.get("key")!;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tickets = (data ?? []).flatMap((pedido: any) => {
    const total = (pedido.items_pedido ?? []).reduce(
      (acc: number, item: { precio?: number | null }) => acc + (Number(item.precio) || 0),
      0,
    );
    const pdfBase = `${base}/api/pdf/pedido/${pedido.id}`;
    const keyParam = `key=${encodeURIComponent(key)}`;

    const rows = [];

    // Ticket de pedido para todos los pendientes
    rows.push({
      ticketKey: `pedido:${pedido.id}`,
      tipo: "ticket",
      tipoLabel: "Ticket de pedido",
      id: pedido.id,
      numero: pedido.numero,
      fecha: pedido.fecha,
      estado: pedido.estado,
      cliente: pedido.clientes?.nombre ?? "-",
      telefono: pedido.clientes?.telefono ?? "",
      sucursal_retiro: pedido.sucursal_retiro ?? "",
      total,
      senia: Number(pedido.senia) || 0,
      pdfUrl: `${pdfBase}?tipo=ticket&${keyParam}`,
    });

    // Ticket de entrega si está listo
    if (pedido.estado === "Listo para retirar") {
      rows.push({
        ticketKey: `entrega:${pedido.id}`,
        tipo: "entrega",
        tipoLabel: "Ticket de entrega",
        id: pedido.id,
        numero: pedido.numero,
        fecha: pedido.fecha,
        estado: pedido.estado,
        cliente: pedido.clientes?.nombre ?? "-",
        telefono: pedido.clientes?.telefono ?? "",
        sucursal_retiro: pedido.sucursal_retiro ?? "",
        total,
        senia: Number(pedido.senia) || 0,
        pdfUrl: `${pdfBase}?tipo=entrega&${keyParam}`,
      });
    }

    return rows;
  });

  return NextResponse.json({ tickets });
}
