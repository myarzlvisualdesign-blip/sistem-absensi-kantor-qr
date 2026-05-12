import type { Metadata } from 'next';
import { Toaster } from 'react-hot-toast';
import { APP_FULL_NAME } from '@/lib/app-config';
import './globals.css';

export const metadata: Metadata = {
  title: APP_FULL_NAME,
  description: 'Sistem absensi office Lapas Pemuda Kelas IIA Madiun berbasis QR dan validasi lokasi.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className="min-h-screen bg-gray-50">
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff',
            },
            success: {
              iconTheme: {
                primary: '#10b981',
                secondary: '#fff',
              },
            },
            error: {
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
            },
          }}
        />
        {children}
      </body>
    </html>
  );
}
