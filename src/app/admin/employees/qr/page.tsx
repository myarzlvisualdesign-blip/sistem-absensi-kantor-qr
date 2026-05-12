'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { formatEmployeeId } from '@/lib/utils';

interface Employee {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  qrToken: string;
  qrImage?: string;
}

export default function QRCodesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const res = await fetch('/api/employees');
      if (res.ok) {
        const data: Employee[] = await res.json();
        setEmployees(data);
        // Generate QR codes
        for (const emp of data) {
          const qrImage = await generateQRCode(emp.qrToken);
          setEmployees((prev) =>
            prev.map((e) => (e.id === emp.id ? { ...e, qrImage } : e))
          );
        }
      }
    } catch (error) {
      toast.error('Gagal mengambil data');
    } finally {
      setIsLoading(false);
    }
  };

  const generateQRCode = async (token: string): Promise<string> => {
    try {
      const QRCode = (await import('qrcode')).default;
      return await QRCode.toDataURL(token, {
        width: 150,
        margin: 1,
      });
    } catch (error) {
      return '';
    }
  };

  const handleDownloadQR = (employee: Employee) => {
    if (!employee.qrImage) return;

    const nip = formatEmployeeId(employee.employeeId);
    const identifier = nip === '-' ? employee.id : nip;
    const link = document.createElement('a');
    link.download = `QR_${identifier}_${employee.name.replace(/\s/g, '_')}.png`;
    link.href = employee.qrImage;
    link.click();
  };

  const handleDownloadAll = async () => {
    const employeesWithQR = employees.filter((e) => e.qrImage);

    for (const emp of employeesWithQR) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      handleDownloadQR(emp);
    }

    toast.success(`Mendownload ${employeesWithQR.length} QR Code`);
  };

  const filteredEmployees = employees.filter((emp) =>
    emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    formatEmployeeId(emp.employeeId).toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <Link href="/admin/employees" className="text-primary-600 hover:text-primary-700 text-sm mb-2 inline-block">
            &larr; Kembali ke Daftar Pegawai
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">QR Codes Pegawai</h1>
          <p className="text-gray-500">Download QR Code untuk setiap pegawai</p>
        </div>
        <button
          onClick={handleDownloadAll}
          disabled={employees.length === 0}
          className="btn-primary"
        >
          Download Semua
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-md p-4 mb-6">
        <input
          type="text"
          placeholder="Cari nama atau NIP pegawai..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="input-field"
        />
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="spinner mx-auto"></div>
          <p className="text-gray-500 mt-4">Memuat QR Codes...</p>
        </div>
      ) : filteredEmployees.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          Tidak ada data pegawai
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredEmployees.map((employee) => (
            <div key={employee.id} className="bg-white rounded-xl shadow-md p-6">
              <div className="text-center mb-4">
                {employee.qrImage ? (
                  <img
                    src={employee.qrImage}
                    alt={`QR ${employee.name}`}
                    className="mx-auto"
                  />
                ) : (
                  <div className="w-32 h-32 bg-gray-200 mx-auto flex items-center justify-center rounded-lg">
                    <div className="spinner"></div>
                  </div>
                )}
              </div>
              <div className="text-center">
                <h3 className="font-semibold text-gray-900">{employee.name}</h3>
                <p className="text-sm text-gray-500">NIP: {formatEmployeeId(employee.employeeId)}</p>
                <p className="text-xs text-gray-400">{employee.email}</p>
              </div>
              <button
                onClick={() => handleDownloadQR(employee)}
                disabled={!employee.qrImage}
                className="btn-primary w-full mt-4"
              >
                Download
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
