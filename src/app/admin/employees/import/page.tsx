'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

interface ImportResult {
  success: number;
  failed: number;
  errors: Array<{ row: number; error: string }>;
}

export default function ImportEmployeesPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const validTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];

    if (!validTypes.includes(selectedFile.type) && !selectedFile.name.endsWith('.csv') && !selectedFile.name.endsWith('.xlsx')) {
      toast.error('File harus CSV atau XLSX');
      return;
    }

    setFile(selectedFile);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        setPreview(jsonData.slice(0, 5));
      } catch (error) {
        toast.error('Gagal membaca file');
      }
    };
    reader.readAsBinaryString(selectedFile);
  };

  const handleImport = async () => {
    if (!file) return;

    setIsLoading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/employees/import', {
        method: 'POST',
        body: formData,
      });

      const data: { error?: string; success?: number; failed?: number } = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Import gagal');
        setIsLoading(false);
        return;
      }

      const result: ImportResult = {
        success: data.success ?? 0,
        failed: data.failed ?? 0,
        errors: [],
      };
      setResult(result);
      toast.success(`Import berhasil! ${data.success} data diimport.`);

      if (data.failed && data.failed > 0) {
        toast.error(`${data.failed} data gagal diimport.`);
      }
    } catch (error) {
      toast.error('Terjadi kesalahan');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <Link href="/admin/employees" className="text-primary-600 hover:text-primary-700 text-sm mb-2 inline-block">
          &larr; Kembali ke Daftar Pegawai
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Import Pegawai dari CSV/XLSX</h1>
        <p className="text-gray-500">Upload file untuk import data pegawai secara massal</p>
      </div>

      {/* Template Download */}
      <div className="bg-white rounded-xl shadow-md p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Format File</h2>
        <p className="text-gray-600 mb-4">
          File harus memiliki kolom berikut:
        </p>
        <div className="bg-gray-50 rounded-lg p-4 font-mono text-sm overflow-x-auto">
          <p>employee_id, name, email, password, department, position, phone</p>
          <p className="text-gray-500 mt-2">Contoh:</p>
          <p>EMP-2024-0001, Budi Santoso, budi@contoh.com, password123, IT, Engineer, 081234567890</p>
          <p>EMP-2024-0002, Siti Rahayu, siti@contoh.com, , HRD, Manager, 081234567891</p>
        </div>
        <p className="text-sm text-gray-500 mt-4">
          * password opsional, jika kosong akan digenerate random
        </p>
      </div>

      {/* Upload */}
      <div className="bg-white rounded-xl shadow-md p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Upload File</h2>

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx"
          onChange={handleFileChange}
          className="hidden"
        />

        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-primary-500 hover:bg-primary-50 transition-colors"
        >
          {file ? (
            <div>
              <svg className="w-12 h-12 text-green-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-green-600 font-medium">{file.name}</p>
              <p className="text-gray-500 text-sm mt-1">{(file.size / 1024).toFixed(2)} KB</p>
            </div>
          ) : (
            <div>
              <svg className="w-12 h-12 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-gray-600">Klik untuk pilih file</p>
              <p className="text-gray-400 text-sm mt-1">CSV atau XLSX</p>
            </div>
          )}
        </div>
      </div>

      {/* Preview */}
      {preview.length > 0 && (
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Preview (5 data pertama)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  {Object.keys(preview[0] || {}).map((key) => (
                    <th key={key} className="pb-2 font-medium text-gray-600">{key}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, index) => (
                  <tr key={index} className="border-b">
                    {Object.values(row).map((value, i) => (
                      <td key={i} className="py-2">{String(value)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className={`rounded-xl shadow-md p-6 mb-6 ${result.failed > 0 ? 'bg-yellow-50' : 'bg-green-50'}`}>
          <h2 className="text-lg font-semibold mb-4">Hasil Import</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-lg p-4">
              <p className="text-sm text-gray-500">Berhasil</p>
              <p className="text-2xl font-bold text-green-600">{result.success}</p>
            </div>
            <div className="bg-white rounded-lg p-4">
              <p className="text-sm text-gray-500">Gagal</p>
              <p className="text-2xl font-bold text-red-600">{result.failed}</p>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="mt-4">
              <p className="font-medium text-red-600 mb-2">Error Details:</p>
              <div className="bg-white rounded-lg p-4 max-h-48 overflow-y-auto">
                {result.errors.map((err, i) => (
                  <p key={i} className="text-sm text-red-600">
                    Row {err.row}: {err.error}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Link href="/admin/employees" className="btn-secondary">
          Kembali
        </Link>
        {file && (
          <button
            onClick={handleImport}
            disabled={isLoading}
            className="btn-primary"
          >
            {isLoading ? 'Memproses...' : 'Import Sekarang'}
          </button>
        )}
      </div>
    </div>
  );
}
