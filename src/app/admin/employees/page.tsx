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
  phone: string | null;
  position: string | null;
  isActive: boolean;
  user: {
    email: string;
  };
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterActive, setFilterActive] = useState<string>('all');

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const res = await fetch('/api/employees');
      if (res.ok) {
        const data: Employee[] = await res.json();
        setEmployees(data);
      }
    } catch (error) {
      toast.error('Gagal mengambil data pegawai');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeactivate = async (id: string) => {
    if (!confirm('Nonaktifkan pegawai ini? Data pegawai dan riwayat absensi tetap disimpan.')) return;

    try {
      const res = await fetch(`/api/employees/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        toast.success('Pegawai berhasil dinonaktifkan');
        fetchEmployees();
      } else {
        const data: { error?: string } = await res.json();
        toast.error(data.error || 'Gagal menonaktifkan pegawai');
      }
    } catch (error) {
      toast.error('Terjadi kesalahan');
    }
  };

  const handleDeleteInactive = async (id: string) => {
    if (!confirm('Hapus permanen pegawai nonaktif ini? Data pegawai, akun login, dan riwayat absensinya akan dihapus.')) return;

    try {
      const res = await fetch(`/api/employees/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        toast.success('Pegawai nonaktif berhasil dihapus');
        fetchEmployees();
      } else {
        const data: { error?: string } = await res.json();
        toast.error(data.error || 'Gagal menghapus pegawai');
      }
    } catch (error) {
      toast.error('Terjadi kesalahan');
    }
  };

  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilter =
      filterActive === 'all' ||
      (filterActive === 'active' && emp.isActive) ||
      (filterActive === 'inactive' && !emp.isActive);

    return matchesSearch && matchesFilter;
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Data Pegawai</h1>
          <p className="text-gray-500">Kelola data pegawai ({employees.length} total)</p>
        </div>
        <div className="flex gap-3">
          <Link href="/admin/employees/import" className="btn-secondary">
            Import CSV/XLSX
          </Link>
          <Link href="/admin/employees/create" className="btn-primary">
            + Tambah Pegawai
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-md p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Cari nama, NIP, atau email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field"
            />
          </div>
          <select
            value={filterActive}
            onChange={(e) => setFilterActive(e.target.value)}
            className="input-field md:w-48"
          >
            <option value="all">Semua Status</option>
            <option value="active">Aktif</option>
            <option value="inactive">Tidak Aktif</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="spinner mx-auto"></div>
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            Tidak ada data pegawai
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    NIP Pegawai
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nama
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredEmployees.map((employee) => (
                  <tr key={employee.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatEmployeeId(employee.employeeId)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {employee.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {employee.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`badge ${employee.isActive ? 'badge-success' : 'badge-danger'}`}>
                        {employee.isActive ? 'Aktif' : 'Tidak Aktif'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <Link
                        href={`/admin/employees/${employee.id}`}
                        className="text-primary-600 hover:text-primary-900 mr-3"
                      >
                        Edit
                      </Link>
                      {employee.isActive ? (
                        <button
                          onClick={() => handleDeactivate(employee.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Nonaktifkan
                        </button>
                      ) : (
                        <button
                          onClick={() => handleDeleteInactive(employee.id)}
                          className="text-red-700 hover:text-red-950"
                        >
                          Hapus
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
