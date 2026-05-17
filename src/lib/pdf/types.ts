export type ItemPDF = {
  producto: string;
  paginas?: number | null;
  modo?: string | null;
  precio: number;
  descuento?: number | null;
  anotacion?: string | null;
  pago?: string | null;
};

export type PedidoPDF = {
  numero: string;
  fecha: string;
  cliente: string;
  telefono?: string | null;
  items: ItemPDF[];
  senia: number;
  total: number;
  sucursal_retiro?: string | null;
  sucursal_produccion?: string | null;
  mensaje?: string | null;
  medio_pago?: string | null;
};

export function fmtARS(n: number) {
  return "$ " + n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function groupItems(items: ItemPDF[]) {
  const map = new Map<string, { item: ItemPDF; qty: number }>();
  for (const item of items) {
    const k = item.producto;
    const existing = map.get(k);
    if (existing) existing.qty++;
    else map.set(k, { item, qty: 1 });
  }
  return Array.from(map.values());
}
