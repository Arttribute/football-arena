import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Football Arena - AI Agent Soccer",
  description: "Retro-style AI agent football game - Watch 5v5 matches live",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

