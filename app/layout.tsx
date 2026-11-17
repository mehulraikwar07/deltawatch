import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'DELTAWATCH | NISAR L-band Flood Change Viewer',
  description:
    "Before/after NISAR L-band radar change viewer for two Indian river deltas, built for the NASA Space Apps 2026 challenge 'Dancing with the SARs'",
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
