import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';
import { getTodayString } from '@/lib/utils';
import Link from 'next/link';

export default async function AdminDashboardPage() {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    redirect('/login');
  }

  const today = getTodayString();

  // Get statistics
  const totalEmployees = await prisma.employee.count({
    where: { isActive: true },
  });

  const hadirToday = await prisma.attendance.count({
    where: {
      date: today,
      status: 'HADIR',
    },
  });

  const terlambatToday = await prisma.attendance.count({
    where: {
      date: today,
      status: 'TERLAMBAT',
    },
  });

  const belumAbsenToday = totalEmployees - hadirToday - terlambatToday;

  // Get recent attendance
  const recentAttendances = await prisma.attendance.findMany({
    take: 10,
    orderBy: { checkInTime: 'desc' },
    include: {
      employee: true,
    },
  });

  // Get office settings
  const settings = await prisma.officeSetting.findFirst();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500">Selamat datang, {session.name}</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Pegawai Aktif"
          value={totalEmployees}
          icon="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
          color="blue"
        />
        <StatCard
          title="Hadir Hari Ini"
          value={hadirToday}
          icon="M5 13l4 4L19 7"
          color="green"
        />
        <StatCard
          title="Terlambat Hari Ini"
          value={terlambatToday}
          icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          color="red"
        />
        <StatCard
          title="Belum Absen"
          value={belumAbsenToday}
          icon="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          color="yellow"
        />
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow-md p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Aksi Cepat</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link
            href="/admin/employees/create"
            className="flex flex-col items-center p-4 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
          >
            <svg className="w-8 h-8 text-primary-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            <span className="text-sm font-medium text-gray-700">Tambah Pegawai</span>
          </Link>
          <Link
            href="/admin/employees/import"
            className="flex flex-col items-center p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
          >
            <svg className="w-8 h-8 text-green-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <span className="text-sm font-medium text-gray-700">Import CSV</span>
          </Link>
          <Link
            href="/admin/employees/qr"
            className="flex flex-col items-center p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
          >
            <svg className="w-8 h-8 text-purple-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
            <span className="text-sm font-medium text-gray-700">Lihat QR Codes</span>
          </Link>
          <Link
            href="/admin/attendance"
            className="flex flex-col items-center p-4 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors"
          >
            <svg className="w-8 h-8 text-orange-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-sm font-medium text-gray-700">Export Laporan</span>
          </Link>
        </div>
      </div>

      {/* Recent Attendance */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Absensi Terbaru</h2>
          <Link href="/admin/attendance" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
            Lihat Semua
          </Link>
        </div>

        {recentAttendances.length === 0 ? (
          <p className="text-gray-500 text-center py-8">Belum ada data absensi</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500 border-b">
                  <th className="pb-3 font-medium">Nama</th>
                  <th className="pb-3 font-medium">ID Pegawai</th>
                  <th className="pb-3 font-medium">Jam Masuk</th>
                  <th className="pb-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentAttendances.map((attendance) => (
                  <tr key={attendance.id} className="border-b last:border-0">
                    <td className="py-3">{attendance.employee.name}</td>
                    <td className="py-3 text-gray-500">{attendance.employee.employeeId}</td>
                    <td className="py-3">
                      {new Date(attendance.checkInTime).toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-3">
                      <span className={`badge ${attendance.status === 'HADIR' ? 'badge-success' : 'badge-danger'}`}>
                        {attendance.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Office Settings Info */}
      <div className="bg-white rounded-xl shadow-md p-6 mt-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Pengaturan Kantor</h2>
          <Link href="/admin/settings" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
            Edit
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500">Jam Masuk</p>
            <p className="text-lg font-semibold">{settings?.workStartTime || '08:00'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Batas Telat</p>
            <p className="text-lg font-semibold">{settings?.lateLimitTime || '08:15'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color }: {
  title: string;
  value: number;
  icon: string;
  color: 'blue' | 'green' | 'red' | 'yellow';
}) {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    red: 'bg-red-100 text-red-600',
    yellow: 'bg-yellow-100 text-yellow-600',
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${colorClasses[color]}`}>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
          </svg>
        </div>
      </div>
    </div>
  );
}
