import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

function parseEnv(text) {
  const values = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value.replace(/\\n/g, "\n");
  }
  return values;
}

function failIfError(label, error) {
  if (error) {
    const details = [
      error.message,
      error.details,
      error.hint,
      error.code,
      error.status,
      error.cause?.message,
    ].filter(Boolean).join(" | ");
    throw new Error(`${label}: ${details || "sin detalle de PostgREST"}`);
  }
}

const env = parseEnv(await readFile(resolve(process.cwd(), ".env.local"), "utf8"));
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local.");
}

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

async function count(table) {
  const { count: total, error } = await supabase.from(table).select("*", { count: "exact", head: true });
  failIfError(`No se pudo contar ${table}`, error);
  return total;
}

const clientes = await count("clientes");
const pedidos = await count("pedidos");
const itemsPedido = await count("items_pedido");

const { data: muestraClientes, error: muestraClientesError } = await supabase
  .from("clientes")
  .select("codigo,nombre,telefono,creado_en")
  .order("creado_en", { ascending: true })
  .limit(20);
failIfError("No se pudo leer la muestra de clientes", muestraClientesError);

const { data: counters, error: countersError } = await supabase
  .from("counters")
  .select("nombre,valor")
  .order("nombre", { ascending: true });
failIfError("No se pudo leer counters", countersError);

const openApiResponse = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, {
  headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
});
if (!openApiResponse.ok) {
  throw new Error(`No se pudo leer el esquema publicado por PostgREST: HTTP ${openApiResponse.status}.`);
}
const openApi = await openApiResponse.json();
const schemas = openApi.definitions ?? openApi.components?.schemas ?? {};

function columnsFor(table) {
  const schema = schemas[table];
  return Object.keys(schema?.properties ?? {}).sort();
}

const expected = {
  clientes: ["id", "codigo", "nombre", "cod_pais", "telefono", "mail", "activo", "creado_en"],
  pedidos: [
    "id", "numero", "usuario_id", "fecha", "cliente_id", "estado", "medio_contacto", "sucursal",
    "senia", "carpeta_url", "url_comprobante", "creado_en", "codigo_unico", "quien_cargo_codigo",
    "medio_pago", "via_contacto", "prioridad", "mensaje", "telefono_contacto", "sucursal_produccion",
    "sucursal_retiro", "orden_produccion", "imprimir_tapas", "ubicacion", "entregado_por", "entregado_en",
    "medio_pago_restante", "sucursal_movida_por", "sucursal_movida_en", "ubicacion_por", "ubicacion_en",
    "eliminado", "eliminado_por", "eliminado_en", "queja_motivo", "queja_por", "queja_en",
    "mercado_pago_payment_id", "mercado_pago_monto", "mercado_pago_hora",
  ],
  items_pedido: [
    "id", "pedido_id", "producto", "anotacion", "paginas", "modo", "pago", "precio", "descuento",
    "lugar_entrega", "dia_entrega", "hora_entrega", "url_pdf", "estado", "creado_en",
  ],
  usuarios_sistema: ["id", "nombre", "email", "rol", "sucursal_default", "activo", "creado_en", "codigo_personal"],
  counters: ["nombre", "valor"],
};

const schemaComparison = Object.fromEntries(
  Object.entries(expected).map(([table, declared]) => {
    const real = columnsFor(table);
    return [table, {
      declaredButMissing: declared.filter((column) => !real.includes(column)),
      presentOnlyInDatabase: real.filter((column) => !declared.includes(column)),
      realColumns: real,
    }];
  }),
);

console.log(JSON.stringify({
  counts: { clientes, pedidos, items_pedido: itemsPedido },
  muestraClientes,
  counters,
  schemaSource: schemas.clientes ? "OpenAPI de PostgREST" : "No se expusieron definiciones de tablas en OpenAPI",
  schemaComparison,
}, null, 2));
