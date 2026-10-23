import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const EXPECTED = { clientes: 5, pedidos: 40, items: 43 };

function parseEnv(text) {
  return Object.fromEntries(
    text.split(/\r?\n/)
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator), line.slice(separator + 1).replace(/^['\"]|['\"]$/g, "")];
      }),
  );
}

function fail(label, error) {
  if (error) throw new Error(`${label}: ${error.message || error.code || "sin detalle"}`);
}

if (!process.argv.includes("--confirmar")) {
  throw new Error("Ejecución detenida. Usá --confirmar después de revisar el preflight.");
}

const env = parseEnv(await readFile(".env.local", "utf8"));
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const [{ data: clientes, error: clientesError }, { data: pedidos, error: pedidosError }, { data: items, error: itemsError }] = await Promise.all([
  db.from("clientes").select("id"),
  db.from("pedidos").select("id,cliente_id"),
  db.from("items_pedido").select("id,pedido_id"),
]);
fail("No se pudo leer clientes", clientesError);
fail("No se pudo leer pedidos", pedidosError);
fail("No se pudo leer ítems", itemsError);

if (clientes.length === 0 && pedidos.length === 0 && items.length === 0) {
  console.log("No hay datos de prueba iniciales para eliminar.");
  process.exit(0);
}

for (const [name, expected] of Object.entries(EXPECTED)) {
  const actual = { clientes: clientes.length, pedidos: pedidos.length, items: items.length }[name];
  if (actual !== expected) throw new Error(`Preflight abortado: ${name}=${actual}; se esperaban ${expected}.`);
}

const pedidoIds = pedidos.map((pedido) => pedido.id);
const clienteIds = new Set(clientes.map((cliente) => cliente.id));
if (items.some((item) => !pedidoIds.includes(item.pedido_id))) {
  throw new Error("Preflight abortado: hay ítems que no pertenecen a los pedidos de prueba.");
}
if (pedidos.some((pedido) => pedido.cliente_id && !clienteIds.has(pedido.cliente_id))) {
  throw new Error("Preflight abortado: hay pedidos que apuntan a un cliente fuera del conjunto de prueba.");
}

const deletions = [
  ["items_pedido", "pedido_id", pedidoIds],
  ["pedido_print_events", "pedido_id", pedidoIds],
  ["archivos_pedido", "pedido_id", pedidoIds],
  ["pedidos", "id", pedidoIds],
  ["clientes", "id", [...clienteIds]],
];

for (const [table, column, ids] of deletions) {
  const { error } = await db.from(table).delete().in(column, ids);
  fail(`No se pudo eliminar ${table}`, error);
}

console.log(JSON.stringify({
  eliminados: {
    clientes: clientes.length,
    pedidos: pedidos.length,
    items_pedido: items.length,
  },
  nota: "No se eliminaron archivos físicos de Google Drive.",
}, null, 2));
