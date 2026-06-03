import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "proyecto KJP",
  description: "Costes, ventas y margen por proyecto conectados con Holded y Supabase."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
