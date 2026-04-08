import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BRND Direct Portal",
  description: "Wholesale B2B marketplace — BRND Direct",
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
