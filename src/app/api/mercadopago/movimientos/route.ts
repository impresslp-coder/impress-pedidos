import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function argentinaDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function dayRange(date = new Date()) {
  const day = argentinaDate(date);
  return {
    begin: `${day}T00:00:00.000-03:00`,
    end: `${day}T23:59:59.999-03:00`,
  };
}

function horaArgentina(value: string | null | undefined) {
  if (!value) return "";
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export async function GET() {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "Falta configurar MERCADOPAGO_ACCESS_TOKEN en .env.local" },
      { status: 500 },
    );
  }

  const { begin, end } = dayRange();
  const meRes = await fetch("https://api.mercadopago.com/users/me", {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const me = await meRes.json();
  const collectorId = me?.id ? String(me.id) : "";
  if (!collectorId) {
    return NextResponse.json(
      { error: "No pude identificar la cuenta de Mercado Pago del token", detail: me },
      { status: 500 },
    );
  }

  const params = new URLSearchParams({
    sort: "date_created",
    criteria: "desc",
    range: "date_created",
    begin_date: begin,
    end_date: end,
    limit: "50",
  });

  const res = await fetch(`https://api.mercadopago.com/v1/payments/search?${params}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  const data = await res.json();
  if (!res.ok) {
    return NextResponse.json(
      { error: data?.message ?? "No pude consultar Mercado Pago", detail: data },
      { status: res.status },
    );
  }

  const admin = createAdminClient();
  let linkedPaymentIds = new Set<string>();
  const linked = await admin
    .from("pedidos")
    .select("mercado_pago_payment_id, mensaje");
  if (!linked.error) {
    linkedPaymentIds = new Set(
      ((linked.data as any[]) ?? [])
        .flatMap((row) => [
          row.mercado_pago_payment_id ? String(row.mercado_pago_payment_id) : "",
          ...(String(row.mensaje ?? "").match(/MP:\s*(\d+)/g) ?? []).map((match) => match.replace(/\D/g, "")),
        ])
        .filter(Boolean),
    );
  } else {
    const fallback = await admin.from("pedidos").select("mensaje");
    if (!fallback.error) {
      linkedPaymentIds = new Set(
        ((fallback.data as any[]) ?? [])
          .flatMap((row) => (String(row.mensaje ?? "").match(/MP:\s*(\d+)/g) ?? []).map((match) => match.replace(/\D/g, "")))
          .filter(Boolean),
      );
    }
  }

  const movements = ((data.results as any[]) ?? [])
    .map((payment) => ({
      id: String(payment.id),
      status: payment.status,
      status_detail: payment.status_detail,
      hora: horaArgentina(payment.date_approved ?? payment.date_created),
      date_created: payment.date_created,
      date_approved: payment.date_approved,
      amount: Number(payment.transaction_amount ?? payment.transaction_details?.total_paid_amount ?? 0),
      description: payment.description ?? "",
      payment_method_id: payment.payment_method_id ?? "",
      payment_type_id: payment.payment_type_id ?? "",
      operation_type: payment.operation_type ?? "",
      collector_id: payment.collector_id ? String(payment.collector_id) : payment.collector?.id ? String(payment.collector.id) : "",
      money_release_status: payment.money_release_status ?? "",
      payer_name: [payment.payer?.first_name, payment.payer?.last_name].filter(Boolean).join(" "),
      payer_email: payment.payer?.email ?? "",
      payer_id: payment.payer?.id ? String(payment.payer.id) : "",
      external_reference: payment.external_reference ?? "",
    }))
    .filter((payment) =>
      payment.status === "approved" &&
      payment.amount > 0 &&
      !linkedPaymentIds.has(payment.id) &&
      payment.collector_id === collectorId &&
      ["regular_payment", "money_transfer"].includes(payment.operation_type)
    );

  return NextResponse.json({ movements });
}
