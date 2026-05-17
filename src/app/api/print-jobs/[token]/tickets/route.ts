import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPrintToken } from "@/lib/print-token";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const payload = verifyPrintToken(token);
  if (!payload) return NextResponse.json({ error: "Trabajo vencido o invalido" }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("pedidos")
    .select("id, numero, fecha, estado, senia, sucursal_retiro, clientes(nombre, telefono), items_pedido(precio)")
    .in("estado", ["Encargo recibido", "En proceso", "Listo para retirar"])
    .order("fecha", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const base = new URL(req.url).origin;
  const tickets = (data ?? []).map((pedido: any) => {
    const total = (pedido.items_pedido ?? []).reduce((acc: number, item: any) => acc + (Number(item.precio) || 0), 0);
    const tipo = pedido.estado === "Listo para retirar" ? "entrega" : "pedido";
    return {
      ticketKey: `${tipo}:${pedido.id}`,
      tipo,
      tipoLabel: tipo === "entrega" ? "Ticket de entrega" : "Ticket de pedido",
      id: pedido.id,
      numero: pedido.numero,
      fecha: pedido.fecha,
      estado: pedido.estado,
      cliente: pedido.clientes?.nombre ?? "-",
      telefono: pedido.clientes?.telefono ?? "",
      sucursal_retiro: pedido.sucursal_retiro ?? "",
      total,
      senia: Number(pedido.senia) || 0,
      pdfUrl: `${base}/api/print-jobs/${encodeURIComponent(token)}/tickets/${pedido.id}/pdf?tipo=${tipo}`,
    };
  });

  return NextResponse.json({ tickets });
}
