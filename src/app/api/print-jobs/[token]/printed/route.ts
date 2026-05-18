import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPrintToken } from "@/lib/print-token";

function cleanText(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function numberOrDefault(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const payload = verifyPrintToken(token);
  if (!payload) return NextResponse.json({ error: "Trabajo vencido o invalido" }, { status: 401 });
  const body = await req.json().catch(() => ({}));

  const admin = createAdminClient();
  const { error } = await admin
    .from("archivos_pedido")
    .update({ impreso: true, estado: "En proceso" } as any)
    .eq("id", payload.archivoId)
    .eq("pedido_id", payload.pedidoId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (body && Object.keys(body).length > 0) {
    const copias = Math.max(1, Math.floor(numberOrDefault(body.copies, 1)));
    const paginas = Math.max(0, Math.floor(numberOrDefault(body.pagesPrinted, 0)));
    const hojas = Math.max(0, Math.floor(numberOrDefault(body.sheetsEstimated, 0)));
    const duration = body.durationMs == null ? null : Math.max(0, Math.floor(numberOrDefault(body.durationMs, 0)));

    const { error: eventError } = await admin.from("pedido_print_events").insert({
      pedido_id: payload.pedidoId,
      archivo_id: payload.archivoId,
      source_type: "pdf",
      ticket_type: null,
      job_name: cleanText(body.jobName),
      printer_name: cleanText(body.printerName),
      status: "completed",
      paginas_impresas: paginas,
      hojas_estimadas: hojas,
      copias,
      paper_name: cleanText(body.paperName),
      duplex_mode: cleanText(body.duplexMode),
      color: Boolean(body.color),
      page_ranges: cleanText(body.pageRangesText),
      started_at: cleanText(body.startedAt),
      completed_at: cleanText(body.completedAt) || new Date().toISOString(),
      duration_ms: duration,
      metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : {},
    } as any);

    if (eventError) return NextResponse.json({ error: eventError.message }, { status: 500 });
  }

  await admin
    .from("pedidos")
    .update({ estado: "En proceso" })
    .eq("id", payload.pedidoId);

  return NextResponse.json({ ok: true });
}
