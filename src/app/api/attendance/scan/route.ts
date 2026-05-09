import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';
import { getTodayString, isLate } from '@/lib/utils';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'USER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { employeeId, scannedToken } = await request.json();

    if (!employeeId || !scannedToken) {
      return NextResponse.json(
        { error: 'Employee ID dan QR token diperlukan' },
        { status: 400 }
      );
    }

    // Verify employee belongs to this user
    if (session.employeeId !== employeeId) {
      return NextResponse.json(
        { error: 'Anda tidak dapat absen untuk pegawai lain' },
        { status: 403 }
      );
    }

    // Get employee data
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      return NextResponse.json(
        { error: 'Data pegawai tidak ditemukan' },
        { status: 404 }
      );
    }

    if (!employee.isActive) {
      return NextResponse.json(
        { error: 'Akun pegawai tidak aktif' },
        { status: 403 }
      );
    }

    // Verify QR token matches
    if (employee.qrToken !== scannedToken) {
      return NextResponse.json(
        { error: 'QR Code tidak valid. Pastikan Anda scan QR Anda sendiri.' },
        { status: 400 }
      );
    }

    // Check if already attended today
    const today = getTodayString();
    const existingAttendance = await prisma.attendance.findFirst({
      where: {
        employeeId,
        date: today,
      },
    });

    if (existingAttendance) {
      return NextResponse.json(
        { error: 'Anda sudah absen hari ini' },
        { status: 400 }
      );
    }

    // Get office settings for late check
    const settings = await prisma.officeSetting.findFirst();
    const lateLimitTime = settings?.lateLimitTime || '08:15';

    // Determine attendance status
    const now = new Date();
    const status = isLate(now, lateLimitTime) ? 'TERLAMBAT' : 'HADIR';

    // Create attendance record
    const attendance = await prisma.attendance.create({
      data: {
        userId: session.userId,
        employeeId,
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
    return NextResponse.json(
      { error: 'Terjadi kesalahan server' },
      { status: 500 }
    );
  }
}
