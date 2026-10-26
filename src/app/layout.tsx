import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Toaster } from "sonner";
import "./globals.css";

export const PROGRAMA = "Máster en Innovación y Emprendimiento en el Negocio Familiar";

export const metadata: Metadata = {
  title: `CEDEM Coach · ${PROGRAMA}`,
  description: `Plataforma de coaches de CEDEM · ${PROGRAMA} con Euncet Business School`,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full">
        {children}
        <Toaster
          position="top-center"
          richColors
          closeButton
          toastOptions={{ style: { fontSize: "17px", padding: "14px 18px" } }}
        />
      </body>
    </html>
  );
}
