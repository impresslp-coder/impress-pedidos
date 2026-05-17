import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (quoted && ch === "\"" && next === "\"") {
      cell += "\"";
      i++;
    } else if (ch === "\"") {
      quoted = !quoted;
    } else if (ch === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((ch === "\n" || ch === "\r") && !quoted) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }

  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function parseMoney(value: string) {
  const cleaned = value
    .replace(/\$/g, "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(/,/g, ".");
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : null;
}

function parseStock(value: string) {
  const num = parseInt((value ?? "").replace(/\s/g, ""), 10);
  return Number.isFinite(num) ? num : 0;
}

function driveImageUrl(url: string) {
  const match = url.match(/\/d\/([^/]+)/) ?? url.match(/[?&]id=([^&]+)/);
  return match?.[1] ? `https://drive.google.com/uc?export=view&id=${match[1]}` : (url || null);
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: perfil } = await admin
    .from("usuarios_sistema")
    .select("rol")
    .eq("id", user.id)
    .single();

  if ((perfil as any)?.rol !== "admin") {
    return NextResponse.json({ error: "Solo admins" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "Falta archivo CSV" }, { status: 400 });

  const rows = parseCsv(await file.text());
  const dataRows = rows.slice(1);
  let creados = 0;
  let actualizados = 0;

  for (const cols of dataRows) {
    const codigo = (cols[0] ?? "").trim();
    const nombre = (cols[1] ?? "").trim();
    if (!codigo || !nombre) continue;

    const precioCompra = parseMoney(cols[2] ?? "");
    const precioVenta = parseMoney(cols[3] ?? "");
    const stock = parseStock(cols[4] ?? "");
    const fotoUrl = driveImageUrl((cols[5] ?? "").trim());

    const payload = {
      codigo_barras: codigo,
      nombre,
      precio_compra: precioCompra,
      precio: precioVenta,
      foto_url: fotoUrl,
      tipo: "producto",
      activo: true,
    };

    const existing = await admin
      .from("productos")
      .select("id")
      .eq("codigo_barras", codigo)
      .maybeSingle();

    if (existing.error) {
      return NextResponse.json({
        error: "No pude leer codigo_barras. Ejecuta primero la migracion scripts/migracion-codigo-barras-ventas.sql",
      }, { status: 500 });
    }

    let productoId = (existing.data as any)?.id as string | undefined;

    if (productoId) {
      const { error } = await admin.from("productos").update(payload as any).eq("id", productoId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      actualizados++;
    } else {
      const { data, error } = await admin.from("productos").insert(payload as any).select("id").single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      productoId = (data as any).id;
      creados++;
    }

    await admin
      .from("stock")
      .upsert({ producto_id: productoId, cantidad: stock } as any, { onConflict: "producto_id" });
  }

  return NextResponse.json({ ok: true, creados, actualizados });
}
