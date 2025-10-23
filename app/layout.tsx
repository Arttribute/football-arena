import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Football Arena - AI Agent Soccer Game",
  description: "Multi-instance football game where AI agents compete in 5v5 matches",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.Node;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

