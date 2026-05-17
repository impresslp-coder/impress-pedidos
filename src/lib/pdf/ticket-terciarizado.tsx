import React from "react";
import { Document, Page, Text, View, StyleSheet, Svg, Rect } from "@react-pdf/renderer";

// 80 mm thermal paper → 226.77 pt. Print area ≈ 72 mm → 204 pt.
const W  = 204;
const MH = 8;

const C = {
  dark:   "#1a1a2e",
  yellow: "#f5a623",
  mid:    "#374151",
  light:  "#d1d5db",
  xlight: "#f3f4f6",
};

const s = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 9, color: C.dark, width: W, paddingBottom: 16 },

  // Header
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: MH, paddingTop: 10, paddingBottom: 8, borderBottomWidth: 1.5, borderBottomColor: C.dark, borderBottomStyle: "solid" },
  brand:    { fontSize: 13, fontFamily: "Helvetica-Bold", color: C.dark, letterSpacing: 1 },
  brandSub: { fontSize: 6, color: C.mid },
  badge:     { backgroundColor: C.dark, borderRadius: 3, paddingHorizontal: 6, paddingVertical: 3 },
  badgeText: { fontSize: 9, fontFamily: "Helvetica-Bold", color: C.yellow, letterSpacing: 0.5 },

  // Info bar
  infoBar:    { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: MH, paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: C.light, borderBottomStyle: "solid" },
  infoText:   { fontSize: 8, color: C.mid },
  infoNumero: { fontSize: 8, fontFamily: "Helvetica-Bold" },

  // Client
  clientBlock: { paddingHorizontal: MH, paddingTop: 8, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: C.dark, borderBottomStyle: "solid" },
  clientName:  { fontSize: 14, fontFamily: "Helvetica-Bold", textAlign: "center" },
  clientPhone: { fontSize: 9, color: C.mid, textAlign: "center", marginTop: 2 },

  // Item principal
  itemBlock: { paddingHorizontal: MH, paddingTop: 8, paddingBottom: 8, borderBottomWidth: 0.5, borderBottomColor: C.light, borderBottomStyle: "solid" },
  itemLabel:  { fontSize: 7.5, fontFamily: "Helvetica-Bold", textTransform: "uppercase", color: C.mid, letterSpacing: 0.5, marginBottom: 3 },
  itemText:   { fontSize: 11, fontFamily: "Helvetica-Bold" },
  itemSub:    { fontSize: 8.5, color: C.mid, marginTop: 2 },

  // Detalle row
  detalleBlock: { paddingHorizontal: MH, paddingTop: 6, paddingBottom: 6, borderBottomWidth: 0.5, borderBottomColor: C.light, borderBottomStyle: "solid" },
  detalleLabel: { fontSize: 7.5, fontFamily: "Helvetica-Bold", textTransform: "uppercase", color: C.mid, letterSpacing: 0.5, marginBottom: 2 },
  detalleText:  { fontSize: 9 },

  // Totales
  totalBlock: { paddingHorizontal: MH, paddingTop: 8, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: C.dark, borderBottomStyle: "solid" },
  totalRow:   { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
  totalLabel: { fontSize: 9, color: C.mid },
  totalValue: { fontSize: 9, fontFamily: "Helvetica-Bold" },
  seniaRow:   { flexDirection: "row", justifyContent: "space-between" },
  seniaLabel: { fontSize: 8, color: C.mid },
  seniaValue: { fontSize: 8, color: C.mid },

  // Mensaje
  mensajeBlock: { paddingHorizontal: MH, paddingTop: 8, paddingBottom: 8, borderBottomWidth: 0.5, borderBottomColor: C.light, borderBottomStyle: "solid" },
  mensajeLabel: { fontSize: 7.5, fontFamily: "Helvetica-Bold", textTransform: "uppercase", color: C.mid, letterSpacing: 0.5, marginBottom: 3 },
  mensajeText:  { fontSize: 8, color: C.mid },

  // Número grande + barcode
  dotted:   { borderTopWidth: 1, borderTopColor: C.mid, borderTopStyle: "dashed", marginTop: 10, marginHorizontal: MH },
  numBlock: { paddingHorizontal: MH, paddingTop: 10, alignItems: "center" },
  numText:  { fontSize: 18, fontFamily: "Helvetica-Bold", letterSpacing: 3, marginBottom: 6, color: C.dark },
  numSub:   { fontSize: 8, color: C.yellow, fontFamily: "Helvetica-Bold", letterSpacing: 2 },
  numBars:  { marginBottom: 4 },
});

function Barcode({ numero }: { numero: string }) {
  const clean = numero.replace(/\D/g, "").padStart(4, "0");
  const bars: { x: number; w: number }[] = [];
  const seed = clean.split("").map(Number);
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
  const scale  = (W - MH * 2) / totalW;
  return (
    <Svg width={W - MH * 2} height={28}>
      {bars.map((b, i) => (
        <Rect key={i} x={b.x * scale} y={0} width={b.w * scale} height={28} fill={C.dark} />
      ))}
    </Svg>
  );
}

function fmtARS(n: number) {
  return "$ " + n.toLocaleString("es-AR", { minimumFractionDigits: 2 });
}

export type TerciarizadoPDF = {
  numero:    string;
  fecha:     string;
  cliente:   string;
  telefono?: string | null;
  item:      string;
  cantidad?: number | null;
  anotacion?: string | null;
  proveedor: string;
  total:     number;
  senia:     number;
  sucursal?: string | null;
  mensaje?:  string | null;
};

export function TicketTerciarizadoDoc({ encargo }: { encargo: TerciarizadoPDF }) {
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
            <Text style={s.badgeText}>ENCARGO</Text>
          </View>
        </View>

        {/* Fecha + Número */}
        <View style={s.infoBar}>
          <Text style={s.infoText}>{encargo.fecha}</Text>
          <Text style={s.infoNumero}>{encargo.numero}</Text>
        </View>

        {/* Cliente */}
        <View style={s.clientBlock}>
          <Text style={s.clientName}>{encargo.cliente}</Text>
          {encargo.telefono ? (
            <Text style={s.clientPhone}>{encargo.telefono}</Text>
          ) : null}
        </View>

        {/* Ítem */}
        <View style={s.itemBlock}>
          <Text style={s.itemLabel}>Ítem / descripción</Text>
          <Text style={s.itemText}>{encargo.item}</Text>
          {encargo.cantidad ? (
            <Text style={s.itemSub}>Cantidad: {encargo.cantidad} unidades</Text>
          ) : null}
        </View>

        {/* Anotación */}
        {encargo.anotacion ? (
          <View style={s.detalleBlock}>
            <Text style={s.detalleLabel}>Anotación</Text>
            <Text style={s.detalleText}>{encargo.anotacion}</Text>
          </View>
        ) : null}

        {/* Sucursal */}
        {encargo.sucursal ? (
          <View style={s.detalleBlock}>
            <Text style={s.detalleLabel}>Sucursal</Text>
            <Text style={s.detalleText}>{encargo.sucursal}</Text>
          </View>
        ) : null}

        {/* Totales */}
        <View style={s.totalBlock}>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Total:</Text>
            <Text style={s.totalValue}>{fmtARS(encargo.total)}</Text>
          </View>
          {encargo.senia > 0 ? (
            <View style={s.seniaRow}>
              <Text style={s.seniaLabel}>Seña abonada:</Text>
              <Text style={s.seniaValue}>{fmtARS(encargo.senia)}</Text>
            </View>
          ) : null}
        </View>

        <View style={s.dotted} />

        {/* Número grande + barcode */}
        <View style={s.numBlock}>
          <View style={s.numBars}>
            <Barcode numero={encargo.numero} />
          </View>
          <Text style={s.numText}>{encargo.numero}</Text>
        </View>

      </Page>
    </Document>
  );
}
