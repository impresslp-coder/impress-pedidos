import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPrintToken } from "@/lib/print-token";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const payload = verifyPrintToken(token);
  if (!payload) return NextResponse.json({ error: "Trabajo vencido o invalido" }, { status: 401 });

  const admin = createAdminClient();
  const { error } = await admin
    .from("archivos_pedido")
    .update({ impreso: true, estado: "En proceso" } as any)
    .eq("id", payload.archivoId)
    .eq("pedido_id", payload.pedidoId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin
    .from("pedidos")
    .update({ estado: "En proceso" })
    .eq("id", payload.pedidoId);

  return NextResponse.json({ ok: true });
}
