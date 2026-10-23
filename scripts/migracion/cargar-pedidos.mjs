import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const INPUT_DIR = resolve(process.cwd(), "Claude outputs");
const FILES = {
  pedidos: "pedidos_pendientes.csv",
  items: "items_pedido.csv",
  clientes: "clientes_nuevos_desde_pedidos.csv",
  excluidos: "pedidos_excluidos.csv",
};

const HEADERS = {
  pedidos: ["numero", "cliente_nombre", "telefono", "fecha", "estado", "estado_planilla", "prioridad", "sucursal_produccion", "sucursal_retiro", "es_envio", "medio_pago", "via_contacto", "total", "sena", "saldo", "paginas", "items_filas", "ubicacion", "quien_cargo", "quien_lo_hizo", "archivo", "ticket", "filas_origen"],
  items: ["numero_pedido", "orden", "producto", "paginas", "modo", "anillado", "cantidad", "precio_unitario", "subtotal", "anotacion", "filas_origen"],
  clientes: ["nombre", "telefono", "hay_telefono_igual_en_clientes", "pedido", "sucursal", "fecha_pedido"],
  excluidos: ["numero_pedido", "cliente", "telefono", "fecha", "sucursal", "estado_planilla", "motivo", "items", "filas"],
};

function parseEnv(text) {
  const env = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[line.slice(0, separator).trim()] = value.replace(/\\n/g, "\n");
  }
  return env;
}

function parseCsv(input) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (quoted) {
      if (char === '"' && input[index + 1] === '"') { value += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else value += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(value); value = ""; }
    else if (char === "\n") { row.push(value.replace(/\r$/, "")); rows.push(row); row = []; value = ""; }
    else value += char;
  }
  if (quoted) throw new Error("CSV inválido: hay comillas sin cerrar.");
  if (value || row.length) { row.push(value.replace(/\r$/, "")); rows.push(row); }
  return rows;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parseFile(kind, content) {
  const [header, ...records] = parseCsv(content);
  assert(JSON.stringify(header) === JSON.stringify(HEADERS[kind]), `${FILES[kind]}: los encabezados no coinciden con el CSV auditado.`);
  assert(records.every((record) => record.length === header.length), `${FILES[kind]}: hay una fila con cantidad de columnas inválida.`);
  return records.map((record) => Object.fromEntries(header.map((key, index) => [key, record[index]])));
}

function cents(value) {
  const normalized = String(value).trim().replace(",", ".");
  const number = Number(normalized);
  assert(Number.isFinite(number), `Monto inválido: ${value}`);
  return Math.round(number * 100);
}

function splitOrigins(value) {
  return String(value).trim().split(/\s+/).filter(Boolean);
}

function resultFor(items, pedidos, clientes, excluidos) {
  const pedidosPorNumero = new Map(pedidos.map((pedido) => [pedido.numero.trim(), pedido]));
  const itemsPorPedido = new Map();
  for (const item of items) {
    const number = item.numero_pedido.trim();
    assert(pedidosPorNumero.has(number), `Ítem huérfano: pedido ${number}.`);
    itemsPorPedido.set(number, [...(itemsPorPedido.get(number) ?? []), item]);
  }

  assert(pedidos.length === 131, `Cabeceras: ${pedidos.length}; se esperaban 131.`);
  assert(new Set(pedidos.map((pedido) => pedido.numero.trim())).size === 131, "Hay números de pedido repetidos en la cabecera.");
  assert(items.length === 278, `Ítems: ${items.length}; se esperaban 278.`);
  assert(clientes.length === 7, `Clientes nuevos: ${clientes.length}; se esperaban 7.`);
  assert(excluidos.length === 6, `Pedidos excluidos: ${excluidos.length}; se esperaban 6.`);
  assert(new Set(excluidos.map((pedido) => pedido.numero_pedido.trim())).size === 6, "Hay excluidos repetidos.");
  assert(!excluidos.some((pedido) => pedidosPorNumero.has(pedido.numero_pedido.trim())), "Un pedido excluido también figura para migrar.");
  assert(pedidos.every((pedido) => ["entrega", "encargos"].includes(pedido.estado.trim())), "Hay un estado de pedido no reconocido.");
  assert(items.every((item) => /^[0-9]+$/.test(item.orden.trim()) && /^[0-9]+$/.test(item.paginas.trim()) && /^[0-9]+$/.test(item.cantidad.trim())), "Hay orden, páginas o cantidad inválidos.");

  for (const pedido of pedidos) {
    const subtotal = (itemsPorPedido.get(pedido.numero.trim()) ?? []).reduce((total, item) => total + cents(item.subtotal), 0);
    assert(subtotal === cents(pedido.total), `Pedido ${pedido.numero}: total ${pedido.total} distinto de sus ítems.`);
  }

  const origins = items.flatMap((item) => splitOrigins(item.filas_origen));
  assert(origins.length === 566, `Filas de origen en ítems: ${origins.length}; se esperaban 566.`);
  assert(new Set(origins).size === 566, "Hay filas de origen repetidas entre los ítems.");

  const sum = (field) => pedidos.reduce((total, pedido) => total + cents(pedido[field]), 0);
  const total = sum("total");
  const senia = sum("sena");
  const summary = {
    validacion: "ok",
    pedidos: pedidos.length,
    items: items.length,
    cantidad_total: items.reduce((totalItems, item) => totalItems + Number(item.cantidad), 0),
    filas_origen_items: origins.length,
    entrega: pedidos.filter((pedido) => pedido.estado === "entrega").length,
    encargos: pedidos.filter((pedido) => pedido.estado === "encargos").length,
    total: total / 100,
    senia: senia / 100,
    saldo: (total - senia) / 100,
    paginas: items.reduce((totalPages, item) => totalPages + Number(item.paginas) * Number(item.cantidad), 0),
    clientes_nuevos: clientes.length,
    clientes_a_revisar_por_telefono: clientes.filter((cliente) => cliente.hay_telefono_igual_en_clientes === "True").map((cliente) => cliente.nombre),
    excluidos: excluidos.map((pedido) => ({ numero: pedido.numero_pedido, motivo: pedido.motivo })),
  };
  assert(summary.cantidad_total === 566, "La suma de cantidades no es 566.");
  assert(summary.total === 6530422 && summary.senia === 1886712 && summary.saldo === 4643710, "Los montos totales no coinciden con el control auditado.");
  assert(summary.paginas === 82234, "La suma de páginas no es 82234.");
  return summary;
}

async function count(supabase, table) {
  const { count: value, error } = await supabase.from(table).select("*", { count: "exact", head: true });
  if (error) throw new Error(`No se pudo contar ${table}: ${error.message}`);
  return value;
}

function assertRemoteVerification(verification) {
  assert(verification && typeof verification === "object", "La verificación PostgreSQL no devolvió resultados.");
  const expected = {
    pedidos: 131,
    items: 278,
    cantidad_total: 566,
    filas_origen_items: 566,
    entrega: 126,
    encargos: 5,
    paginas: 82234,
    sin_cliente: 0,
  };
  for (const [field, value] of Object.entries(expected)) {
    assert(Number(verification[field]) === value, `Verificación remota inválida para ${field}: ${verification[field]}.`);
  }
  assert(Number(verification.total) === 6530422, `Total remoto inválido: ${verification.total}.`);
  assert(Number(verification.senia) === 1886712, `Seña remota inválida: ${verification.senia}.`);
  assert(Number(verification.saldo) === 4643710, `Saldo remoto inválido: ${verification.saldo}.`);
  const sucursales = verification.por_sucursal_produccion ?? {};
  assert(Number(sucursales["41"]) === 77 && Number(sucursales["60"]) === 51 && Number(sucursales["44"]) === 3, "Los conteos remotos por sucursal no coinciden.");
  assert(Array.isArray(verification.prioridad_alta_pendiente) && verification.prioridad_alta_pendiente.length === 1, "El caso de prioridad alta no quedó marcado exactamente una vez.");
}

const apply = process.argv.includes("--apply");
const content = await Promise.all(Object.entries(FILES).map(async ([kind, file]) => [kind, await readFile(resolve(INPUT_DIR, file), "utf8")]));
const parsed = Object.fromEntries(content.map(([kind, text]) => [kind, parseFile(kind, text)]));
const local = resultFor(parsed.items, parsed.pedidos, parsed.clientes, parsed.excluidos);

if (!apply) {
  console.log(JSON.stringify({ ...local, accion: "dry-run; usar --apply solo después del backup y de ejecutar las tres migraciones SQL." }, null, 2));
  process.exit(0);
}

const env = parseEnv(await readFile(resolve(process.cwd(), ".env.local"), "utf8"));
assert(env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY, "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const [clientesActuales, pedidosActuales, itemsActuales] = await Promise.all([count(supabase, "clientes"), count(supabase, "pedidos"), count(supabase, "items_pedido")]);
assert(clientesActuales === 3506, `Clientes en Supabase: ${clientesActuales}; se esperaban 3506.`);
assert(pedidosActuales === 0 && itemsActuales === 0, `Carga abortada: hay ${pedidosActuales} pedidos y ${itemsActuales} ítems existentes.`);

const stage = await supabase.rpc("reemplazar_staging_pedidos", { p_pedidos: parsed.pedidos, p_items: parsed.items, p_clientes_nuevos: parsed.clientes });
if (stage.error) throw new Error(`No se pudo cargar el staging: ${stage.error.message}`);
const validation = await supabase.rpc("validar_staging_pedidos");
if (validation.error) throw new Error(`Falló la validación en PostgreSQL: ${validation.error.message}`);
const firstRun = await supabase.rpc("migrar_pedidos_desde_staging");
if (firstRun.error) throw new Error(`Falló la migración: ${firstRun.error.message}`);
const secondRun = await supabase.rpc("migrar_pedidos_desde_staging");
if (secondRun.error) throw new Error(`Falló la prueba idempotente: ${secondRun.error.message}`);
const verification = await supabase.rpc("verificar_migracion_pedidos");
if (verification.error) throw new Error(`Falló la verificación final: ${verification.error.message}`);
assertRemoteVerification(verification.data);

console.log(JSON.stringify({ ...local, staging: stage.data, validacion_postgres: validation.data, primera_ejecucion: firstRun.data, segunda_ejecucion: secondRun.data, verificacion: verification.data }, null, 2));
