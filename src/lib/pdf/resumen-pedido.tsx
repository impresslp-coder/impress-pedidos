import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { type PedidoPDF, fmtARS } from "./types";

const C = { dark: "#1a1a2e", yellow: "#f5a623", gray: "#6b7280", light: "#f3f4f6", red: "#dc2626", green: "#16a34a" };

const s = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 10, color: C.dark, paddingBottom: 72 },

  // ── Header ──
  header: { backgroundColor: C.dark, flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 32, paddingVertical: 18 },
  brand: { fontSize: 26, fontFamily: "Helvetica-Bold", color: C.yellow, letterSpacing: 2 },
  tagline: { fontSize: 7.5, color: "#9ca3af", marginTop: 2 },
  hRight: { alignItems: "flex-end" },
  hDoc: { fontSize: 8, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 },
  hNum: { fontSize: 16, fontFamily: "Helvetica-Bold", color: "white" },
  accentBar: { height: 4, backgroundColor: C.yellow },

  // ── Body ──
  body: { paddingHorizontal: 32, paddingTop: 24 },

  clientRow: { flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: C.light, borderBottomStyle: "solid", paddingBottom: 16, marginBottom: 20 },
  label: { fontSize: 7.5, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 3 },
  clientName: { fontSize: 17, fontFamily: "Helvetica-Bold" },
  clientSub: { fontSize: 9, color: C.gray, marginTop: 2 },

  // Finance box
  finBox: { backgroundColor: "#fffbeb", borderLeftWidth: 4, borderLeftColor: C.yellow, borderLeftStyle: "solid", borderRadius: 4, padding: 14, marginBottom: 22 },
  finTotal: { fontSize: 14, fontFamily: "Helvetica-Bold", marginBottom: 10 },
  finRow: { flexDirection: "row", gap: 24 },
  finCol: { flex: 1 },
  finVal: { fontSize: 13, fontFamily: "Helvetica-Bold" },
  finRed: { fontSize: 13, fontFamily: "Helvetica-Bold", color: C.red },
  finGreen: { fontSize: 13, fontFamily: "Helvetica-Bold", color: C.green },

  // Items
  sectionTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 0.8, color: C.gray, marginBottom: 10 },
  itemRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.light, borderBottomStyle: "solid" },
  itemName: { fontSize: 11, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  itemDetail: { fontSize: 9, color: C.gray, marginBottom: 1.5 },
  itemPrice: { fontSize: 11, fontFamily: "Helvetica-Bold", color: C.yellow, marginTop: 4 },
  itemDesc: { fontSize: 9, color: C.green },

  nota: { marginTop: 18, backgroundColor: "#fef3c7", borderRadius: 4, padding: 12 },
  notaTitle: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#92400e", marginBottom: 3 },
  notaText: { fontSize: 9, color: "#78350f" },

  // Footer
  footer: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: C.dark, paddingHorizontal: 32, paddingVertical: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  footerText: { fontSize: 7.5, color: "#9ca3af", marginBottom: 2 },
  footerBrand: { fontSize: 16, fontFamily: "Helvetica-Bold", color: C.yellow, letterSpacing: 2 },
});

export function ResumenPedidoDoc({ pedido }: { pedido: PedidoPDF }) {
  const resta = pedido.total - pedido.senia;

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.brand}>IMPRESS</Text>
            <Text style={s.tagline}>Imprimí con confianza · Imprimi con Impress</Text>
          </View>
          <View style={s.hRight}>
            <Text style={s.hDoc}>Resumen de pedido</Text>
            <Text style={s.hNum}>N° {pedido.numero}</Text>
          </View>
        </View>
        <View style={s.accentBar} />

        <View style={s.body}>
          {/* Client */}
          <View style={s.clientRow}>
            <View>
              <Text style={s.label}>Cliente</Text>
              <Text style={s.clientName}>{pedido.cliente}</Text>
              {pedido.telefono ? <Text style={s.clientSub}>{pedido.telefono}</Text> : null}
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={s.label}>Fecha</Text>
              <Text style={s.clientSub}>{pedido.fecha}</Text>
              {pedido.sucursal_retiro ? (
                <View style={{ marginTop: 8, alignItems: "flex-end" }}>
                  <Text style={s.label}>Retira en</Text>
                  <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold" }}>{pedido.sucursal_retiro}</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Financiero */}
          <View style={s.finBox}>
            <Text style={s.finTotal}>Total del pedido: {fmtARS(pedido.total)}</Text>
            <View style={s.finRow}>
              <View style={s.finCol}>
                <Text style={s.label}>Abonado</Text>
                <Text style={s.finGreen}>{fmtARS(pedido.senia)}</Text>
              </View>
              <View style={s.finCol}>
                <Text style={s.label}>Resta</Text>
                <Text style={resta > 0 ? s.finRed : s.finGreen}>{fmtARS(Math.max(0, resta))}</Text>
              </View>
              {pedido.medio_pago ? (
                <View style={s.finCol}>
                  <Text style={s.label}>Medio de pago</Text>
                  <Text style={s.finVal}>{pedido.medio_pago}</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Items */}
          <Text style={s.sectionTitle}>Detalle del pedido</Text>
          {pedido.items.map((item, i) => {
            const precio = item.precio * (1 - (item.descuento ?? 0) / 100);
            return (
              <View key={i} style={s.itemRow} wrap={false}>
                <Text style={s.itemName}>{item.producto}</Text>
                {item.modo ? <Text style={s.itemDetail}>Modo: {item.modo}</Text> : null}
                {item.paginas ? <Text style={s.itemDetail}>Paginas: {item.paginas}</Text> : null}
                {item.anotacion ? <Text style={s.itemDetail}>Nota: {item.anotacion}</Text> : null}
                {item.pago ? <Text style={s.itemDetail}>Entrega: {item.pago}</Text> : null}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 }}>
                  <Text style={s.itemPrice}>{fmtARS(precio)}</Text>
                  {(item.descuento ?? 0) > 0 ? <Text style={s.itemDesc}>{item.descuento}% dto.</Text> : null}
                </View>
              </View>
            );
          })}

          {/* Nota */}
          {pedido.mensaje ? (
            <View style={s.nota}>
              <Text style={s.notaTitle}>NOTA</Text>
              <Text style={s.notaText}>{pedido.mensaje}</Text>
            </View>
          ) : null}
        </View>

        {/* Footer */}
        <View style={s.footer} fixed>
          <View>
            <Text style={s.footerText}>60 e 21 y 22 n 1347  ·  41 n 1378 e/ d. 73 y 23</Text>
            <Text style={s.footerText}>221-554-0877</Text>
          </View>
          <Text style={s.footerBrand}>IMPRESS</Text>
        </View>
      </Page>
    </Document>
  );
}
