import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { TicketTerciarizadoDoc } from "@/lib/pdf/ticket-terciarizado";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("No autenticado", { status: 401 });

  const { data: encargo } = await supabase
    .from("terciarizados")
    .select("*")
    .eq("id", id)
    .single();

  if (!encargo) return new NextResponse("No encontrado", { status: 404 });

  const data = {
    numero:    encargo.numero   ?? "E-0000",
    fecha:     encargo.creado_en
      ? new Date(encargo.creado_en).toLocaleDateString("es-AR")
      : new Date().toLocaleDateString("es-AR"),
    cliente:   encargo.cliente  ?? "—",
    telefono:  encargo.telefono ?? null,
    item:      encargo.item     ?? "—",
    cantidad:  encargo.cantidad ?? null,
    anotacion: encargo.anotacion ?? null,
    proveedor: encargo.proveedor ?? "—",
    total:     encargo.total    ?? 0,
    senia:     encargo.senia    ?? 0,
    sucursal:  encargo.sucursal ?? null,
    mensaje:   encargo.mensaje  ?? null,
  };

  try {
    const buffer = await renderToBuffer(
      React.createElement(TicketTerciarizadoDoc, { encargo: data })
    );
    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        "Content-Type":        "application/pdf",
        "Content-Disposition": `inline; filename="terciarizado-${encargo.numero}.pdf"`,
      },
    });
  } catch (err) {
    console.error("[pdf/terciarizado] renderToBuffer failed:", err);
    return new NextResponse(`Error generando PDF: ${String(err)}`, { status: 500 });
  }
}
