/**
 * Verifica, sin escribir datos, la migración histórica de clientes y pedidos.
 *
 * Uso: node scripts/migracion/verificar-migracion.mjs
 * Sale con código 1 ante cualquier diferencia.
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const ROOT = process.cwd();
const OUTPUTS = resolve(ROOT, "Claude outputs");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parseEnv(text) {
  const env = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    env[line.slice(0, separator).trim()] = value.replace(/\\n/g, "\n");
  }
  return env;
}

function parseCsv(text) {
  const rows = [];
  let row = [], value = "", quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') { value += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else value += character;
    } else if (character === '"') quoted = true;
    else if (character === ",") { row.push(value); value = ""; }
    else if (character === "\n") { row.push(value.replace(/\r$/, "")); rows.push(row); row = []; value = ""; }
    else value += character;
  }
  if (quoted) throw new Error("CSV inválido: hay comillas sin cerrar.");
  if (value || row.length) { row.push(value.replace(/\r$/, "")); rows.push(row); }
  const [headers, ...records] = rows;
  return records.map((record) => Object.fromEntries(headers.map((header, index) => [header, record[index] ?? ""])));
}

function cents(value) {
  const number = Number(String(value).trim().replace(",", "."));
  assert(Number.isFinite(number), `Importe inválido en archivo de origen: ${value}`);
  return Math.round(number * 100);
}

async function count(query, label) {
  const { count: value, error } = await query.select("*", { count: "exact", head: true });
  if (error) throw new Error(`${label}: ${error.message}`);
  return value ?? 0;
}

async function selectAll(query, label) {
  const all = [];
  for (let page = 0; page < 20; page += 1) {
    const { data, error } = await query.range(page * 1000, page * 1000 + 999);
    if (error) throw new Error(`${label}: ${error.message}`);
    all.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return all;
}

const [envText, clientesText, pedidosText, itemsText] = await Promise.all([
  readFile(resolve(ROOT, ".env.local"), "utf8"),
  readFile(resolve(OUTPUTS, "clientes_para_app.csv"), "utf8"),
  readFile(resolve(OUTPUTS, "pedidos_pendientes.csv"), "utf8"),
  readFile(resolve(OUTPUTS, "items_pedido.csv"), "utf8"),
]);
const env = parseEnv(envText);
assert(env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY, "Faltan las credenciales de Supabase requeridas en .env.local.");

const clientesOrigen = parseCsv(clientesText);
const pedidosOrigen = parseCsv(pedidosText);
const itemsOrigen = parseCsv(itemsText);
assert(clientesOrigen.length === 3506, `CSV clientes: ${clientesOrigen.length}; se esperaban 3506.`);
assert(pedidosOrigen.length === 131, `CSV pedidos: ${pedidosOrigen.length}; se esperaban 131.`);
assert(itemsOrigen.length === 278, `CSV ítems: ${itemsOrigen.length}; se esperaban 278.`);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Se restringe a las filas históricas: los siete clientes creados al migrar
// pedidos no forman parte de los controles del CSV original de 3.506 filas.
const historicos = supabase.from("clientes").select("codigo, cod_pais, telefono, mail, activo, revisar").not("origen_fila", "is", null);
const clientesRemotos = await selectAll(historicos, "Lectura de clientes históricos");
assert(clientesRemotos.length === clientesOrigen.length, `Clientes históricos: ${clientesRemotos.length}; se esperaban ${clientesOrigen.length}.`);

const sourceCodes = new Set(clientesOrigen.map(({ codigo }) => codigo.trim()));
const remoteCodes = new Set(clientesRemotos.map(({ codigo }) => codigo));
const missingCodes = [...sourceCodes].filter((codigo) => !remoteCodes.has(codigo));
assert(missingCodes.length === 0, `Códigos de clientes faltantes (${missingCodes.length}): ${missingCodes.join(", ")}`);

const clientChecks = {
  total: clientesRemotos.length,
  pais_549: clientesRemotos.filter(({ cod_pais }) => cod_pais === "549").length,
  extranjeros: clientesRemotos.filter(({ cod_pais }) => cod_pais !== "549").length,
  sin_telefono: clientesRemotos.filter(({ telefono }) => telefono == null || telefono === "").length,
  con_mail: clientesRemotos.filter(({ mail }) => mail != null && mail !== "").length,
  inactivos: clientesRemotos.filter(({ activo }) => activeFalse(activo)).length,
  revisar: clientesRemotos.filter(({ revisar }) => revisar === true).length,
};
function activeFalse(value) { return value === false; }
const expectedClients = { total: 3506, pais_549: 3485, extranjeros: 21, sin_telefono: 130, con_mail: 576, inactivos: 3, revisar: 582 };
for (const [field, expected] of Object.entries(expectedClients)) {
  assert(clientChecks[field] === expected, `Control de clientes ${field}: ${clientChecks[field]}; se esperaban ${expected}.`);
}

const verification = await supabase.rpc("verificar_migracion_pedidos");
if (verification.error) throw new Error(`Verificación PostgreSQL de pedidos: ${verification.error.message}`);
const remote = verification.data;
const totalOrigen = pedidosOrigen.reduce((total, pedido) => total + cents(pedido.total), 0) / 100;
const seniaOrigen = pedidosOrigen.reduce((total, pedido) => total + cents(pedido.sena), 0) / 100;
const expectedOrders = {
  pedidos: pedidosOrigen.length,
  items: itemsOrigen.length,
  cantidad_total: itemsOrigen.reduce((total, item) => total + Number(item.cantidad), 0),
  paginas: itemsOrigen.reduce((total, item) => total + Number(item.paginas) * Number(item.cantidad), 0),
  total: totalOrigen,
  senia: seniaOrigen,
  saldo: totalOrigen - seniaOrigen,
  sin_cliente: 0,
};
for (const [field, expected] of Object.entries(expectedOrders)) {
  assert(Number(remote?.[field]) === expected, `Control de pedidos ${field}: ${remote?.[field]}; se esperaban ${expected}.`);
}

const pedidosRemotos = await selectAll(supabase.from("pedidos").select("numero, numero_origen, estado"), "Lectura de pedidos");
const expectedNumbers = new Set(pedidosOrigen.map(({ numero }) => numero.trim()));
const remotosMigrados = pedidosRemotos.filter(({ numero }) => expectedNumbers.has(numero));
assert(remotosMigrados.length === pedidosOrigen.length, `Pedidos de origen presentes: ${remotosMigrados.length}; se esperaban ${pedidosOrigen.length}.`);
assert(remotosMigrados.every(({ numero, numero_origen }) => numero_origen === numero), "Hay pedidos migrados con numero_origen distinto de numero.");
const estadosActuales = Object.fromEntries(
  Object.entries(Object.groupBy(remotosMigrados, ({ estado }) => estado ?? "(sin estado)"))
    .map(([estado, pedidos]) => [estado, pedidos.length])
);

console.log(JSON.stringify({
  validacion: "ok",
  clientes: clientChecks,
  clientes_faltantes: missingCodes,
  pedidos: remote,
  estados_actuales: estadosActuales,
  origen: { pedidos: pedidosOrigen.length, items: itemsOrigen.length, total: totalOrigen, senia: seniaOrigen },
}, null, 2));
