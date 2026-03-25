import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HubSpot HTML Bulk Uploader",
  description: "Upload HTML files into HubSpot Design Manager as draft source-code files."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
