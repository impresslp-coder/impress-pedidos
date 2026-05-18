"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

const DENOMINACIONES = [20000, 10000, 2000, 1000, 500, 200, 100, 50, 20] as const;

type TipoCaja = "inicio" | "cierre" | "retiro";
type BilletesCaja = Record<string, number>;
type GastoCaja = { concepto: string; valor: number; medio_pago: string };

function normalizarBilletes(billetes: BilletesCaja) {
  const normalizados: BilletesCaja = {};
  let total = 0;

  for (const denominacion of DENOMINACIONES) {
    const cantidad = Math.max(0, Math.trunc(Number(billetes[String(denominacion)]) || 0));
    normalizados[String(denominacion)] = cantidad;
    total += denominacion * cantidad;
  }

  return { billetes: normalizados, total };
}

async function validarOperador(codigoPersonal: string) {
  const admin = createAdminClient();
  const codigo = codigoPersonal.trim();
  if (!codigo) return { error: "Ingresa tu codigo personal" } as const;

  const { data, error } = await admin
    .from("usuarios_sistema")
    .select("id, nombre, codigo_personal, activo")
    .eq("codigo_personal", codigo)
    .eq("activo", true)
    .maybeSingle();

  if (error) return { error: error.message } as const;
  if (!data) return { error: "Codigo personal incorrecto" } as const;
  return { admin, operador: data as { id: string; nombre?: string | null } } as const;
}

export async function registrarMovimientoCaja(tipo: TipoCaja, billetesInput: BilletesCaja, codigoPersonal: string) {
  if (!["inicio", "cierre", "retiro"].includes(tipo)) return { error: "Tipo de registro invalido" };

  const validacion = await validarOperador(codigoPersonal);
  if ("error" in validacion) return { error: validacion.error };

  const { admin, operador } = validacion;
  const { billetes, total } = normalizarBilletes(billetesInput);

  const { error } = await admin.from("caja_jornadas").insert({
    tipo,
    usuario_id: operador.id,
    usuario_nombre: operador.nombre ?? null,
    billetes,
    total,
  } as any);

  if (error) {
    if (error.message.includes("caja_jornadas")) {
      return { error: "Falta correr la migracion scripts/migracion-caja-estadisticas.sql en Supabase." };
    }
    return { error: error.message };
  }

  revalidatePath("/estadisticas");
  return {
    ok: true,
    message: tipo === "inicio"
      ? "Inicio de caja registrado correctamente."
      : tipo === "retiro"
        ? "Retiro de efectivo registrado correctamente."
        : "Cierre de jornada registrado correctamente.",
  };
}

export async function registrarGastoCaja(gastosInput: GastoCaja[], codigoPersonal: string) {
  const validacion = await validarOperador(codigoPersonal);
  if ("error" in validacion) return { error: validacion.error };

  const gastos = gastosInput
    .map((gasto) => ({
      concepto: gasto.concepto.trim(),
      valor: Math.max(0, Number(gasto.valor) || 0),
      medio_pago: gasto.medio_pago.trim() || "efectivo",
    }))
    .filter((gasto) => gasto.concepto && gasto.valor > 0);

  if (!gastos.length) return { error: "Agrega al menos un gasto con concepto y valor." };

  const { admin, operador } = validacion;
  const total = gastos.reduce((acc, gasto) => acc + gasto.valor, 0);

  const { error } = await admin.from("caja_jornadas").insert({
    tipo: "gasto",
    usuario_id: operador.id,
    usuario_nombre: operador.nombre ?? null,
    billetes: {},
    gastos,
    total,
  } as any);

  if (error) {
    if (error.message.includes("caja_jornadas") || error.message.includes("gastos") || error.message.includes("tipo")) {
      return { error: "Falta correr la migracion scripts/migracion-caja-estadisticas.sql en Supabase." };
    }
    return { error: error.message };
  }

  revalidatePath("/estadisticas");
  return { ok: true, message: "Gasto registrado correctamente." };
}
