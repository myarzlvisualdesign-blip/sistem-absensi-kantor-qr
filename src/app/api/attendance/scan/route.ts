import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createD1ScanAttendance } from '@/lib/d1-store';
import { createMockScanAttendance, shouldUseMockData } from '@/lib/mock-store';
import { getTodayString, isLate } from '@/lib/utils';
import { validateQRToken } from '@/lib/qr';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let scannedToken = '';
  let latitude: number | undefined;
  let longitude: number | undefined;

  try {
    const session = await getSession();
    if (!session || session.role !== 'USER' || !session.employeeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    ({ scannedToken = '', latitude, longitude } = (await request.json()) as {
      scannedToken?: string;
      latitude?: number;
      longitude?: number;
    });
    if (!scannedToken || !validateQRToken(scannedToken)) {
      return NextResponse.json({ error: 'QR/barcode tidak valid' }, { status: 400 });
    }

    try {
      const d1Attendance = await createD1ScanAttendance({
        userId: session.userId,
        employeeId: session.employeeId,
      }, scannedToken, { latitude, longitude });

      if (d1Attendance) {
        return NextResponse.json({
          success: true,
          status: d1Attendance.status,
          checkInTime: new Date(d1Attendance.checkInTime).toISOString(),
          message: d1Attendance.status === 'TERLAMBAT'
            ? 'Absen berhasil dengan status TERLAMBAT'
            : 'Absen berhasil dengan status HADIR',
        });
      }
    } catch (d1Error) {
      const message = d1Error instanceof Error ? d1Error.message : 'Terjadi kesalahan server';
      const status = message === 'Anda sudah absen hari ini' ? 409 : 400;
      return NextResponse.json({ error: message }, { status });
    }

    if (shouldUseMockData()) {
      try {
        const attendance = createMockScanAttendance({
          userId: session.userId,
          employeeId: session.employeeId,
        }, scannedToken, { latitude, longitude });

        return NextResponse.json({
          success: true,
          status: attendance.status,
          checkInTime: attendance.checkInTime.toISOString(),
          message: attendance.status === 'TERLAMBAT'
            ? 'Absen berhasil dengan status TERLAMBAT'
            : 'Absen berhasil dengan status HADIR',
        });
      } catch (mockError) {
        const message = mockError instanceof Error ? mockError.message : 'Terjadi kesalahan server';
        const status = message === 'Anda sudah absen hari ini' ? 409 : 400;
        return NextResponse.json({ error: message }, { status });
      }
    }

    const { default: prisma } = await import('@/lib/db');
    const employee = await prisma.employee.findUnique({
      where: { id: session.employeeId },
      include: {
        user: {
          select: { id: true, isActive: true },
        },
      },
    });

    if (!employee || !employee.isActive || !employee.user.isActive) {
      return NextResponse.json({ error: 'Data pegawai tidak aktif atau belum terdaftar' }, { status: 403 });
    }

    if (employee.userId !== session.userId) {
      return NextResponse.json({ error: 'Session tidak cocok dengan data pegawai' }, { status: 403 });
    }

    if (employee.qrToken !== scannedToken) {
      return NextResponse.json({ error: 'QR/barcode tidak cocok dengan pegawai yang sedang login' }, { status: 400 });
    }

    const today = getTodayString();
    const existingAttendance = await prisma.attendance.findFirst({
      where: {
        employeeId: employee.id,
        date: today,
      },
    });

    if (existingAttendance) {
      return NextResponse.json({ error: 'Anda sudah absen hari ini' }, { status: 409 });
    }

    const settings = await prisma.officeSetting.findFirst();
    const lateLimitTime = settings?.lateLimitTime || '08:15';
    const now = new Date();
    const status = isLate(now, lateLimitTime) ? 'TERLAMBAT' : 'HADIR';

    const attendance = await prisma.attendance.create({
      data: {
        userId: session.userId,
        employeeId: employee.id,
        date: today,
        checkInTime: now,
        status,
        scannedQrToken: scannedToken,
      },
    });

    return NextResponse.json({
      success: true,
      status,
      checkInTime: attendance.checkInTime.toISOString(),
      message: status === 'TERLAMBAT'
        ? 'Absen berhasil dengan status TERLAMBAT'
        : 'Absen berhasil dengan status HADIR',
    });
  } catch (error) {
    console.error('Scan attendance error:', error);
    const session = await getSession();
    if (session?.role === 'USER' && session.employeeId && scannedToken) {
      try {
        const attendance = createMockScanAttendance({
          userId: session.userId,
          employeeId: session.employeeId,
        }, scannedToken, { latitude, longitude });

        return NextResponse.json({
          success: true,
          status: attendance.status,
          checkInTime: attendance.checkInTime.toISOString(),
          message: attendance.status === 'TERLAMBAT'
            ? 'Absen berhasil dengan status TERLAMBAT'
            : 'Absen berhasil dengan status HADIR',
        });
      } catch (mockError) {
        const message = mockError instanceof Error ? mockError.message : 'Terjadi kesalahan server';
        const status = message === 'Anda sudah absen hari ini' ? 409 : 400;
        return NextResponse.json({ error: message }, { status });
      }
    }
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
