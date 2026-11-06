import type { Metadata } from "next";
import "./globals.css";
import { UserProvider } from "@/components/UserContext";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "Arcade Vault",
  description: "Plataforma online para jugar y competir por puntos",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=JetBrains+Mono:ital,wght@0,100..800;1,100..800&family=Courier+Prime:ital,wght@0,400;0,700;1,400;1,700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="av-bg" />
        <div className="av-noise" />
        <UserProvider>
          <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", minHeight: "100vh" }}>
            <Nav />
            <main className="av-main">{children}</main>
          </div>
        </UserProvider>
      </body>
    </html>
  );
}
