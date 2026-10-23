import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function rpc(nombre, parametros) {
  const { data, error } = await db.rpc(nombre, parametros);
  if (error) throw new Error(`${nombre}: ${error.message}`);
  return data;
}
async function precio(tipo, tamano, hojas) {
  return Number(await rpc("precio_impresion", { p_tipo_papel: tipo, p_tamano: tamano, p_hojas: hojas }));
}
async function anillo(paginas) {
  const data = await rpc("anillado_para", { p_paginas: paginas });
  return Array.isArray(data) ? data[0] : data;
}

function parseCsv(texto) {
  const filas = [];
  let fila = [];
  let campo = "";
  let entreComillas = false;
  for (let i = 0; i < texto.length; i += 1) {
    const caracter = texto[i];
    if (caracter === '"') {
      if (entreComillas && texto[i + 1] === '"') { campo += '"'; i += 1; }
      else entreComillas = !entreComillas;
    } else if (caracter === "," && !entreComillas) {
      fila.push(campo); campo = "";
    } else if ((caracter === "\n" || caracter === "\r") && !entreComillas) {
      if (caracter === "\r" && texto[i + 1] === "\n") i += 1;
      fila.push(campo); campo = "";
      if (fila.some((valor) => valor !== "")) filas.push(fila);
      fila = [];
    } else campo += caracter;
  }
  if (campo || fila.length) { fila.push(campo); filas.push(fila); }
  const [cabeceras, ...datos] = filas;
  return datos.map((valores) => Object.fromEntries(cabeceras.map((nombre, indice) => [nombre.replace(/^\uFEFF/, ""), valores[indice] ?? ""])));
}

async function enLotes(valores, tamanioLote, funcion) {
  const resultados = [];
  for (let inicio = 0; inicio < valores.length; inicio += tamanioLote) {
    resultados.push(...await Promise.all(valores.slice(inicio, inicio + tamanioLote).map(funcion)));
  }
  return resultados;
}

const casos = [
  ["1 hoja común A5", () => precio("comun", "A5", 1), 75],
  ["1 hoja común A4", () => precio("comun", "A4", 1), 150],
  ["1 hoja común A3", () => precio("comun", "A3", 1), 300],
  ["3 hojas común A4", () => precio("comun", "A4", 3), 450],
  ["8 hojas común A4", () => precio("comun", "A4", 8), 1200],
  ["40 hojas común A4", () => precio("comun", "A4", 40), 6000],
  ["40 hojas común A3", () => precio("comun", "A3", 40), 12000],
  ["2 hojas fotográfico A4", () => precio("fotografico", "A4", 2), 5000],
  ["10 hojas fotográfico A4", () => precio("fotografico", "A4", 10), 7000],
  ["5 hojas chambril A4", () => precio("chambril", "A4", 5), 3500],
  ["anillado particular 200 páginas", () => rpc("precio_anillado_particular", { p_paginas: 200 }), 5000],
  ["anillado particular 501 páginas", () => rpc("precio_anillado_particular", { p_paginas: 501 }), 10000],
];

for (const [nombre, obtener, esperado] of casos) {
  assert.equal(Number(await obtener()), esperado, nombre);
}
const rouvier = await anillo(752);
assert.deepEqual(
  { anillos: Number(rouvier.anillos), medida: Number(rouvier.medida_mm), precio: Number(rouvier.precio) },
  { anillos: 1, medida: 50, precio: 6500 },
  "Rouvier 752 páginas",
);
assert.equal(Number((await anillo(1741)).anillos), 2, "1741 páginas usa 2 anillos");

const a4 = await rpc("cotizar_trabajo", { p_paginas: 20, p_tipo_papel: "comun", p_tamano: "A4", p_anillado: false, p_encuadernado: true, p_apaisado: false });
assert.equal(Number(a4.precio_encuadernado), 9000, "encuadernado A4");
const { error: a3Error } = await db.rpc("cotizar_trabajo", { p_paginas: 20, p_tipo_papel: "comun", p_tamano: "A3", p_anillado: false, p_encuadernado: true, p_apaisado: false });
assert.ok(a3Error, "encuadernado A3 debe informar error");

const [{ count: apuntes, error: errorApuntes }, { count: servicios, error: errorServicios }] = await Promise.all([
  db.from("productos").select("id", { count: "exact", head: true }).eq("tipo", "encargo").eq("es_servicio", false).not("origen_fila", "is", null),
  db.from("productos").select("id", { count: "exact", head: true }).eq("es_servicio", true),
]);
if (errorApuntes || errorServicios) throw new Error(errorApuntes?.message ?? errorServicios?.message);
assert.equal(apuntes, 1220, "cantidad de apuntes");
assert.equal(servicios, 24, "cantidad de servicios");

if (!process.argv.includes("--catalogo")) {
  console.log("Motor de precios verificado: 13 casos y conteos de catálogo correctos.");
  process.exit(0);
}

// Auditoría adicional del CSV fuente. Se ejecuta bajo demanda para no demorar
// las verificaciones de rutina: npm run test:catalogo.
const textoCatalogo = await readFile(resolve("Claude outputs/catalogo_apuntes.csv"), "utf8");
const csvApuntes = parseCsv(textoCatalogo).filter((fila) => fila.destino === "apunte");
assert.equal(csvApuntes.length, 1220, "filas de apuntes en el CSV");
const porOrigen = new Map(csvApuntes.map((fila) => [Number(fila.origen_fila), fila]));

const paginasCatalogo = await Promise.all([0, 1000].map((desde) =>
  db.from("productos")
    .select("origen_fila,paginas,precio,anillo_mm,anillos_cant")
    .eq("tipo", "encargo")
    .eq("es_servicio", false)
    .not("origen_fila", "is", null)
    .order("origen_fila")
    .range(desde, desde + 999),
));
for (const pagina of paginasCatalogo) if (pagina.error) throw new Error(pagina.error.message);
const productosCatalogo = paginasCatalogo.flatMap((pagina) => pagina.data ?? []);
assert.equal(productosCatalogo.length, 1220, "productos de catálogo para verificar");

const preciosVerificados = await enLotes(productosCatalogo, 25, async (producto) => {
  const origen = Number(producto.origen_fila);
  const fuente = porOrigen.get(origen);
  assert.ok(fuente, `origen_fila ${origen} existe en el CSV`);
  const paginas = Number(fuente.paginas);
  // El catálogo conserva sus precios históricos; cambiar la tarifa de
  // impresión particular no modifica apuntes ya registrados.
  const hojasHistoricas = Math.ceil(paginas / 2);
  const precioHojaHistorico = hojasHistoricas <= 5 ? 500 : hojasHistoricas <= 10 ? 300 : 150;
  const esperado = Math.round((precioHojaHistorico * hojasHistoricas) / 100) * 100;
  assert.equal(Number(producto.paginas), paginas, `páginas de origen ${origen}`);
  assert.equal(Number(producto.precio), esperado, `tramo de precio de origen ${origen}`);
  assert.ok(Number(producto.precio) >= Number(fuente.precio_sin_anillado), `precio no disminuye respecto del CSV en origen ${origen}`);
  return producto;
});
assert.equal(preciosVerificados.length, 1220, "verificación de todos los apuntes");

// Muestra determinística de 20 filas, para que cada corrida sea reproducible.
const muestra = [...productosCatalogo]
  .sort((a, b) => ((Number(a.origen_fila) * 7919) % 1223) - ((Number(b.origen_fila) * 7919) % 1223))
  .slice(0, 20);
await enLotes(muestra, 10, async (producto) => {
  const origen = Number(producto.origen_fila);
  const fuente = porOrigen.get(origen);
  const calculado = await anillo(Number(fuente.paginas));
  assert.equal(Number(producto.anillo_mm), Number(fuente.anillo_mm_final), `medida de anillo CSV de origen ${origen}`);
  assert.equal(Number(producto.anillos_cant), Number(fuente.anillos_final), `cantidad de anillos CSV de origen ${origen}`);
  assert.equal(Number(calculado.medida_mm), Number(fuente.anillo_mm_final), `medida calculada de origen ${origen}`);
  assert.equal(Number(calculado.anillos), Number(fuente.anillos_final), `anillos calculados de origen ${origen}`);
  assert.equal(Number(calculado.precio), Number(fuente.precio_anillado_final), `precio de anillado de origen ${origen}`);
});

console.log("Motor de precios verificado: 13 casos, 1.220 apuntes por tramo y muestra de 20 anillos contra el CSV correctos.");
