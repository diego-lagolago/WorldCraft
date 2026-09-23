import type { Metadata, Viewport } from "next";
import { AppVersion } from "@/components/app-version";
import "./globals.css";

export const metadata: Metadata = {
  title: "WorldCraft",
  description: "Selbst gehostete Webapp für D&D-Gruppen",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0b0b0f",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="de">
      <body className="min-h-dvh antialiased">
        {children}
        <AppVersion />
      </body>
    </html>
  );
}
