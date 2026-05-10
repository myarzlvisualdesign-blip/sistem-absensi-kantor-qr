import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';
import { getTodayString } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'USER' || !session.employeeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const today = getTodayString();
    const attendance = await prisma.attendance.findFirst({
      where: {
        employeeId: session.employeeId,
        date: today,
      },
    });

    if (!attendance) {
      return NextResponse.json({
        status: 'BELUM_ABSEN',
        message: 'Anda belum absen hari ini',
      });
    }

    return NextResponse.json({
      status: attendance.status,
      checkInTime: attendance.checkInTime.toISOString(),
      attendanceId: attendance.id,
    });
  } catch (error) {
    console.error('Get today attendance error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
