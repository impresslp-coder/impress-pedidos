import React from "react";
import { Document, Page, Text, View, StyleSheet, Svg, Rect } from "@react-pdf/renderer";
import { type PedidoPDF, fmtARS, groupItems } from "./types";

const W = 204;
const MH = 8;

const C = {
  dark: "#1a1a2e",
  yellow: "#f5a623",
  mid: "#374151",
  light: "#d1d5db",
  soft: "#f8fafc",
  red: "#dc2626",
};

const s = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 9, color: C.dark, width: W, paddingBottom: 16 },
  header: { paddingHorizontal: MH, paddingTop: 10, paddingBottom: 8, borderBottomWidth: 1.5, borderBottomColor: C.dark, borderBottomStyle: "solid" },
  brandRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  brand: { fontSize: 13, fontFamily: "Helvetica-Bold", letterSpacing: 1 },
  badge: { backgroundColor: C.yellow, borderRadius: 3, paddingHorizontal: 6, paddingVertical: 3 },
  badgeText: { fontSize: 9, fontFamily: "Helvetica-Bold", color: C.dark },
  title: { fontSize: 8, color: C.mid, marginTop: 3, textTransform: "uppercase", letterSpacing: 0.7 },
  infoBar: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: MH, paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: C.light, borderBottomStyle: "solid" },
  infoText: { fontSize: 8, color: C.mid },
  infoBold: { fontSize: 8, fontFamily: "Helvetica-Bold" },
  clientBlock: { paddingHorizontal: MH, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.dark, borderBottomStyle: "solid" },
  clientName: { fontSize: 15, fontFamily: "Helvetica-Bold", textAlign: "center" },
  clientPhone: { fontSize: 9, color: C.mid, textAlign: "center", marginTop: 2 },
  sectionTitle: { paddingHorizontal: MH, paddingTop: 8, paddingBottom: 4, fontSize: 8, fontFamily: "Helvetica-Bold", color: C.mid, textTransform: "uppercase", letterSpacing: 0.6 },
  itemRow: { paddingHorizontal: MH, paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: C.light, borderBottomStyle: "solid" },
  itemTop: { flexDirection: "row", justifyContent: "space-between", gap: 6 },
  itemName: { fontSize: 9, fontFamily: "Helvetica-Bold", flex: 1 },
  itemPrice: { fontSize: 9, fontFamily: "Helvetica-Bold" },
  itemDetail: { fontSize: 7.5, color: C.mid, marginTop: 2 },
  totals: { marginHorizontal: MH, marginTop: 8, borderWidth: 1, borderColor: C.dark, borderStyle: "solid", borderRadius: 3 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 7, paddingVertical: 5, borderBottomWidth: 0.5, borderBottomColor: C.light, borderBottomStyle: "solid" },
  totalLabel: { fontSize: 9, color: C.mid },
  totalValue: { fontSize: 10, fontFamily: "Helvetica-Bold" },
  totalDue: { fontSize: 12, fontFamily: "Helvetica-Bold", color: C.red },
  note: { paddingHorizontal: MH, paddingTop: 8, color: C.mid, fontSize: 8, textAlign: "center" },
  signature: { marginHorizontal: MH, marginTop: 14, paddingTop: 12, borderTopWidth: 0.5, borderTopColor: C.dark, borderTopStyle: "solid", textAlign: "center", fontSize: 8, color: C.mid },
  barcodeWrap: { paddingHorizontal: MH, paddingTop: 10, alignItems: "center" },
  numSub: { fontSize: 8, color: C.yellow, fontFamily: "Helvetica-Bold", letterSpacing: 2, marginTop: 3 },
});

function Barcode({ numero }: { numero: string }) {
  const bars: { x: number; w: number }[] = [];
  const seed = numero.split("").map(Number);
  let x = 0;
  const patterns = [[1, 2, 1, 2, 1], [2, 1, 1, 2, 1], [1, 1, 2, 2, 1], [1, 2, 2, 1, 1], [2, 1, 2, 1, 1]];
  seed.forEach((d) => {
    const pat = patterns[d % 5];
    pat.forEach((w, i) => {
      if (i % 2 === 0) bars.push({ x, w: w * 1.5 });
      x += w * 1.5 + 0.8;
    });
  });
  const scale = (W - MH * 2) / x;
  return (
    <Svg width={W - MH * 2} height={26}>
      {bars.map((b, i) => (
        <Rect key={i} x={b.x * scale} y={0} width={b.w * scale} height={26} fill={C.dark} />
      ))}
    </Svg>
  );
}

export function TicketEntregaDoc({ pedido }: { pedido: PedidoPDF }) {
  const grouped = groupItems(pedido.items);
  const resta = Math.max(0, pedido.total - pedido.senia);

  return (
    <Document>
      <Page size={[W, 842]} style={s.page}>
        <View style={s.header}>
          <View style={s.brandRow}>
            <Text style={s.brand}>IMPRESS</Text>
            <View style={s.badge}><Text style={s.badgeText}>ENTREGA</Text></View>
          </View>
          <Text style={s.title}>Comprobante de entrega</Text>
        </View>

        <View style={s.infoBar}>
          <Text style={s.infoText}>{pedido.fecha}</Text>
          <Text style={s.infoBold}>Ped. N° {parseInt(pedido.numero, 10)}</Text>
        </View>

        <View style={s.clientBlock}>
          <Text style={s.clientName}>{pedido.cliente}</Text>
          {pedido.telefono ? <Text style={s.clientPhone}>{pedido.telefono}</Text> : null}
        </View>

        <Text style={s.sectionTitle}>Detalle del pedido</Text>
        {grouped.map(({ item, qty }, index) => {
          const precio = item.precio * (1 - (item.descuento ?? 0) / 100);
          return (
            <View key={index} style={s.itemRow} wrap={false}>
              <View style={s.itemTop}>
                <Text style={s.itemName}>{qty} x {item.producto}</Text>
                <Text style={s.itemPrice}>{fmtARS(precio * qty)}</Text>
              </View>
              {item.modo ? <Text style={s.itemDetail}>Modo: {item.modo}</Text> : null}
              {item.paginas ? <Text style={s.itemDetail}>Paginas: {item.paginas}</Text> : null}
              {item.anotacion ? <Text style={s.itemDetail}>Nota: {item.anotacion}</Text> : null}
            </View>
          );
        })}

        <View style={s.totals}>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Total</Text>
            <Text style={s.totalValue}>{fmtARS(pedido.total)}</Text>
          </View>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Abono</Text>
            <Text style={s.totalValue}>{fmtARS(pedido.senia)}</Text>
          </View>
          <View style={[s.totalRow, { borderBottomWidth: 0 }]}>
            <Text style={s.totalLabel}>Resta</Text>
            <Text style={s.totalDue}>{fmtARS(resta)}</Text>
          </View>
        </View>

        <Text style={s.note}>Verificar el pedido antes de retirar.</Text>
        <Text style={s.signature}>Firma / aclaracion de quien retira</Text>

        <View style={s.barcodeWrap}>
          <Barcode numero={pedido.numero} />
          <Text style={s.numSub}>{parseInt(pedido.numero, 10)}</Text>
        </View>
      </Page>
    </Document>
  );
}
