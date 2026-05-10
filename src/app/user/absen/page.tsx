'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { NotFoundException } from '@zxing/library';
import { formatDate, formatTime } from '@/lib/utils';

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

export default function UserAbsenPage() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [attendanceStatus, setAttendanceStatus] = useState<AttendanceStatus | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const router = useRouter();

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

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  useEffect(() => {
    if (user) {
      fetchAttendanceStatus();
    }
  }, [user, fetchAttendanceStatus]);

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

  const handleOpenScanner = () => {
    setShowScanner(true);
  };

  const handleCloseScanner = () => {
    setShowScanner(false);
  };

  const handleScan = async (result: string) => {
    if (!user || isSubmitting) return;

    setIsSubmitting(true);
    setShowScanner(false);

    try {
      const res = await fetch('/api/attendance/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scannedToken: result }),
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
      }
    } catch (error) {
      toast.error('Terjadi kesalahan saat absen');
    } finally {
      setIsSubmitting(false);
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
    <div className="min-h-screen bg-gradient-to-br from-primary-600 to-primary-800">
      {/* Header */}
      <header className="bg-white/10 backdrop-blur-sm text-white py-4 px-6">
        <div className="max-w-lg mx-auto flex justify-between items-center">
          <div>
          <h1 className="font-bold text-lg">Sistem Absensi QR</h1>
          <p className="text-sm text-white/80">{user.name}</p>
          {user.employeeCode && (
            <p className="text-xs text-white/70">{user.employeeCode}</p>
          )}
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

interface QRScannerModalProps {
  onClose: () => void;
  onScan: (result: string) => void;
}

function QRScannerModal({ onClose, onScan }: QRScannerModalProps) {
  const [manualInput, setManualInput] = useState('');
  const [showManual, setShowManual] = useState(false);

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
                <QRCodeReader onScan={onScan} />
              </div>
              <div className="absolute inset-0 border-4 border-primary-500 rounded-2xl pointer-events-none" />
              <div className="absolute top-0 left-0 w-full h-1 bg-primary-500 animate-pulse" />
            </div>
            <p className="text-white/80 text-center text-sm mb-4">
              Arahkan kamera ke QR Code pegawai
            </p>
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
          onClick={() => setShowManual(!showManual)}
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
