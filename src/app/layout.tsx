import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Impress — Gestión de Pedidos",
  description: "Sistema de toma de pedidos Impress",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
