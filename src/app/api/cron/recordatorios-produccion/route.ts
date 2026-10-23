import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

type PedidoVencido = {
  id: string;
  numero: string;
  sucursal_produccion: string | null;
  produccion_por: string | null;
  produccion_iniciada_en: string | null;
  produccion_vence_en: string | null;
};

type Perfil = {
  id: string;
  rol: string;
  sucursal_default: string | null;
  activo: boolean | null;
};

function codigoSucursal(value: string | null) {
  const code = String(value ?? "").replace(/\D/g, "");
  return ["41", "44", "60"].includes(code) ? code : null;
}

function horasDesde(value: string | null, now: number) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? (now - time) / 3_600_000 : 0;
}

function autorizado(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!autorizado(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();
  const { data: pedidos, error: pedidosError } = await admin
    .from("pedidos")
    .select("id, numero, sucursal_produccion, produccion_por, produccion_iniciada_en, produccion_vence_en")
    .eq("estado", "En producción")
    .is("produccion_terminada_en", null)
    .lte("produccion_vence_en", now.toISOString());

  if (pedidosError) {
    return NextResponse.json({ error: pedidosError.message }, { status: 500 });
  }
  if (!pedidos?.length) {
    return NextResponse.json({ ok: true, vencidos: 0, avisos: 0 });
  }

  const { data: perfiles, error: perfilesError } = await admin
    .from("usuarios_sistema")
    .select("id, rol, sucursal_default, activo")
    .eq("activo", true);
  if (perfilesError) {
    return NextResponse.json({ error: perfilesError.message }, { status: 500 });
  }

  let avisos = 0;
  const nowMs = now.getTime();
  const desdeHace24Horas = new Date(nowMs - 24 * 3_600_000).toISOString();

  for (const pedido of (pedidos as PedidoVencido[])) {
    const sucursal = codigoSucursal(pedido.sucursal_produccion);
    const encargados = ((perfiles ?? []) as Perfil[])
      .filter((perfil) => perfil.rol === "admin" && codigoSucursal(perfil.sucursal_default) === sucursal)
      .map((perfil) => perfil.id);
    const destinatarios = [...new Set([pedido.produccion_por, ...encargados].filter((id): id is string => Boolean(id)))];
    if (!destinatarios.length) continue;

    const vencido48Horas = horasDesde(pedido.produccion_vence_en, nowMs) >= 24;
    const niveles = [
      {
        motivo: "produccion vencida",
        tipo: "produccion_vencida_24h",
        titulo: `Producción vencida · Pedido #${pedido.numero}`,
        detalle: `El pedido superó las 24 horas corridas de producción.${sucursal ? ` Sucursal ${sucursal}.` : ""}`,
      },
      ...(vencido48Horas ? [{
        motivo: "produccion vencida 48h",
        tipo: "produccion_vencida_48h",
        titulo: `Escalamiento de producción · Pedido #${pedido.numero}`,
        detalle: `El pedido lleva más de 48 horas corridas vencido. Requiere aviso al encargado por WhatsApp.${sucursal ? ` Sucursal ${sucursal}.` : ""}`,
      }] : []),
    ];

    for (const nivel of niveles) {
      for (const destinatario of destinatarios) {
        const { data: existente, error: existenteError } = await admin
          .from("recordatorios_produccion")
          .select("id")
          .eq("pedido_id", pedido.id)
          .eq("destinatario", destinatario)
          .eq("motivo", nivel.motivo)
          .gte("enviado_en", desdeHace24Horas)
          .limit(1);
        if (existenteError) {
          return NextResponse.json({ error: existenteError.message }, { status: 500 });
        }
        if (existente?.length) continue;

        const { error: recordatorioError } = await admin
          .from("recordatorios_produccion")
          .insert({ pedido_id: pedido.id, destinatario, motivo: nivel.motivo });
        if (recordatorioError) {
          return NextResponse.json({ error: recordatorioError.message }, { status: 500 });
        }
        const { error: notificacionError } = await admin
          .from("notificaciones")
          .insert({ usuario_id: destinatario, pedido_id: pedido.id, tipo: nivel.tipo, titulo: nivel.titulo, detalle: nivel.detalle });
        if (notificacionError) {
          return NextResponse.json({ error: notificacionError.message }, { status: 500 });
        }
        avisos += 1;
      }
    }
  }

  return NextResponse.json({ ok: true, vencidos: pedidos.length, avisos });
}
