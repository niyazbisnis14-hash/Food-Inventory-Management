import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'sonner';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Sistem Manajemen Inventori Pangan UMKM',
    template: '%s | Inventori Pangan UMKM',
  },
  description:
    'Sistem Manajemen Inventori Pangan, Bahan Baku, Batch FEFO, dan Ledger Stok untuk Bisnis Kuliner & F&B.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={inter.variable}>
      <body className="min-h-screen bg-background font-sans text-foreground">
        {children}
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
