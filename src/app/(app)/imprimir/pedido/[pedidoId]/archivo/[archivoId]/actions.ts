"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function marcarArchivoImpreso(pedidoId: string, archivoId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("archivos_pedido")
    .update({ impreso: true, estado: "En proceso" } as any)
    .eq("id", archivoId)
    .eq("pedido_id", pedidoId);

  if (error) return { error: error.message };

  await supabase
    .from("pedidos")
    .update({ estado: "En proceso" })
    .eq("id", pedidoId);

  revalidatePath(`/pedidos/${pedidoId}`);
  return { ok: true };
}
