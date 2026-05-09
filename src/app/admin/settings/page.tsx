'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

interface Settings {
  id: string;
  workStartTime: string;
  lateLimitTime: string;
  companyName: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    workStartTime: '08:00',
    lateLimitTime: '08:15',
    companyName: '',
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
        setFormData({
          workStartTime: data.workStartTime,
          lateLimitTime: data.lateLimitTime,
          companyName: data.companyName,
        });
      }
    } catch (error) {
      toast.error('Gagal mengambil pengaturan');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Gagal menyimpan');
        setIsSaving(false);
        return;
      }

      toast.success('Pengaturan berhasil disimpan');
    } catch (error) {
      toast.error('Terjadi kesalahan');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Pengaturan</h1>
        <p className="text-gray-500">Kelola pengaturan aplikasi</p>
      </div>

      <div className="bg-white rounded-xl shadow-md p-6 max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nama Perusahaan
            </label>
            <input
              type="text"
              value={formData.companyName}
              onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
              className="input-field"
              placeholder="PT. Contoh Indonesia"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Jam Masuk
              </label>
              <input
                type="time"
                value={formData.workStartTime}
                onChange={(e) => setFormData({ ...formData, workStartTime: e.target.value })}
                className="input-field"
              />
              <p className="text-xs text-gray-500 mt-1">
                Jam mulai kerja normal
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Batas Telat
              </label>
              <input
                type="time"
                value={formData.lateLimitTime}
                onChange={(e) => setFormData({ ...formData, lateLimitTime: e.target.value })}
                className="input-field"
              />
              <p className="text-xs text-gray-500 mt-1">
                Absen setelah jam ini = TERLAMBAT
              </p>
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="font-medium text-yellow-800 mb-2">Informasi:</h3>
            <ul className="text-sm text-yellow-700 space-y-1">
              <li>• Absen sebelum atau tepat {formData.lateLimitTime} = <span className="font-medium">HADIR</span></li>
              <li>• Absen setelah {formData.lateLimitTime} = <span className="font-medium">TERLAMBAT</span></li>
            </ul>
          </div>

          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={isSaving}
              className="btn-primary"
            >
              {isSaving ? 'Memproses...' : 'Simpan Pengaturan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
