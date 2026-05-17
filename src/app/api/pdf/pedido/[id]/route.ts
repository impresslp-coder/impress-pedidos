import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { ResumenPedidoDoc } from "@/lib/pdf/resumen-pedido";
import { TicketPedidoDoc } from "@/lib/pdf/ticket-pedido";
import { TicketEntregaDoc } from "@/lib/pdf/ticket-entrega";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PEDIDO_SELECT = `*, clientes ( nombre, telefono, cod_pais ), items_pedido ( producto, paginas, modo, precio, descuento, anotacion, pago )`;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const tipo = req.nextUrl.searchParams.get("tipo") ?? "resumen";

  // Acepta autenticación por clave (IMPRESS Print standalone) o por cookie de sesión.
  const reqKey = req.nextUrl.searchParams.get("key");
  const validKey = process.env.PRINT_QUEUE_KEY;
  const useKeyAuth = !!validKey && !!reqKey && reqKey === validKey;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let pedido: any = null;

  if (useKeyAuth) {
    const admin = createAdminClient();
    const { data } = await admin.from("pedidos").select(PEDIDO_SELECT).eq("id", id).single();
    pedido = data;
  } else {
    const supabase = await createClient();
    const { data } = await supabase.from("pedidos").select(PEDIDO_SELECT).eq("id", id).single();
    pedido = data;
  }

  if (!pedido) return new NextResponse("Not found", { status: 404 });

  const cli = pedido.clientes;
  const items = pedido.items_pedido ?? [];
  const total = items.reduce((a: number, i: { precio?: number | null }) => a + (i.precio ?? 0), 0);
  const tel = cli ? `${cli.cod_pais ? "+" + cli.cod_pais : ""}${cli.telefono ?? ""}`.trim() : "";

  const data = {
    numero: pedido.numero ?? "0000000",
    fecha: pedido.fecha ? new Date(pedido.fecha).toLocaleDateString("es-AR") : "",
    cliente: cli?.nombre ?? "—",
    telefono: tel || null,
    items,
    senia: pedido.senia ?? 0,
    total,
    sucursal_retiro: pedido.sucursal_retiro ?? null,
    sucursal_produccion: pedido.sucursal_produccion ?? null,
    mensaje: pedido.mensaje ?? null,
    medio_pago: pedido.medio_pago ?? null,
  };

  if (tipo === "entrega" && !["Listo para retirar", "Entregado"].includes(String(pedido.estado ?? ""))) {
    return new NextResponse("El ticket de entrega se genera cuando el pedido esta listo para retirar.", { status: 409 });
  }

  const doc = tipo === "ticket"
    ? React.createElement(TicketPedidoDoc, { pedido: data })
    : tipo === "entrega"
      ? React.createElement(TicketEntregaDoc, { pedido: data })
      : React.createElement(ResumenPedidoDoc, { pedido: data });

  const filename = tipo === "ticket"
    ? `ticket-pedido-${pedido.numero}.pdf`
    : tipo === "entrega"
      ? `ticket-entrega-${pedido.numero}.pdf`
      : `resumen-${pedido.numero}.pdf`;

  try {
    const buffer = await renderToBuffer(doc);
    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("[pdf] renderToBuffer failed:", err);
    return new NextResponse(`Error generando PDF: ${String(err)}`, { status: 500 });
  }
}
