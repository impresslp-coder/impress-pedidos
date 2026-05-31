import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// GET ?semana=YYYY-MM-DD — devuelve asistencia de todos los empleados de la semana
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const admin = createAdminClient();

  // Todos los usuarios del sistema
  const { data: usuarios } = await admin
    .from("usuarios_sistema")
    .select("id, nombre, rol")
    .order("nombre");

  // Rango de fechas — semana solicitada (por defecto semana actual)
  const semanaParam = req.nextUrl.searchParams.get("semana");
  const lunes = semanaParam ? new Date(semanaParam) : (() => {
    const hoy = new Date();
    const d = hoy.getDay();
    const diff = d === 0 ? -6 : 1 - d;
    const l = new Date(hoy);
    l.setDate(hoy.getDate() + diff);
    return l;
  })();
  lunes.setHours(0, 0, 0, 0);
  const domingo = new Date(lunes);
  domingo.setDate(lunes.getDate() + 6);

  const desde = lunes.toISOString().split("T")[0];
  const hasta = domingo.toISOString().split("T")[0];

  const { data: registros } = await admin
    .from("asistencia")
    .select("*")
    .gte("fecha", desde)
    .lte("fecha", hasta);

  return NextResponse.json({
    usuarios: usuarios ?? [],
    registros: registros ?? [],
    semana: { desde, hasta },
  });
}

// POST — registrar o actualizar asistencia
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const admin = createAdminClient();
  const { data: perfil } = await admin
    .from("usuarios_sistema").select("rol").eq("id", user.id).single();

  const body = await req.json();
  const { usuario_id, fecha, estado, hora_entrada, hora_salida, notas } = body;

  // Solo admins pueden editar asistencia de otros; cualquier usuario puede registrar la propia
  if ((perfil as any)?.rol !== "admin" && usuario_id !== user.id) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  if (!usuario_id || !fecha) {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("asistencia")
    .upsert(
      {
        usuario_id,
        fecha,
        estado: estado ?? "presente",
        hora_entrada: hora_entrada ?? null,
        hora_salida:  hora_salida  ?? null,
        notas:        notas        ?? null,
      },
      { onConflict: "usuario_id,fecha" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, registro: data });
}

// PATCH — auto-registro de entrada (primer login del día)
export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const admin = createAdminClient();
  const hoy = new Date().toISOString().split("T")[0];
  const hora = new Date().toTimeString().slice(0, 5); // HH:MM

  // Solo insertar si no existe registro para hoy (no pisar hora si ya entró)
  const { data: existe } = await admin
    .from("asistencia")
    .select("id")
    .eq("usuario_id", user.id)
    .eq("fecha", hoy)
    .single();

  if (existe) return NextResponse.json({ ok: true, ya_registrado: true });

  const { error } = await admin
    .from("asistencia")
    .insert({ usuario_id: user.id, fecha: hoy, estado: "presente", hora_entrada: hora });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, ya_registrado: false });
}
