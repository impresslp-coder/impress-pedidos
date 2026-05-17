import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPrintToken } from "@/lib/print-token";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { TicketPedidoDoc } from "@/lib/pdf/ticket-pedido";
import { TicketEntregaDoc } from "@/lib/pdf/ticket-entrega";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string; pedidoId: string }> },
) {
  const { token, pedidoId } = await params;
  const payload = verifyPrintToken(token);
  if (!payload) return NextResponse.json({ error: "Trabajo vencido o invalido" }, { status: 401 });

  const admin = createAdminClient();
  const { data: pedido } = await admin
    .from("pedidos")
    .select("*, clientes(nombre, telefono, cod_pais), items_pedido(producto, paginas, modo, precio, descuento, anotacion, pago)")
    .eq("id", pedidoId)
    .single();

  if (!pedido) return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
  const tipo = new URL(req.url).searchParams.get("tipo") === "entrega" ? "entrega" : "pedido";
  if (tipo === "entrega" && !["Listo para retirar", "Entregado"].includes(String((pedido as any).estado ?? ""))) {
    return NextResponse.json({ error: "El pedido todavia no esta listo para entregar" }, { status: 409 });
  }

  const cli = (pedido as any).clientes;
  const items = ((pedido as any).items_pedido as any[]) ?? [];
  const total = items.reduce((acc, item) => acc + (Number(item.precio) || 0), 0);
  const telefono = cli ? `${cli.cod_pais ? "+" + cli.cod_pais : ""}${cli.telefono ?? ""}`.trim() : "";

  const ticketData = {
    numero: (pedido as any).numero ?? "0000000",
    fecha: (pedido as any).fecha ? new Date((pedido as any).fecha).toLocaleDateString("es-AR") : "",
    cliente: cli?.nombre ?? "-",
    telefono: telefono || null,
    items,
    senia: Number((pedido as any).senia) || 0,
    total,
    sucursal_retiro: (pedido as any).sucursal_retiro ?? null,
    sucursal_produccion: (pedido as any).sucursal_produccion ?? null,
    mensaje: (pedido as any).mensaje ?? null,
    medio_pago: (pedido as any).medio_pago ?? null,
  };

  const doc = tipo === "entrega"
    ? React.createElement(TicketEntregaDoc, { pedido: ticketData })
    : React.createElement(TicketPedidoDoc, { pedido: ticketData });

  const buffer = await renderToBuffer(doc);
  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="ticket-${tipo}-${(pedido as any).numero}.pdf"`,
    },
  });
}
