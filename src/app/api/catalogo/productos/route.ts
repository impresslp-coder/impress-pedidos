import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: perfil } = await admin
    .from("usuarios_sistema")
    .select("rol, codigo_personal")
    .eq("id", user.id)
    .single();

  if ((perfil as any)?.rol !== "admin") {
    return NextResponse.json({ error: "Solo admins" }, { status: 403 });
  }

  const body = await req.json();
  const { nombre, categoria, codigo_barras, paginas, precio, precio_compra, descuento_maximo, stock_inicial, tipo, codigo_personal } = body;

  if (!nombre?.trim()) return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
  if (!codigo_personal?.trim()) return NextResponse.json({ error: "Ingresá tu código de operador" }, { status: 400 });

  const codigoGuardado = (perfil as any)?.codigo_personal;
  if (codigoGuardado && codigoGuardado !== codigo_personal.trim()) {
    return NextResponse.json({ error: "Código de operador incorrecto" }, { status: 400 });
  }

  const { data: prod, error } = await admin
    .from("productos")
    .insert({
      nombre: nombre.trim(),
      categoria: categoria?.trim() || null,
      codigo_barras: codigo_barras?.trim() || null,
      paginas: paginas ? parseInt(paginas) : null,
      precio: precio ? parseFloat(precio) : null,
      precio_compra: precio_compra ? parseFloat(precio_compra) : null,
      descuento_maximo: descuento_maximo ? parseFloat(descuento_maximo) : 0,
      tipo: tipo || "encargo",
      activo: true,
    } as any)
    .select("id")
    .single();

  if (error || !prod) return NextResponse.json({ error: error?.message ?? "Error al crear" }, { status: 500 });

  await admin.from("stock").insert({ producto_id: (prod as any).id, cantidad: stock_inicial ? parseInt(stock_inicial) : 0 } as any);

  return NextResponse.json({ ok: true, id: (prod as any).id });
}
