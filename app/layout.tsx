import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'DELTAWATCH | NASA–ISRO NISAR L2 GCOV Mission Control',
  description:
    "Next-Generation Polarimetric SAR Flood & Mangrove Inundation Intelligence for NASA Space Apps 2026 Challenge 'Dancing with the SARs'",
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased dark bg-[#030712]">
      <head>
        <link rel="stylesheet" href="/maplibre-gl.css" />
      </head>
      <body className="min-h-full flex flex-col bg-[#030712] text-white/90 selection:bg-cyan-500/30 selection:text-cyan-200 font-sans tracking-tight overflow-hidden">
        {children}
      </body>
    </html>
  );
}
