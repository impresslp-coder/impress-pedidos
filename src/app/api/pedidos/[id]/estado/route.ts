import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

const ESTADOS_VALIDOS = [
  "Presupuesto",
  "Encargo recibido",
  "En producción",
  "Listo para entregar",
  "Entregado",
  "Cancelado",
];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { estado } = await req.json();
  if (!estado) return NextResponse.json({ error: "Falta estado" }, { status: 400 });
  if (!ESTADOS_VALIDOS.includes(estado)) {
    return NextResponse.json({ error: `Estado inválido: ${estado}` }, { status: 400 });
  }
  if (estado === "En producción") {
    return NextResponse.json({ error: "Para iniciar Producción usá la acción de tomar el pedido desde su detalle." }, { status: 409 });
  }

  const admin = createAdminClient();
  if (estado === "Listo para entregar") {
    const { data: pedido, error: pedidoError } = await admin
      .from("pedidos")
      .select("ubicacion")
      .eq("id", id)
      .single();
    if (pedidoError) return NextResponse.json({ error: pedidoError.message }, { status: 500 });
    if (!pedido?.ubicacion?.trim()) {
      return NextResponse.json({ error: "Indicá la ubicación física antes de pasar el pedido a Listo para entregar." }, { status: 409 });
    }
  }
  const { error } = await admin
    .from("pedidos")
    .update({ estado })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  revalidatePath(`/pedidos/${id}`);
  revalidatePath("/pedidos");
  revalidatePath("/admin/cola");
  return NextResponse.json({ ok: true });
}
