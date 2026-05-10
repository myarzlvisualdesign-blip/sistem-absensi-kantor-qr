'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';

export default function ReportsPage() {
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    name: '',
    employeeId: '',
    department: '',
    status: '',
  });

  const handleExport = async (format: 'csv' | 'xlsx') => {
    try {
      const params = new URLSearchParams({
        format,
        ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value)),
      });

      const response = await fetch(`/api/attendance/export?${params}`);
      if (!response.ok) {
        const data = await response.json() as { error?: string };
        toast.error(data.error || 'Export gagal');
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `laporan_absensi_${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`Export ${format.toUpperCase()} berhasil`);
    } catch {
      toast.error('Export gagal');
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Laporan Absensi</h1>
        <p className="text-gray-500">Filter dan export data absensi pegawai</p>
      </div>

      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Mulai</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(event) => setFilters({ ...filters, startDate: event.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Akhir</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(event) => setFilters({ ...filters, endDate: event.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nama Pegawai</label>
            <input
              type="text"
              value={filters.name}
              onChange={(event) => setFilters({ ...filters, name: event.target.value })}
              className="input-field"
              placeholder="Cari nama"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">NIP/Employee ID</label>
            <input
              type="text"
              value={filters.employeeId}
              onChange={(event) => setFilters({ ...filters, employeeId: event.target.value })}
              className="input-field"
              placeholder="EMP-2026-0001"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Departemen</label>
            <input
              type="text"
              value={filters.department}
              onChange={(event) => setFilters({ ...filters, department: event.target.value })}
              className="input-field"
              placeholder="IT, HRD, Marketing"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(event) => setFilters({ ...filters, status: event.target.value })}
              className="input-field"
            >
              <option value="">Semua</option>
              <option value="HADIR">HADIR</option>
              <option value="TERLAMBAT">TERLAMBAT</option>
            </select>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => handleExport('csv')}
            className="btn-secondary"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => handleExport('xlsx')}
            className="btn-primary"
          >
            Export XLSX
          </button>
          <button
            type="button"
            onClick={() => setFilters({ startDate: '', endDate: '', name: '', employeeId: '', department: '', status: '' })}
            className="btn-secondary"
          >
            Reset Filter
          </button>
        </div>
      </div>
    </div>
  );
}
