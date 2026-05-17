import React from "react";
import { Document, Page, Text, View, StyleSheet, Svg, Rect } from "@react-pdf/renderer";
import { type PedidoPDF, groupItems } from "./types";

// 80 mm thermal paper → 226.77 pt. Print area ≈ 72 mm → 204 pt.
const W = 204;
const MH = 8; // horizontal margin

const C = { dark: "#1a1a2e", yellow: "#f5a623", mid: "#374151", light: "#d1d5db", xlight: "#f3f4f6" };

const s = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 9, color: C.dark, width: W, paddingBottom: 16 },

  // Header
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: MH, paddingTop: 10, paddingBottom: 8, borderBottomWidth: 1.5, borderBottomColor: C.dark, borderBottomStyle: "solid" },
  brand: { fontSize: 13, fontFamily: "Helvetica-Bold", color: C.dark, letterSpacing: 1 },
  brandSub: { fontSize: 6, color: C.mid },
  badge: { backgroundColor: C.dark, borderRadius: 3, paddingHorizontal: 6, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontFamily: "Helvetica-Bold", color: C.yellow, letterSpacing: 1 },

  // Info bar
  infoBar: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: MH, paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: C.light, borderBottomStyle: "solid" },
  infoText: { fontSize: 8, color: C.mid },
  infoNumero: { fontSize: 8, fontFamily: "Helvetica-Bold" },

  // Client
  clientBlock: { paddingHorizontal: MH, paddingTop: 8, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: C.dark, borderBottomStyle: "solid" },
  clientName: { fontSize: 16, fontFamily: "Helvetica-Bold", textAlign: "center" },
  clientPhone: { fontSize: 9, color: C.mid, textAlign: "center", marginTop: 2 },

  // Items
  itemRow: { paddingHorizontal: MH, paddingVertical: 7, borderBottomWidth: 0.5, borderBottomColor: C.light, borderBottomStyle: "solid", flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  itemText: { fontSize: 9, fontFamily: "Helvetica-Bold", flex: 1, paddingRight: 6 },
  itemQty: { fontSize: 9, color: C.mid },
  checkboxes: { flexDirection: "row", gap: 4 },
  checkbox: { width: 14, height: 14, borderWidth: 1, borderColor: C.mid, borderStyle: "solid", borderRadius: 2 },

  // Nota
  notaBlock: { paddingHorizontal: MH, paddingTop: 8, paddingBottom: 8, borderBottomWidth: 0.5, borderBottomColor: C.light, borderBottomStyle: "solid" },
  notaLabel: { fontSize: 7.5, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 0.5, color: C.mid, marginBottom: 14 },
  notaLine: { borderBottomWidth: 0.5, borderBottomColor: C.light, borderBottomStyle: "solid", marginBottom: 3 },

  // Ubicación
  ubicBlock: { paddingHorizontal: MH, paddingTop: 8, paddingBottom: 8, borderBottomWidth: 0.5, borderBottomColor: C.light, borderBottomStyle: "solid" },
  ubicTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", textAlign: "center", textDecoration: "underline", marginBottom: 6 },
  ubicGrid: { flexDirection: "row", gap: 4 },
  ubicCell: { flex: 1, borderWidth: 0.8, borderColor: C.mid, borderStyle: "solid", height: 36, padding: 4 },
  ubicText: { fontSize: 8, color: C.mid },
  ubicValue: { fontSize: 9, fontFamily: "Helvetica-Bold" },
  firma: { fontSize: 7.5, fontFamily: "Helvetica-Bold", textAlign: "center", marginTop: 6, color: C.mid },

  // Abono
  abonoBlock: { paddingHorizontal: MH, paddingTop: 8 },
  abonoTitle: { fontSize: 9, fontFamily: "Helvetica-Bold", textAlign: "center", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  abonoRow: { flexDirection: "row", justifyContent: "center", gap: 20, marginBottom: 8 },
  abonoOpt: { flexDirection: "row", alignItems: "center", gap: 4 },
  abonoLabel: { fontSize: 9 },
  montoRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  montoLabel: { fontSize: 9, fontFamily: "Helvetica-Bold" },
  montoLine: { flex: 1, borderBottomWidth: 0.5, borderBottomColor: C.mid, borderBottomStyle: "solid", height: 12 },
  dotted: { borderTopWidth: 1, borderTopColor: C.mid, borderTopStyle: "dashed", marginTop: 14, marginHorizontal: MH },

  // Order number
  numBlock: { paddingHorizontal: MH, paddingTop: 10, alignItems: "center" },
  numText: { fontSize: 11, fontFamily: "Helvetica-Bold", letterSpacing: 3, marginBottom: 4 },
  numBars: { marginBottom: 4 },
  numSub: { fontSize: 8, color: C.yellow, fontFamily: "Helvetica-Bold", letterSpacing: 2 },
});

function Checkbox() {
  return <View style={s.checkbox} />;
}

// Simple visual barcode (decorative, not scannable)
function Barcode({ numero }: { numero: string }) {
  const bars: { x: number; w: number }[] = [];
  const seed = numero.split("").map(Number);
  let x = 0;
  const patterns = [[1,2,1,2,1],[2,1,1,2,1],[1,1,2,2,1],[1,2,2,1,1],[2,1,2,1,1]];
  seed.forEach((d) => {
    const pat = patterns[d % 5];
    pat.forEach((w, i) => {
      if (i % 2 === 0) bars.push({ x, w: w * 1.5 });
      x += w * 1.5 + 0.8;
    });
  });
  const totalW = x;
  const scale = (W - MH * 2) / totalW;

  return (
    <Svg width={W - MH * 2} height={28}>
      {bars.map((b, i) => (
        <Rect key={i} x={b.x * scale} y={0} width={b.w * scale} height={28} fill={C.dark} />
      ))}
    </Svg>
  );
}

export function TicketPedidoDoc({ pedido }: { pedido: PedidoPDF }) {
  const grouped = groupItems(pedido.items);

  return (
    <Document>
      <Page size={[W, 842]} style={s.page}>

        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.brand}>IMPRESS</Text>
            <Text style={s.brandSub}>Imprimí con confianza</Text>
          </View>
          <View style={s.badge}>
            <Text style={s.badgeText}>PEDIDO</Text>
          </View>
        </View>

        {/* Date + N° */}
        <View style={s.infoBar}>
          <Text style={s.infoText}>{pedido.fecha}</Text>
          <Text style={s.infoNumero}>Ped. N° {parseInt(pedido.numero, 10)}</Text>
        </View>

        {/* Client */}
        <View style={s.clientBlock}>
          <Text style={s.clientName}>{pedido.cliente}</Text>
          {pedido.telefono ? <Text style={s.clientPhone}>{pedido.telefono}</Text> : null}
        </View>

        {/* Items */}
        {grouped.map(({ item, qty }, i) => (
          <View key={i} style={s.itemRow} wrap={false}>
            <Text style={s.itemQty}>{qty} x </Text>
            <Text style={s.itemText}>{item.producto}</Text>
            <View style={s.checkboxes}>
              <Checkbox />
              <Checkbox />
            </View>
          </View>
        ))}

        {/* Nota */}
        <View style={s.notaBlock}>
          <Text style={s.notaLabel}>NOTA:</Text>
          {pedido.mensaje ? (
            <Text style={{ fontSize: 9, marginBottom: 4 }}>{pedido.mensaje}</Text>
          ) : null}
          <View style={s.notaLine} />
          <View style={s.notaLine} />
        </View>

        {/* Ubicación */}
        <View style={s.ubicBlock}>
          <Text style={s.ubicTitle}>UBICACION</Text>
          <View style={s.ubicGrid}>
            <View style={s.ubicCell}>
              <Text style={s.ubicText}>Retira en:</Text>
              <Text style={s.ubicValue}>{pedido.sucursal_retiro ?? ""}</Text>
            </View>
            <View style={s.ubicCell}>
              <Text style={s.ubicText}>Produccion:</Text>
              <Text style={s.ubicValue}>{pedido.sucursal_produccion ?? ""}</Text>
            </View>
          </View>
          <Text style={s.firma}>Firma de entrega</Text>
        </View>

        {/* Abono */}
        <View style={s.abonoBlock}>
          <Text style={s.abonoTitle}>ABONO:</Text>
          <View style={s.abonoRow}>
            <View style={s.abonoOpt}>
              <Checkbox />
              <Text style={s.abonoLabel}>Efectivo</Text>
            </View>
            <View style={s.abonoOpt}>
              <Checkbox />
              <Text style={s.abonoLabel}>Transferencia</Text>
            </View>
          </View>
          <View style={s.montoRow}>
            <Text style={s.montoLabel}>Monto :</Text>
            <View style={s.montoLine} />
          </View>
        </View>

        <View style={s.dotted} />

        {/* Order number + barcode */}
        <View style={s.numBlock}>
          <View style={s.numBars}>
            <Barcode numero={pedido.numero} />
          </View>
          <Text style={s.numSub}>{parseInt(pedido.numero, 10)}</Text>
        </View>

      </Page>
    </Document>
  );
}
