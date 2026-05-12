'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { NotFoundException } from '@zxing/library';
import { APP_LOGO_PATH, APP_NAME, APP_ORGANIZATION, APP_SECONDARY_LOGO_PATH, OFFICE_LOCATION, calculateDistanceMeters } from '@/lib/app-config';
import { formatDate, formatTime, formatEmployeeId } from '@/lib/utils';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  employeeId?: string;
  employeeCode?: string;
}

interface AttendanceStatus {
  status: 'BELUM_ABSEN' | 'HADIR' | 'TERLAMBAT';
  checkInTime?: string;
  message?: string;
}

interface UserReport {
  month: string;
  hadir: number;
  terlambat: number;
  alpha: number;
  totalRecorded: number;
  qrToken?: string | null;
  attendances: Array<{
    id: string;
    date: string;
    checkInTime: string;
    status: 'HADIR' | 'TERLAMBAT';
    note: string | null;
  }>;
}

export default function UserAbsenPage() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [attendanceStatus, setAttendanceStatus] = useState<AttendanceStatus | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [report, setReport] = useState<UserReport | null>(null);
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const router = useRouter();
  const hasSecondaryLogo = APP_SECONDARY_LOGO_PATH !== APP_LOGO_PATH;

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/session');
      if (!res.ok) {
        router.push('/login');
        return;
      }
      const data: { user: User } = await res.json();
      if (data.user.role !== 'USER') {
        router.push('/admin/dashboard');
        return;
      }
      setUser(data.user);
    } catch (error) {
      router.push('/login');
    }
  }, [router]);

  const fetchAttendanceStatus = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch('/api/attendance/today');
      if (res.ok) {
        const data: AttendanceStatus = await res.json();
        setAttendanceStatus(data);
      }
    } catch (error) {
      console.error('Error fetching attendance:', error);
    }
  }, [user]);

  const fetchReport = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch('/api/user/report');
      if (res.ok) {
        const data: UserReport = await res.json();
        setReport(data);
      }
    } catch (error) {
      console.error('Error fetching report:', error);
    }
  }, [user]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  useEffect(() => {
    if (user) {
      fetchAttendanceStatus();
      fetchReport();
    }
  }, [user, fetchAttendanceStatus, fetchReport]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setIsLoading(false);
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch (error) {
      toast.error('Logout gagal');
    }
  };

  const readCurrentLocation = () => new Promise<GeolocationPosition>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Browser tidak mendukung lokasi'));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 0,
    });
  });

  const handleOpenScanner = async () => {
    try {
      const position = await readCurrentLocation();
      const distance = calculateDistanceMeters(position.coords.latitude, position.coords.longitude);
      if (distance > OFFICE_LOCATION.radiusMeters) {
        toast.error('JARAK KAMU TERLALU JAUH DARI OFFICE!');
        return;
      }
      setShowScanner(true);
    } catch {
      toast.error('Aktifkan izin lokasi untuk absen.');
    }
  };

  const handleCloseScanner = () => {
    setShowScanner(false);
  };

  const handleScan = async (result: string) => {
    if (!user || isSubmitting) return;

    setIsSubmitting(true);
    setShowScanner(false);

    try {
      const position = await readCurrentLocation();
      const distance = calculateDistanceMeters(position.coords.latitude, position.coords.longitude);
      if (distance > OFFICE_LOCATION.radiusMeters) {
        toast.error('JARAK KAMU TERLALU JAUH DARI OFFICE!');
        setIsSubmitting(false);
        return;
      }

      const res = await fetch('/api/attendance/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scannedToken: result,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        }),
      });

      const data: { error?: string; status?: string } = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Absen gagal');
      } else {
        toast.success(data.status === 'TERLAMBAT'
          ? 'Absen berhasil! Status: TERLAMBAT'
          : 'Absen berhasil! Status: HADIR'
        );
        await fetchAttendanceStatus();
        await fetchReport();
      }
    } catch {
      toast.error('Aktifkan izin lokasi untuk absen.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsChangingPassword(true);

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(passwordForm),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) {
        toast.error(data.error || 'Gagal mengganti password');
        return;
      }
      toast.success('Password berhasil diganti');
      setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
    } catch {
      toast.error('Gagal mengganti password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleDownloadAttendanceCard = async () => {
    if (!user) return;

    try {
      let activeReport = report;
      if (!activeReport?.qrToken) {
        const res = await fetch('/api/user/report');
        if (res.ok) {
          activeReport = await res.json() as UserReport;
          setReport(activeReport);
        }
      }

      if (!activeReport?.qrToken) {
        toast.error('QR absensi pegawai belum tersedia');
        return;
      }

      const QRCode = (await import('qrcode')).default;
      const qrDataUrl = await QRCode.toDataURL(activeReport.qrToken, {
        width: 280,
        margin: 2,
        color: {
          dark: '#111827',
          light: '#ffffff',
        },
      });

      const canvas = document.createElement('canvas');
      canvas.width = 1080;
      canvas.height = 760;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, '#047857');
      gradient.addColorStop(0.55, '#2563eb');
      gradient.addColorStop(1, '#ca8a04');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = 'rgba(255,255,255,0.94)';
      roundRect(ctx, 54, 54, 972, 652, 34);
      ctx.fill();

      ctx.fillStyle = '#f8fafc';
      roundRect(ctx, 86, 86, 908, 178, 26);
      ctx.fill();

      const logo = await loadImage(APP_LOGO_PATH);
      const secondaryLogo = hasSecondaryLogo ? await loadImage(APP_SECONDARY_LOGO_PATH) : null;
      const qrImage = await loadImage(qrDataUrl);
      ctx.fillStyle = '#ffffff';
      roundRect(ctx, 112, 108, hasSecondaryLogo ? 104 : 124, hasSecondaryLogo ? 104 : 124, hasSecondaryLogo ? 52 : 62);
      ctx.fill();
      ctx.drawImage(logo, hasSecondaryLogo ? 126 : 124, hasSecondaryLogo ? 122 : 116, hasSecondaryLogo ? 76 : 100, hasSecondaryLogo ? 76 : 100);
      if (secondaryLogo) {
        ctx.fillStyle = '#ffffff';
        roundRect(ctx, 228, 108, 104, 104, 52);
        ctx.fill();
        ctx.drawImage(secondaryLogo, 240, 120, 80, 80);
      }

      const headerTextX = hasSecondaryLogo ? 360 : 280;
      ctx.fillStyle = '#111827';
      ctx.font = '700 46px Inter, Arial, sans-serif';
      ctx.fillText(APP_NAME, headerTextX, 152);
      ctx.font = '600 28px Inter, Arial, sans-serif';
      ctx.fillStyle = '#047857';
      ctx.fillText(APP_ORGANIZATION, headerTextX, 196);
      ctx.font = '500 22px Inter, Arial, sans-serif';
      ctx.fillStyle = '#64748b';
      ctx.fillText('Kartu Absensi Pegawai', headerTextX, 232);

      ctx.fillStyle = '#111827';
      ctx.font = '700 40px Inter, Arial, sans-serif';
      ctx.fillText(user.name, 112, 340);

      const infoRows = [
        ['NIP Pegawai', formatEmployeeId(user.employeeCode)],
        ['Email', user.email],
        ['Periode', activeReport.month || new Date().toISOString().slice(0, 7)],
        ['Dicetak', new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })],
      ];

      ctx.font = '500 22px Inter, Arial, sans-serif';
      infoRows.forEach(([label, value], index) => {
        const y = 388 + index * 44;
        ctx.fillStyle = '#64748b';
        ctx.fillText(label, 112, y);
        ctx.fillStyle = '#111827';
        ctx.fillText(value, 288, y);
      });

      ctx.fillStyle = '#ffffff';
      roundRect(ctx, 720, 306, 260, 324, 28);
      ctx.fill();
      ctx.fillStyle = '#f8fafc';
      roundRect(ctx, 746, 326, 208, 208, 20);
      ctx.fill();
      ctx.drawImage(qrImage, 760, 340, 180, 180);
      ctx.fillStyle = '#111827';
      ctx.font = '700 24px Inter, Arial, sans-serif';
      ctx.fillText('Scan QR Absensi', 760, 572);
      ctx.fillStyle = '#64748b';
      ctx.font = '500 18px Inter, Arial, sans-serif';
      ctx.fillText('Token pribadi pegawai', 760, 602);

      drawStatBox(ctx, 112, 574, 'Hadir', activeReport.hadir ?? 0, '#16a34a');
      drawStatBox(ctx, 286, 574, 'Terlambat', activeReport.terlambat ?? 0, '#ca8a04');
      drawStatBox(ctx, 460, 574, 'Alpha', activeReport.alpha ?? 0, '#dc2626');

      ctx.fillStyle = '#64748b';
      ctx.font = '500 18px Inter, Arial, sans-serif';
      ctx.fillText(`Validasi lokasi office radius ${OFFICE_LOCATION.radiusMeters} meter`, 112, 682);

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png', 1));
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const nip = formatEmployeeId(user.employeeCode);
      link.download = `kartu-absensi-${(nip === '-' ? user.name : nip).replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success('Kartu absensi berhasil didownload');
    } catch {
      toast.error('Gagal membuat kartu absensi');
    }
  };

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-700 via-primary-700 to-yellow-600">
      {/* Header */}
      <header className="bg-white/10 backdrop-blur-sm text-white py-4 px-6">
        <div className="max-w-lg mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              <div className="h-12 w-12 rounded-full bg-white p-1 ring-2 ring-white/20">
                <img src={APP_LOGO_PATH} alt="Logo Lapas" className="h-full w-full object-contain" />
              </div>
              {hasSecondaryLogo && (
                <div className="h-12 w-12 rounded-full bg-white p-1 ring-2 ring-white/20">
                  <img src={APP_SECONDARY_LOGO_PATH} alt="Logo Pemasyarakatan" className="h-full w-full object-contain" />
                </div>
              )}
            </div>
            <div>
              <h1 className="font-bold text-lg">{APP_NAME}</h1>
              <p className="text-sm text-white/80">{user.name}</p>
              {user.employeeCode && (
                <p className="text-xs text-white/70">{user.employeeCode}</p>
              )}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-lg mx-auto p-6">
        {/* Date & Time Card */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="text-center">
            <p className="text-gray-500 text-sm mb-1">{formatDate(currentTime)}</p>
            <p className="text-4xl font-bold text-gray-900 mb-2">
              {formatTime(currentTime)}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-5 mb-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">Lokasi Absensi</p>
          <h2 className="mt-1 font-semibold text-gray-900">{APP_ORGANIZATION}</h2>
          <p className="mt-2 text-sm text-gray-500">
            Scan QR hanya valid dalam radius {OFFICE_LOCATION.radiusMeters} meter dari titik office.
          </p>
        </div>

        {/* Attendance Status Card */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Status Absensi Hari Ini</h2>

          {attendanceStatus?.status === 'BELUM_ABSEN' ? (
            <div className="text-center py-4">
              <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-yellow-600 font-semibold text-lg mb-2">Belum Absen</p>
              <p className="text-gray-500 text-sm">Silakan absen dengan scan QR code</p>
            </div>
          ) : attendanceStatus?.status === 'HADIR' ? (
            <div className="text-center py-4">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-green-600 font-semibold text-lg mb-2">Hadir</p>
              <p className="text-gray-500 text-sm">
                Jam Masuk: {attendanceStatus.checkInTime && formatTime(attendanceStatus.checkInTime)}
              </p>
            </div>
          ) : attendanceStatus?.status === 'TERLAMBAT' ? (
            <div className="text-center py-4">
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-red-600 font-semibold text-lg mb-2">Terlambat</p>
              <p className="text-gray-500 text-sm">
                Jam Masuk: {attendanceStatus.checkInTime && formatTime(attendanceStatus.checkInTime)}
              </p>
            </div>
          ) : (
            <div className="text-center py-4">
              <div className="spinner mx-auto"></div>
            </div>
          )}
        </div>

        {/* Absen Button */}
        {attendanceStatus?.status === 'BELUM_ABSEN' && (
          <button
            onClick={handleOpenScanner}
            disabled={isSubmitting}
            className="w-full bg-primary-600 hover:bg-primary-700 text-white text-xl font-bold py-6 rounded-2xl shadow-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:transform-none"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-6 w-6 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Memproses...
              </span>
            ) : (
              'ABSEN SEKARANG'
            )}
          </button>
        )}

        {attendanceStatus?.status !== 'BELUM_ABSEN' && (
          <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 text-center text-white">
            <p className="font-medium">Anda sudah absen untuk hari ini</p>
          </div>
        )}

        <div className="mt-6 bg-white rounded-2xl shadow-xl p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">Laporan Bulan Ini</h2>
              <p className="text-sm text-gray-500">Ringkasan hadir, terlambat, dan alpha akun Anda.</p>
            </div>
            <button
              type="button"
              onClick={handleDownloadAttendanceCard}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16" />
              </svg>
              Download Kartu
            </button>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <ReportCard label="Hadir" value={report?.hadir ?? 0} tone="green" />
            <ReportCard label="Terlambat" value={report?.terlambat ?? 0} tone="yellow" />
            <ReportCard label="Alpha" value={report?.alpha ?? 0} tone="red" />
          </div>
          <div className="mt-4 divide-y divide-gray-100">
            {(report?.attendances || []).slice(0, 5).map((attendance) => (
              <div key={attendance.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <p className="font-medium text-gray-900">{formatDate(attendance.date)}</p>
                  <p className="text-gray-500">{formatTime(attendance.checkInTime)}</p>
                </div>
                <span className={`badge ${attendance.status === 'HADIR' ? 'badge-success' : 'badge-danger'}`}>
                  {attendance.status}
                </span>
              </div>
            ))}
            {report && report.attendances.length === 0 && (
              <p className="py-4 text-center text-sm text-gray-500">Belum ada riwayat absensi bulan ini.</p>
            )}
          </div>
        </div>

        <div className="mt-6 bg-white rounded-2xl shadow-xl p-6">
          <h2 className="text-lg font-semibold text-gray-800">Ganti Password</h2>
          <form onSubmit={handleChangePassword} className="mt-4 space-y-3">
            <input
              type="password"
              value={passwordForm.oldPassword}
              onChange={(event) => setPasswordForm({ ...passwordForm, oldPassword: event.target.value })}
              className="input-field"
              placeholder="Password lama"
              required
            />
            <input
              type="password"
              value={passwordForm.newPassword}
              onChange={(event) => setPasswordForm({ ...passwordForm, newPassword: event.target.value })}
              className="input-field"
              placeholder="Password baru"
              minLength={6}
              required
            />
            <input
              type="password"
              value={passwordForm.confirmPassword}
              onChange={(event) => setPasswordForm({ ...passwordForm, confirmPassword: event.target.value })}
              className="input-field"
              placeholder="Konfirmasi password baru"
              minLength={6}
              required
            />
            <button type="submit" disabled={isChangingPassword} className="btn-primary w-full">
              {isChangingPassword ? 'Menyimpan...' : 'Simpan Password'}
            </button>
          </form>
        </div>
      </main>

      {/* QR Scanner Modal */}
      {showScanner && (
        <QRScannerModal
          onClose={handleCloseScanner}
          onScan={handleScan}
        />
      )}
    </div>
  );
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Gagal memuat logo'));
    image.src = src;
  });
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const normalizedRadius = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + normalizedRadius, y);
  ctx.lineTo(x + width - normalizedRadius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + normalizedRadius);
  ctx.lineTo(x + width, y + height - normalizedRadius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - normalizedRadius, y + height);
  ctx.lineTo(x + normalizedRadius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - normalizedRadius);
  ctx.lineTo(x, y + normalizedRadius);
  ctx.quadraticCurveTo(x, y, x + normalizedRadius, y);
  ctx.closePath();
}

function drawStatBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  value: number,
  color: string,
) {
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, x, y, 132, 92, 22);
  ctx.fill();

  ctx.fillStyle = color;
  ctx.font = '700 34px Inter, Arial, sans-serif';
  ctx.fillText(String(value), x + 24, y + 42);

  ctx.fillStyle = '#64748b';
  ctx.font = '600 18px Inter, Arial, sans-serif';
  ctx.fillText(label, x + 24, y + 70);
}

function ReportCard({ label, value, tone }: { label: string; value: number; tone: 'green' | 'yellow' | 'red' }) {
  const toneClass = {
    green: 'bg-green-50 text-green-700',
    yellow: 'bg-yellow-50 text-yellow-700',
    red: 'bg-red-50 text-red-700',
  }[tone];

  return (
    <div className={`rounded-xl p-3 text-center ${toneClass}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs font-medium">{label}</p>
    </div>
  );
}

interface QRScannerModalProps {
  onClose: () => void;
  onScan: (result: string) => void;
}

function QRScannerModal({ onClose, onScan }: QRScannerModalProps) {
  const [manualInput, setManualInput] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [cameraActive, setCameraActive] = useState(true);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualInput.trim()) {
      onScan(manualInput.trim());
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center p-4 text-white">
        <h2 className="text-lg font-semibold">Scan QR Code</h2>
        <button
          onClick={onClose}
          className="bg-white/20 hover:bg-white/30 p-2 rounded-full"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Scanner Area */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        {!showManual ? (
          <>
            <div className="w-64 h-64 bg-white rounded-2xl relative overflow-hidden mb-6">
              <div className="absolute inset-0 flex items-center justify-center">
                {cameraActive ? (
                  <QRCodeReader onScan={onScan} />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gray-900 p-6 text-center text-white">
                    <p className="text-sm">Kamera sedang mati</p>
                  </div>
                )}
              </div>
              <div className="absolute inset-0 border-4 border-primary-500 rounded-2xl pointer-events-none" />
              {cameraActive && <div className="absolute top-0 left-0 w-full h-1 bg-primary-500 animate-pulse" />}
            </div>
            <p className="text-white/80 text-center text-sm mb-4">
              Arahkan kamera ke QR Code pegawai
            </p>
            <button
              type="button"
              onClick={() => setCameraActive((value) => !value)}
              className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-900"
            >
              {cameraActive ? 'Matikan Kamera' : 'Hidupkan Kamera'}
            </button>
          </>
        ) : (
          <form onSubmit={handleManualSubmit} className="w-full max-w-xs">
            <input
              type="text"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="Masukkan kode QR manual"
              className="input-field mb-4"
              autoFocus
            />
            <button type="submit" className="btn-primary w-full">
              Submit
            </button>
          </form>
        )}

        <button
          onClick={() => {
            setShowManual(!showManual);
            setCameraActive(showManual);
          }}
          className="text-white/80 hover:text-white text-sm underline mt-4"
        >
          {showManual ? 'Gunakan Kamera' : 'Input Manual'}
        </button>
      </div>
    </div>
  );
}

interface QRCodeReaderProps {
  onScan: (result: string) => void;
}

function QRCodeReader({ onScan }: QRCodeReaderProps) {
  const [error, setError] = useState<string>('');
  const [isStarting, setIsStarting] = useState(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    let isMounted = true;
    let stopScanner: (() => void) | undefined;

    const startScanner = async () => {
      try {
        if (!videoRef.current) return;

        const codeReader = new BrowserMultiFormatReader();
        const controls = await codeReader.decodeFromVideoDevice(
          undefined,
          videoRef.current,
          (result, scanError, scannerControls) => {
            if (result) {
              scannerControls.stop();
              onScan(result.getText());
              return;
            }

            if (scanError && !(scanError instanceof NotFoundException)) {
              setError('Kamera belum bisa membaca QR/barcode. Coba arahkan ulang.');
            }
          },
        );

        stopScanner = controls.stop;
        if (isMounted) setIsStarting(false);
      } catch {
        if (isMounted) {
          setIsStarting(false);
          setError('Kamera tidak tersedia atau izin kamera ditolak');
        }
      }
    };

    startScanner();

    return () => {
      isMounted = false;
      stopScanner?.();
    };
  }, [onScan]);

  if (error) {
    return (
      <div className="text-center p-4 text-red-600">
        <p className="text-sm font-medium">{error}</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-black">
      <video
        ref={videoRef}
        className="h-full w-full object-cover"
        muted
        playsInline
      />
      {isStarting && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-white">
          <div className="text-center">
            <div className="spinner mx-auto mb-3"></div>
            <p className="text-sm">Membuka kamera...</p>
          </div>
        </div>
      )}
    </div>
  );
}
