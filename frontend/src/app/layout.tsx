import type { Metadata } from 'next';
import './globals.css';
import QueryProvider from '@/providers/QueryProvider';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  metadataBase: new URL('https://veloce.co.ke'),
  title: {
    default: 'Veloce | Premium East Africa eCommerce & Apparel',
    template: '%s | Veloce',
  },
  description:
    'Discover high-performance apparel, electronics, and lifestyle gear engineered for East Africa. Fast M-Pesa checkout, guaranteed quality, and express regional delivery.',
  keywords: [
    'eCommerce Kenya',
    'Veloce Apparel',
    'Online Shopping Nairobi',
    'M-Pesa STK Push Shop',
    'East Africa Shopping',
  ],
  openGraph: {
    title: 'Veloce | Premium East Africa eCommerce',
    description: 'High-performance apparel and electronics. Instant M-Pesa checkout.',
    url: 'https://veloce.co.ke',
    siteName: 'Veloce Hub',
    locale: 'en_KE',
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col justify-between bg-slate-50 text-slate-900 antialiased selection:bg-indigo-500 selection:text-white">
        <QueryProvider>
          <div>
            <Navbar />
            <main>{children}</main>
          </div>
          <Footer />
        </QueryProvider>
      </body>
    </html>
  );
}
