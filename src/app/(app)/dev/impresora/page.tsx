import { createClient } from "@/lib/supabase/server";
import ImpresoraVirtual from "./impresora-virtual";

export const dynamic = "force-dynamic";

export default async function ImpresoraPage() {
  const supabase = await createClient();

  const { data: pedidos } = await supabase
    .from("pedidos")
    .select("id, numero, estado, clientes(nombre)")
    .order("created_at", { ascending: false })
    .limit(30);

  return <ImpresoraVirtual pedidos={pedidos ?? []} />;
}
