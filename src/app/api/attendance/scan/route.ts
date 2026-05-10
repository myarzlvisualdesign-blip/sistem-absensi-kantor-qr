import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';
import { getTodayString, isLate } from '@/lib/utils';
import { validateQRToken } from '@/lib/qr';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'USER' || !session.employeeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { scannedToken } = (await request.json()) as { scannedToken?: string };
    if (!scannedToken || !validateQRToken(scannedToken)) {
      return NextResponse.json({ error: 'QR/barcode tidak valid' }, { status: 400 });
    }

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
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
