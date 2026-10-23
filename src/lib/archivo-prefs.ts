type ArchivoPrefs = {
  copias?: number | null;
  color?: boolean | null;
  doble_faz?: boolean | null;
  tamano_papel?: string | null;
};

type ItemPedidoResumen = {
  cantidad?: number | null;
  producto?: string | null;
  modo?: string | null;
  anotacion?: string | null;
};

export type PreferenciasImpresion = {
  copias: number;
  color: boolean;
  doble_faz: boolean;
  tamano_papel: string;
};

const TAMANOS_PAPEL = ["A3", "A4", "A5", "Letter", "Oficio"];

function textoDelItem(item: ItemPedidoResumen) {
  return [item.producto, item.modo, item.anotacion].filter(Boolean).join(" ").toLowerCase();
}

/**
 * Convierte los datos ya cargados en un ítem a las preferencias que necesita
 * la cola de impresión. Los pedidos viejos no tenían esta asociación: cuando
 * sólo hay un ítem, usarlo como fuente evita que el archivo quede en 1 B&N.
 */
export function preferenciasDesdeItem(item: ItemPedidoResumen): PreferenciasImpresion {
  const texto = textoDelItem(item);
  const tamano = TAMANOS_PAPEL.find((value) => new RegExp(`\\b${value.toLowerCase()}\\b`).test(texto)) ?? "A4";

  return {
    copias: Math.max(1, Math.floor(Number(item.cantidad) || 1)),
    color: /\bcolor\b/.test(texto) && !/blanco\s*(?:y|&)\s*negro|\bb&n\b/.test(texto),
    doble_faz: /doble\s*faz|doble\s*cara/.test(texto),
    tamano_papel: tamano,
  };
}

export function resolverPreferenciasArchivo(
  archivo: ArchivoPrefs,
  items: ItemPedidoResumen[] | null | undefined,
): PreferenciasImpresion {
  const guardadas: PreferenciasImpresion = {
    copias: Math.max(1, Math.floor(Number(archivo.copias) || 1)),
    color: Boolean(archivo.color),
    doble_faz: Boolean(archivo.doble_faz),
    tamano_papel: archivo.tamano_papel || "A4",
  };

  // Compatibilidad para adjuntos anteriores: se creaban siempre con los
  // valores por defecto y no reflejaban el único producto del pedido.
  if (items?.length !== 1) return guardadas;
  const delItem = preferenciasDesdeItem(items[0]);
  const pareceDefault = guardadas.copias === 1
    && !guardadas.color
    && !guardadas.doble_faz
    && guardadas.tamano_papel === "A4";

  return pareceDefault ? delItem : guardadas;
}
