'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { OFFICE_EMAIL_DOMAIN, createOfficeEmail } from '@/lib/app-config';

export default function CreateEmployeePage() {
  const [formData, setFormData] = useState({
    employeeId: '',
    name: '',
    email: '',
    phone: '',
    position: '',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const suggestedEmail = formData.name ? createOfficeEmail(formData.name) : `nama@${OFFICE_EMAIL_DOMAIN}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data: { error?: string } = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Gagal membuat pegawai');
        setIsLoading(false);
        return;
      }

      toast.success('Pegawai berhasil dibuat');
      router.push('/admin/employees');
    } catch (error) {
      toast.error('Terjadi kesalahan');
      setIsLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <Link href="/admin/employees" className="text-primary-600 hover:text-primary-700 text-sm mb-2 inline-block">
          &larr; Kembali ke Daftar Pegawai
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Tambah Pegawai Baru</h1>
      </div>

      <div className="bg-white rounded-xl shadow-md p-6 max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              NIP Pegawai
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={formData.employeeId}
              onChange={(e) => setFormData({ ...formData, employeeId: e.target.value.replace(/\D/g, '') })}
              className="input-field"
              placeholder="Opsional, isi NIP jika ada"
            />
            <p className="text-xs text-gray-500 mt-1">
              Boleh dikosongkan untuk pegawai kontrak yang belum memiliki NIP.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nama Lengkap *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input-field"
              placeholder="Masukkan nama lengkap"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Gmail
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="input-field"
              placeholder={suggestedEmail}
            />
            <p className="text-xs text-gray-500 mt-1">
              Kosongkan untuk auto-generate Gmail: {suggestedEmail}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password Default
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="input-field"
              placeholder="Opsional"
              minLength={6}
            />
            <p className="text-xs text-gray-500 mt-1">
              Kosongkan untuk memakai password default sistem. Pegawai bisa mengganti password dari dashboard masing-masing.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              No. Telepon
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="input-field"
              placeholder="08xxxxxxxxxx"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Jabatan
            </label>
            <input
              type="text"
              value={formData.position}
              onChange={(e) => setFormData({ ...formData, position: e.target.value })}
              className="input-field"
              placeholder="Software Engineer, Manager, dll"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => router.push('/admin/employees')}
              className="btn-secondary"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary"
            >
              {isLoading ? 'Memproses...' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
