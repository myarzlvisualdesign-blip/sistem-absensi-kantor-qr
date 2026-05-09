'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface Employee {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  phone: string | null;
  department: string | null;
  position: string | null;
  qrToken: string;
  isActive: boolean;
  user: {
    email: string;
    isActive: boolean;
  };
}

export default function EditEmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    department: '',
    position: '',
    isActive: true,
    regenerateQr: false,
  });
  const [qrImage, setQrImage] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchEmployee = async () => {
      try {
        const res = await fetch(`/api/employees/${id}`);
        if (!res.ok) {
          toast.error('Pegawai tidak ditemukan');
          router.push('/admin/employees');
          return;
        }
        const data = await res.json();
        setEmployee(data);
        setFormData({
          name: data.name,
          phone: data.phone || '',
          department: data.department || '',
          position: data.position || '',
          isActive: data.isActive,
          regenerateQr: false,
        });
      } catch (error) {
        toast.error('Gagal mengambil data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchEmployee();
  }, [id, router]);

  useEffect(() => {
    if (employee?.qrToken) {
      generateQRCode(employee.qrToken);
    }
  }, [employee]);

  const generateQRCode = async (token: string) => {
    try {
      const QRCode = (await import('qrcode')).default;
      const dataUrl = await QRCode.toDataURL(token, {
        width: 200,
        margin: 2,
      });
      setQrImage(dataUrl);
    } catch (error) {
      console.error('Error generating QR:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const res = await fetch(`/api/employees/${id}`, {
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

      toast.success('Data berhasil disimpan');
      if (formData.regenerateQr) {
        setEmployee({ ...employee!, qrToken: data.employee.qrToken, ...formData });
      }
      setIsSaving(false);
    } catch (error) {
      toast.error('Terjadi kesalahan');
      setIsSaving(false);
    }
  };

  const handleDownloadQR = () => {
    if (!qrImage || !employee) return;

    const link = document.createElement('a');
    link.download = `QR_${employee.employeeId}.png`;
    link.href = qrImage;
    link.click();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!employee) {
    return null;
  }

  return (
    <div>
      <div className="mb-8">
        <Link href="/admin/employees" className="text-primary-600 hover:text-primary-700 text-sm mb-2 inline-block">
          &larr; Kembali ke Daftar Pegawai
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Edit Pegawai</h1>
        <p className="text-gray-500">ID: {employee.employeeId}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-md p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nama Lengkap
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input-field"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={employee.email}
                    className="input-field bg-gray-100"
                    disabled
                  />
                  <p className="text-xs text-gray-500 mt-1">Email tidak bisa diubah</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    No. Telepon
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Departemen
                  </label>
                  <input
                    type="text"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="input-field"
                  />
                </div>
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
                />
              </div>

              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Pegawai Aktif</span>
                </label>
              </div>

              <div className="border-t pt-6">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.regenerateQr}
                    onChange={(e) => setFormData({ ...formData, regenerateQr: e.target.checked })}
                    className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    Regenerate QR Code (QR lama akan tidak valid)
                  </span>
                </label>
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
                  disabled={isSaving}
                  className="btn-primary"
                >
                  {isSaving ? 'Memproses...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* QR Code */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">QR Code Pegawai</h3>

            {qrImage && (
              <div className="text-center">
                <img src={qrImage} alt="QR Code" className="mx-auto mb-4" />
                <p className="text-xs text-gray-500 mb-4 break-all">
                  Token: {employee.qrToken}
                </p>
                <button
                  onClick={handleDownloadQR}
                  className="btn-primary w-full"
                >
                  Download QR
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
