'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { formatEmployeeId } from '@/lib/utils';

interface Attendance {
  id: string;
  date: string;
  checkInTime: string;
  status: string;
  note: string | null;
  employee: {
    id: string;
    employeeId: string;
    name: string;
    email: string;
    department: string | null;
    position: string | null;
  };
}

export default function EditAttendancePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [attendance, setAttendance] = useState<Attendance | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    date: '',
    checkInTime: '',
    status: '',
    note: '',
  });
  const router = useRouter();

  useEffect(() => {
    const fetchAttendance = async () => {
      try {
        const res = await fetch(`/api/attendance/${id}`);
        if (!res.ok) {
          toast.error('Data tidak ditemukan');
          router.push('/admin/attendance');
          return;
        }
        const data: Attendance = await res.json();
        setAttendance(data);
        setFormData({
          date: data.date,
          checkInTime: new Date(data.checkInTime).toISOString().slice(0, 16),
          status: data.status,
          note: data.note || '',
        });
      } catch (error) {
        toast.error('Gagal mengambil data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAttendance();
  }, [id, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const res = await fetch(`/api/attendance/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json() as { error?: string };

      if (!res.ok) {
        toast.error(data.error || 'Gagal menyimpan');
        setIsSaving(false);
        return;
      }

      toast.success('Data berhasil disimpan');
      router.push('/admin/attendance');
    } catch (error) {
      toast.error('Terjadi kesalahan');
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

  if (!attendance) {
    return null;
  }

  return (
    <div>
      <div className="mb-8">
        <Link href="/admin/attendance" className="text-primary-600 hover:text-primary-700 text-sm mb-2 inline-block">
          &larr; Kembali ke Daftar Absensi
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Edit Absensi</h1>
        <p className="text-gray-500">{attendance.employee.name}</p>
      </div>

      <div className="bg-white rounded-xl shadow-md p-6 max-w-2xl">
        {/* Employee Info */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Nama</p>
              <p className="font-medium">{attendance.employee.name}</p>
            </div>
            <div>
              <p className="text-gray-500">NIP Pegawai</p>
              <p className="font-medium">{formatEmployeeId(attendance.employee.employeeId)}</p>
            </div>
            <div>
              <p className="text-gray-500">Email</p>
              <p className="font-medium">{attendance.employee.email}</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tanggal
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="input-field"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Jam Absen
              </label>
              <input
                type="datetime-local"
                value={formData.checkInTime}
                onChange={(e) => setFormData({ ...formData, checkInTime: e.target.value })}
                className="input-field"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="input-field"
              required
            >
              <option value="HADIR">Hadir</option>
              <option value="TERLAMBAT">Terlambat</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Catatan
            </label>
            <textarea
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              className="input-field"
              rows={3}
              placeholder="Opsional"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => router.push('/admin/attendance')}
              className="btn-secondary"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="btn-primary"
            >
              {isSaving ? 'Memproses...' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
