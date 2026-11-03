import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { ProveedorSesion } from "@/lib/sesion";
import "./globals.css";

export const metadata: Metadata = {
  title: "Consulting Laboral Costa Rica",
  description: "Asesoría, investigación, cálculos y documentos en derecho laboral costarricense.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1f3a5f",
};

export default function Raiz({ children }: { children: ReactNode }) {
  return (
    <html lang="es-CR">
      <body>
        <ProveedorSesion>{children}</ProveedorSesion>
      </body>
    </html>
  );
}
