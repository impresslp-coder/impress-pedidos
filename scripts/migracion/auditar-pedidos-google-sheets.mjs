/**
 * Inventario read-only de las fuentes históricas de pedidos.
 *
 * No modifica Google Sheets ni Supabase. Lee únicamente metadatos y las
 * primeras cinco filas de pestañas candidatas, para identificar de manera
 * reproducible las cinco generaciones de datos antes de cualquier auditoría.
 *
 * Uso: node scripts/migracion/auditar-pedidos-google-sheets.mjs
 */
import { readFile } from "node:fs/promises";
import { google } from "googleapis";

const spreadsheetId = "1GMZq9XQCPJw_C98duJ8bU_IitRHaEgVXSbHyiBsVJ0U";
const candidateSheets = [
  "BaseDeDatos",
  "BaseTerciarizado",
  "Base de datos",
  "Copia de Base de datos",
  "Hoja 14",
  "Proyeccion san martin",
  "Control",
  "Presupuestos",
  "Buscar",
  "Diferencias de carga",
];

function parseEnv(text) {
  return Object.fromEntries(
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        const key = line.slice(0, index).trim();
        let value = line.slice(index + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        return [key, value.replace(/\\n/g, "\n")];
      }),
  );
}

const env = parseEnv(await readFile(".env.local", "utf8"));
if (!env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !env.GOOGLE_PRIVATE_KEY) {
  throw new Error("Faltan las credenciales de solo lectura de Google en .env.local.");
}

const auth = new google.auth.JWT({
  email: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: env.GOOGLE_PRIVATE_KEY,
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});
await auth.authorize();

const sheets = google.sheets({ version: "v4", auth });
const metadata = await sheets.spreadsheets.get({
  spreadsheetId,
  fields: "sheets.properties(sheetId,title,gridProperties(rowCount,columnCount))",
});
const byTitle = new Map(
  (metadata.data.sheets ?? []).map(({ properties }) => [properties.title, properties]),
);
const found = candidateSheets.filter((title) => byTitle.has(title));

const response = await sheets.spreadsheets.values.batchGet({
  spreadsheetId,
  ranges: found.map((title) => `'${title.replace(/'/g, "''")}'!A1:AZ5`),
  majorDimension: "ROWS",
  valueRenderOption: "FORMATTED_VALUE",
});

const summaries = (response.data.valueRanges ?? []).map((range) => {
  const title =
    range.range.match(/^'(.+)'!/)?.[1]?.replace(/''/g, "'") ??
    range.range.match(/^([^!]+)!/)?.[1] ??
    range.range;
  const properties = byTitle.get(title);
  const rows = range.values ?? [];
  return {
    hoja: title,
    gid: properties?.sheetId ?? null,
    filas_en_grilla: properties?.gridProperties?.rowCount ?? null,
    columnas_en_grilla: properties?.gridProperties?.columnCount ?? null,
    columnas_con_encabezado: rows[0]?.filter((value) => String(value).trim()).length ?? 0,
    encabezados: rows[0] ?? [],
    muestra_filas_datos: Math.max(0, rows.length - 1),
  };
});

const stateColumns = [
  { hoja: "BaseDeDatos", columna: "S", encabezado: "Estado del pedido" },
  { hoja: "BaseTerciarizado", columna: "K", encabezado: "Estado del pedido" },
];
const stateRanges = stateColumns.map(({ hoja, columna }) => {
  const rows = byTitle.get(hoja)?.gridProperties?.rowCount ?? 1;
  return `'${hoja}'!${columna}2:${columna}${rows}`;
});
const stateResponse = await sheets.spreadsheets.values.batchGet({
  spreadsheetId,
  ranges: stateRanges,
  majorDimension: "COLUMNS",
  valueRenderOption: "FORMATTED_VALUE",
});
const estados = (stateResponse.data.valueRanges ?? []).map((range, index) => {
  const values = range.values?.[0] ?? [];
  const conteos = new Map();
  for (const value of values) {
    const estado = String(value).trim() || "(vacío)";
    conteos.set(estado, (conteos.get(estado) ?? 0) + 1);
  }
  return {
    ...stateColumns[index],
    valores_no_vacios: values.length,
    conteos: Object.fromEntries([...conteos].sort(([a], [b]) => a.localeCompare(b, "es"))),
  };
});

console.log(
  JSON.stringify(
    {
      spreadsheetId,
      lectura: "solo lectura",
      pestanas_disponibles: (metadata.data.sheets ?? []).map(({ properties }) => ({
        hoja: properties.title,
        gid: properties.sheetId,
        filas_en_grilla: properties.gridProperties?.rowCount ?? null,
        columnas_en_grilla: properties.gridProperties?.columnCount ?? null,
      })),
      hojas: summaries,
      estados,
    },
    null,
    2,
  ),
);
