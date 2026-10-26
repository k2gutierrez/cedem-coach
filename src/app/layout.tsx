import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "CEDEM Coach",
  description: "Plataforma de coaches de CEDEM",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
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
