'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { formatDate } from '@/lib/utils';

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

export default function AttendancePage() {
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    name: '',
    employeeId: '',
    department: '',
    status: '',
  });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchAttendances();
  }, [filters, page]);

  const fetchAttendances = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        ...Object.fromEntries(
          Object.entries(filters).filter(([, v]) => v)
        ),
      });

      const res = await fetch(`/api/attendance?${params}`);
      if (res.ok) {
        const data = await res.json() as { attendances: Attendance[]; totalPages: number };
        setAttendances(data.attendances);
        setTotalPages(data.totalPages);
      }
    } catch (error) {
      toast.error('Gagal mengambil data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async (format: 'csv' | 'xlsx') => {
    try {
      const params = new URLSearchParams({
        format,
        ...Object.fromEntries(
          Object.entries(filters).filter(([, v]) => v)
        ),
      });

      const res = await fetch(`/api/attendance/export?${params}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `absensi_${new Date().toISOString().split('T')[0]}.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success('Export berhasil');
      }
    } catch (error) {
      toast.error('Export gagal');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus data absensi ini?')) return;

    try {
      const res = await fetch(`/api/attendance/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        toast.error(data.error || 'Gagal menghapus data');
        return;
      }
      toast.success('Data absensi dihapus');
      fetchAttendances();
    } catch {
      toast.error('Gagal menghapus data');
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Data Absensi</h1>
          <p className="text-gray-500">Kelola data absensi pegawai</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => handleExport('csv')} className="btn-secondary">
            Export CSV
          </button>
          <button onClick={() => handleExport('xlsx')} className="btn-primary">
            Export XLSX
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-md p-4 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Tanggal Mulai</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              className="input-field text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Tanggal Akhir</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              className="input-field text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Nama</label>
            <input
              type="text"
              placeholder="Cari nama..."
              value={filters.name}
              onChange={(e) => setFilters({ ...filters, name: e.target.value })}
              className="input-field text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">NIP/ID</label>
            <input
              type="text"
              placeholder="EMP-..."
              value={filters.employeeId}
              onChange={(e) => setFilters({ ...filters, employeeId: e.target.value })}
              className="input-field text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Departemen</label>
            <input
              type="text"
              placeholder="Departemen..."
              value={filters.department}
              onChange={(e) => setFilters({ ...filters, department: e.target.value })}
              className="input-field text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="input-field text-sm"
            >
              <option value="">Semua</option>
              <option value="HADIR">Hadir</option>
              <option value="TERLAMBAT">Terlambat</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => setFilters({ startDate: '', endDate: '', name: '', employeeId: '', department: '', status: '' })}
              className="btn-secondary text-sm"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="spinner mx-auto"></div>
          </div>
        ) : attendances.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            Tidak ada data absensi
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tanggal</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nama</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dept</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Jam</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {attendances.map((attendance) => (
                    <tr key={attendance.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm">{formatDate(attendance.date)}</td>
                      <td className="px-6 py-4 text-sm font-medium">{attendance.employee.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{attendance.employee.employeeId}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{attendance.employee.department || '-'}</td>
                      <td className="px-6 py-4 text-sm">{new Date(attendance.checkInTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</td>
                      <td className="px-6 py-4">
                        <span className={`badge ${attendance.status === 'HADIR' ? 'badge-success' : 'badge-danger'}`}>
                          {attendance.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <Link href={`/admin/attendance/${attendance.id}`} className="text-primary-600 hover:text-primary-900">
                          Edit
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDelete(attendance.id)}
                          className="ml-3 text-red-600 hover:text-red-900"
                        >
                          Hapus
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-6 py-4 border-t flex justify-between items-center">
              <p className="text-sm text-gray-500">
                Halaman {page} dari {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="btn-secondary text-sm"
                >
                  Prev
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="btn-secondary text-sm"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
