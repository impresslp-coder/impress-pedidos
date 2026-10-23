import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const SOURCE_FILE = "Claude outputs/clientes_para_app.csv";
const ORIGEN_HOJA = "CLIENTES";
const ORIGEN_GID = "583216839";
const EXPECTED_HEADERS = [
  "codigo", "nombre", "cod_pais", "telefono", "mail", "activo",
  "codigo_origen", "origen_fila", "revisar", "revisar_motivo", "grupos_dup",
];

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

function parseCsv(input) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (quoted) {
      if (char === '"' && input[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        value += char;
      }
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(value);
      value = "";
    } else if (char === "\n") {
      row.push(value.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      value = "";
    } else value += char;
  }
  if (quoted) throw new Error("CSV inválido: comillas sin cerrar.");
  if (value || row.length) {
    row.push(value.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function count(rows, predicate) {
  return rows.filter(predicate).length;
}

const apply = process.argv.includes("--apply");
const [csv, envFile] = await Promise.all([readFile(SOURCE_FILE, "utf8"), readFile(".env.local", "utf8")]);
assert(!/[Ãð]/.test(csv), "El CSV parece tener corrupción de codificación; no se cargó.");
const [headers, ...values] = parseCsv(csv);
assert(JSON.stringify(headers) === JSON.stringify(EXPECTED_HEADERS), "Los encabezados del CSV no coinciden con el formato auditado.");
assert(values.every((row) => row.length === headers.length), "El CSV contiene filas con una cantidad de columnas inválida.");
const rows = values.map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index]])));

assert(rows.length === 3506, `Control falló: filas=${rows.length}; esperado=3506.`);
assert(count(rows, (row) => row.cod_pais === "549") === 3485, "Control falló: cod_pais=549.");
assert(count(rows, (row) => !row.telefono) === 130, "Control falló: sin teléfono.");
assert(count(rows, (row) => !!row.mail) === 576, "Control falló: con mail.");
assert(count(rows, (row) => row.activo === "false") === 3, "Control falló: inactivos.");
assert(count(rows, (row) => row.revisar === "true") === 582, "Control falló: revisar.");

if (!apply) {
  console.log(JSON.stringify({ validacion: "ok", filas: rows.length, accion: "dry-run; usá --apply para cargar" }, null, 2));
  process.exit(0);
}

const env = parseEnv(envFile);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const stagingRows = rows.map((row) => ({ ...row, origen_hoja: ORIGEN_HOJA, origen_gid: ORIGEN_GID }));
for (let start = 0; start < stagingRows.length; start += 250) {
  const { error } = await db
    .from("staging_clientes_migracion")
    .upsert(stagingRows.slice(start, start + 250), { onConflict: "origen_hoja,origen_gid,origen_fila" });
  if (error) throw new Error(`No se pudo cargar staging (fila ${start + 1}): ${error.message}`);
}

const { data: resultado, error: transformError } = await db.rpc("migrar_clientes_desde_staging", {
  p_origen_hoja: ORIGEN_HOJA,
  p_origen_gid: ORIGEN_GID,
});
if (transformError) throw new Error(`No se pudo transformar staging: ${transformError.message}`);
console.log(JSON.stringify({ resultado }, null, 2));
