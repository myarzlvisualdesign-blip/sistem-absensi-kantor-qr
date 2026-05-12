'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { APP_LOGO_PATH, APP_NAME, APP_ORGANIZATION, APP_SECONDARY_LOGO_PATH } from '@/lib/app-config';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const hasSecondaryLogo = APP_SECONDARY_LOGO_PATH !== APP_LOGO_PATH;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data: { error?: string; redirectUrl?: string } = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Login gagal');
        setIsLoading(false);
        return;
      }

      toast.success('Login berhasil!');
      router.push(data.redirectUrl || '/');
      router.refresh();
    } catch (error) {
      toast.error('Terjadi kesalahan');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-700 via-primary-700 to-yellow-600 px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <div className="mb-4 flex justify-center gap-3">
              <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-md border border-gray-100">
                <img src={APP_LOGO_PATH} alt="Logo Lapas" className="h-20 w-20 object-contain" />
              </div>
              {hasSecondaryLogo && (
                <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-md border border-gray-100">
                  <img src={APP_SECONDARY_LOGO_PATH} alt="Logo Pemasyarakatan" className="h-20 w-20 object-contain" />
                </div>
              )}
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{APP_NAME}</h1>
            <p className="text-gray-500 mt-2">{APP_ORGANIZATION}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="nama@gmail.com"
                required
                disabled={isLoading}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="••••••••"
                required
                disabled={isLoading}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full py-3 text-lg"
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Memproses...
                </span>
              ) : (
                'Masuk'
              )}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}
