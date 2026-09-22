import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WorldCraft",
  description: "Selbst gehostete Webapp für D&D-Gruppen",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="de">
      <body className="min-h-dvh bg-zinc-950 text-zinc-100 antialiased">
        {children}
      </body>
    </html>
  );
}
