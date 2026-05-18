import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPrintToken } from "@/lib/print-token";

export const dynamic = "force-dynamic";

function validateKey(req: NextRequest, bodyKey?: string): boolean {
  const key = bodyKey || req.nextUrl.searchParams.get("key") || req.headers.get("x-print-key") || "";
  const expected = process.env.PRINT_QUEUE_KEY ?? "";
  return !!expected && key === expected;
}

function numberOrDefault(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function cleanText(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const token = cleanText(body.token);
  const payload = token ? verifyPrintToken(token) : null;
  const hasKey = validateKey(req, cleanText(body.key) ?? undefined);

  if (!payload && !hasKey) {
    return NextResponse.json({ error: "No autorizado para registrar impresion" }, { status: 401 });
  }

  const sourceType = body.sourceType === "ticket" ? "ticket" : "pdf";
  const ticketTypeRaw = cleanText(body.ticketType);
  const ticketType = ticketTypeRaw === "entrega" ? "entrega" : sourceType === "ticket" ? "pedido" : null;
  const pedidoId = sourceType === "pdf" && payload ? payload.pedidoId : cleanText(body.pedidoId);
  const archivoId = sourceType === "pdf" && payload ? payload.archivoId : cleanText(body.archivoId);

  if (!pedidoId) {
    return NextResponse.json({ error: "Falta pedido_id para registrar impresion" }, { status: 400 });
  }

  const copias = Math.max(1, Math.floor(numberOrDefault(body.copies, 1)));
  const paginas = sourceType === "ticket" ? 0 : Math.max(0, Math.floor(numberOrDefault(body.pagesPrinted, 0)));
  const hojas = sourceType === "ticket" ? 0 : Math.max(0, Math.floor(numberOrDefault(body.sheetsEstimated, 0)));
  const duration = body.durationMs == null ? null : Math.max(0, Math.floor(numberOrDefault(body.durationMs, 0)));
  const completedAt = cleanText(body.completedAt) || new Date().toISOString();

  const admin = createAdminClient();
  const { error } = await admin.from("pedido_print_events").insert({
    pedido_id: pedidoId,
    archivo_id: archivoId,
    source_type: sourceType,
    ticket_type: ticketType,
    job_name: cleanText(body.jobName),
    printer_name: cleanText(body.printerName),
    status: cleanText(body.status) || "completed",
    paginas_impresas: paginas,
    hojas_estimadas: hojas,
    copias,
    paper_name: cleanText(body.paperName),
    duplex_mode: cleanText(body.duplexMode),
    color: Boolean(body.color),
    page_ranges: cleanText(body.pageRangesText),
    started_at: cleanText(body.startedAt),
    completed_at: completedAt,
    duration_ms: duration,
    metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : {},
  } as any);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (sourceType === "ticket" && ticketType === "pedido") {
    await admin.from("pedidos").update({ estado: "En proceso" }).eq("id", pedidoId);
  }

  return NextResponse.json({ ok: true });
}
