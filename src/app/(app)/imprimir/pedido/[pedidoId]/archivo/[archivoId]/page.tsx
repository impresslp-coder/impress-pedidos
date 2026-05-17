import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import PrintViewer from "./print-viewer";

export const dynamic = "force-dynamic";

export default async function ImprimirArchivoPage({
  params,
}: {
  params: Promise<{ pedidoId: string; archivoId: string }>;
}) {
  const { pedidoId, archivoId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const admin = createAdminClient();
  const { data: pedido } = await admin
    .from("pedidos")
    .select("id, numero, estado, clientes(nombre, telefono)")
    .eq("id", pedidoId)
    .single();

  const { data: archivo } = await admin
    .from("archivos_pedido")
    .select("*")
    .eq("id", archivoId)
    .eq("pedido_id", pedidoId)
    .single();

  if (!pedido || !archivo) notFound();

  const pdfUrl = `/api/archivos/${(archivo as any).google_file_id}`;

  return <PrintViewer pedido={pedido as any} archivo={archivo as any} pdfUrl={pdfUrl} />;
}
