import React from "react";
import { readFileSync } from "fs";
import { join } from "path";
import { Document, Image, Page, Text, View, StyleSheet, Svg, Rect } from "@react-pdf/renderer";
import { type PedidoPDF, groupItems } from "./types";

// 80 mm thermal paper → 226.77 pt. Print area ≈ 72 mm → 204 pt.
const W = 204;
const MH = 8; // horizontal margin
const LOGO_SRC = `data:image/png;base64,${readFileSync(join(process.cwd(), "public", "impress-logo.png")).toString("base64")}`;

const C = { dark: "#000000", yellow: "#fff200", cyan: "#139ce8", magenta: "#e6007e", mid: "#111827", light: "#9ca3af", xlight: "#f3f4f6" };

const s = StyleSheet.create({
  page: { fontFamily: "Helvetica-Bold", fontSize: 11, color: C.dark, width: W, paddingBottom: 24 },

  // Header
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: MH, paddingTop: 8, paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: C.dark, borderBottomStyle: "solid", minHeight: 58 },
  logo: { width: 84, height: 46, objectFit: "contain" },
  badge: { backgroundColor: C.dark, borderRadius: 3, paddingHorizontal: 7, paddingVertical: 4 },
  badgeText: { fontSize: 12, fontFamily: "Helvetica-Bold", color: C.yellow, letterSpacing: 1 },

  // Info bar
  infoBar: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: MH, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.light, borderBottomStyle: "solid" },
  infoText: { fontSize: 10, fontFamily: "Helvetica-Bold", color: C.mid },
  infoNumero: { fontSize: 10, fontFamily: "Helvetica-Bold" },

  // Client
  clientBlock: { paddingHorizontal: MH, paddingTop: 10, paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: C.dark, borderBottomStyle: "solid" },
  clientName: { fontSize: 19, fontFamily: "Helvetica-Bold", textAlign: "center" },
  clientPhone: { fontSize: 12, fontFamily: "Helvetica-Bold", color: C.mid, textAlign: "center", marginTop: 3 },

  // Items
  itemRow: { paddingHorizontal: MH, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: C.light, borderBottomStyle: "solid" },
  itemText: { fontSize: 12, fontFamily: "Helvetica-Bold", lineHeight: 1.2 },
  itemQty: { fontSize: 12, fontFamily: "Helvetica-Bold", color: C.mid },
  checkbox: { width: 16, height: 16, borderWidth: 1.5, borderColor: C.mid, borderStyle: "solid", borderRadius: 2 },

  // Nota
  notaBlock: { paddingHorizontal: MH, paddingTop: 8, paddingBottom: 8, borderBottomWidth: 0.5, borderBottomColor: C.light, borderBottomStyle: "solid" },
  notaLabel: { fontSize: 10, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 0.5, color: C.mid, marginBottom: 14 },
  notaLine: { borderBottomWidth: 0.5, borderBottomColor: C.light, borderBottomStyle: "solid", marginBottom: 3 },

  // Ubicación
  ubicBlock: { paddingHorizontal: MH, paddingTop: 8, paddingBottom: 16, borderBottomWidth: 0.5, borderBottomColor: C.light, borderBottomStyle: "solid" },
  ubicTitle: { fontSize: 13, fontFamily: "Helvetica-Bold", textAlign: "center", textDecoration: "underline", marginBottom: 7 },
  ubicGrid: { flexDirection: "row", gap: 4 },
  ubicCell: { flex: 1, borderWidth: 0.8, borderColor: C.mid, borderStyle: "solid", height: 36, padding: 4 },
  ubicText: { fontSize: 10, fontFamily: "Helvetica-Bold", color: C.mid },
  ubicValue: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  firmaBox: { marginTop: 14, height: 82, justifyContent: "flex-end" },
  firmaLine: { borderTopWidth: 1, borderTopColor: C.dark, borderTopStyle: "solid", marginBottom: 7 },
  firma: { fontSize: 11, fontFamily: "Helvetica-Bold", textAlign: "center", color: C.mid },

  // Abono
  abonoBlock: { paddingHorizontal: MH, paddingTop: 8 },
  abonoTitle: { fontSize: 12, fontFamily: "Helvetica-Bold", textAlign: "center", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  abonoRow: { flexDirection: "row", justifyContent: "center", gap: 20, marginBottom: 8 },
  abonoOpt: { flexDirection: "row", alignItems: "center", gap: 4 },
  abonoLabel: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  montoRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  montoLabel: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  montoLine: { flex: 1, borderBottomWidth: 0.5, borderBottomColor: C.mid, borderBottomStyle: "solid", height: 12 },
  dotted: { borderTopWidth: 1, borderTopColor: C.mid, borderTopStyle: "dashed", marginTop: 14, marginHorizontal: MH },

  // Order number
  numBlock: { paddingHorizontal: MH, paddingTop: 10, alignItems: "center" },
  numText: { fontSize: 13, fontFamily: "Helvetica-Bold", letterSpacing: 3, marginBottom: 4 },
  numBars: { marginBottom: 4 },
  numSub: { fontSize: 11, color: C.dark, fontFamily: "Helvetica-Bold", letterSpacing: 2 },
});

function Checkbox() {
  return <View style={s.checkbox} />;
}

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

const CODE128_PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112",
];

function code128BValues(value: string) {
  const clean = value.replace(/[^\x20-\x7e]/g, "").trim() || "0";
  const values = [104];
  for (const char of clean) values.push(char.charCodeAt(0) - 32);
  const checksum = values.reduce((sum, code, index) => sum + (index === 0 ? code : code * index), 0) % 103;
  return [...values, checksum, 106];
}

function Barcode({ numero }: { numero: string }) {
  const values = code128BValues(numero);
  const bars: { x: number; w: number }[] = [];
  let x = 0;
  values.forEach((code) => {
    const pattern = CODE128_PATTERNS[code];
    pattern.split("").forEach((raw, index) => {
      const width = Number(raw);
      if (index % 2 === 0) bars.push({ x, w: width });
      x += width;
    });
  });
  const width = W - MH * 2;
  const module = width / x;

  return (
    <Svg width={width} height={36}>
      {bars.map((b, i) => (
        <Rect key={i} x={b.x * module} y={0} width={Math.max(b.w * module, 0.6)} height={36} fill={C.dark} />
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
          <Image src={LOGO_SRC} style={s.logo} />
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
          <View key={i} style={s.itemRow}>
            <Text style={s.itemText}>{qty} x{"\n"}{wrapTicketText(item.producto)}</Text>
          </View>
        ))}

        {/* Nota */}
        <View style={s.notaBlock}>
          <Text style={s.notaLabel}>NOTA:</Text>
          {pedido.mensaje ? (
            <Text style={{ fontSize: 12, fontFamily: "Helvetica-Bold", marginBottom: 4 }}>{pedido.mensaje}</Text>
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
          <View style={s.firmaBox}>
            <View style={s.firmaLine} />
            <Text style={s.firma}>Firma de entrega</Text>
          </View>
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
          <Text style={s.numSub}>{pedido.numero}</Text>
        </View>

      </Page>
    </Document>
  );
}
