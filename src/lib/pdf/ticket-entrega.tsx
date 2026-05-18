import React from "react";
import { readFileSync } from "fs";
import { join } from "path";
import { Document, Image, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { type PedidoPDF, fmtARS, groupItems } from "./types";

const W = 204;
const MH = 8;
const LOGO_SRC = `data:image/png;base64,${readFileSync(join(process.cwd(), "public", "impress-logo.png")).toString("base64")}`;

const C = {
  dark: "#000000",
  yellow: "#fff200",
  cyan: "#139ce8",
  magenta: "#e6007e",
  mid: "#111827",
  light: "#9ca3af",
  soft: "#f8fafc",
};

const s = StyleSheet.create({
  page: { fontFamily: "Helvetica-Bold", fontSize: 11, color: C.dark, width: W, paddingBottom: 24 },
  header: { paddingHorizontal: MH, paddingTop: 8, paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: C.dark, borderBottomStyle: "solid" },
  brandRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  logo: { width: 84, height: 46, objectFit: "contain" },
  badge: { backgroundColor: C.dark, borderRadius: 3, paddingHorizontal: 7, paddingVertical: 4 },
  badgeText: { fontSize: 12, fontFamily: "Helvetica-Bold", color: C.yellow },
  title: { fontSize: 10, fontFamily: "Helvetica-Bold", color: C.mid, marginTop: 4, textTransform: "uppercase", letterSpacing: 0.7 },
  infoBar: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: MH, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.light, borderBottomStyle: "solid" },
  infoText: { fontSize: 10, fontFamily: "Helvetica-Bold", color: C.mid },
  infoBold: { fontSize: 10, fontFamily: "Helvetica-Bold" },
  clientBlock: { paddingHorizontal: MH, paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: C.dark, borderBottomStyle: "solid" },
  clientName: { fontSize: 19, fontFamily: "Helvetica-Bold", textAlign: "center" },
  clientPhone: { fontSize: 12, fontFamily: "Helvetica-Bold", color: C.mid, textAlign: "center", marginTop: 3 },
  sectionTitle: { paddingHorizontal: MH, paddingTop: 10, paddingBottom: 5, fontSize: 11, fontFamily: "Helvetica-Bold", color: C.mid, textTransform: "uppercase", letterSpacing: 0.6 },
  itemRow: { paddingHorizontal: MH, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.light, borderBottomStyle: "solid" },
  itemTop: { flexDirection: "row", justifyContent: "space-between", gap: 6 },
  itemName: { fontSize: 12, fontFamily: "Helvetica-Bold", flex: 1, lineHeight: 1.2 },
  itemPrice: { fontSize: 12, fontFamily: "Helvetica-Bold" },
  itemDetail: { fontSize: 10, fontFamily: "Helvetica-Bold", color: C.mid, marginTop: 3 },
  totals: { marginHorizontal: MH, marginTop: 10, borderWidth: 1.5, borderColor: C.dark, borderStyle: "solid", borderRadius: 3 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 7, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.light, borderBottomStyle: "solid" },
  totalLabel: { fontSize: 11, fontFamily: "Helvetica-Bold", color: C.mid },
  totalValue: { fontSize: 12, fontFamily: "Helvetica-Bold" },
  totalDue: { fontSize: 15, fontFamily: "Helvetica-Bold", color: C.dark },
  note: { paddingHorizontal: MH, paddingTop: 10, color: C.mid, fontSize: 11, fontFamily: "Helvetica-Bold", textAlign: "center" },
  exchangeNote: { marginHorizontal: MH, marginTop: 14, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.dark, borderTopStyle: "solid", textAlign: "center", fontSize: 10, fontFamily: "Helvetica-Bold", color: C.dark, textTransform: "uppercase" },
});

function wrapTicketText(value: string, maxLineLength = 24) {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  const pushLongToken = (token: string) => {
    let rest = token;
    while (rest.length > maxLineLength) {
      let cut = rest.lastIndexOf("_", maxLineLength);
      if (cut < 10) cut = maxLineLength;
      lines.push(rest.slice(0, cut + (rest[cut] === "_" ? 1 : 0)));
      rest = rest.slice(cut + (rest[cut] === "_" ? 1 : 0));
    }
    current = rest;
  };

  for (const word of words) {
    if (word.length > maxLineLength) {
      if (current) {
        lines.push(current);
        current = "";
      }
      pushLongToken(word);
      continue;
    }

    const next = current ? `${current} ${word}` : word;
    if (next.length > maxLineLength) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) lines.push(current);
  return lines.join("\n");
}

export function TicketEntregaDoc({ pedido }: { pedido: PedidoPDF }) {
  const grouped = groupItems(pedido.items);
  const resta = Math.max(0, pedido.total - pedido.senia);

  return (
    <Document>
      <Page size={[W, 842]} style={s.page}>
        <View style={s.header}>
          <View style={s.brandRow}>
            <Image src={LOGO_SRC} style={s.logo} />
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
                <Text style={s.itemName}>{qty} x{"\n"}{wrapTicketText(item.producto)}</Text>
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
        <Text style={s.exchangeNote}>Para cambio o devolucion conserve el ticket, sin excepciones.</Text>
      </Page>
    </Document>
  );
}
