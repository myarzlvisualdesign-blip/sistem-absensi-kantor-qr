import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';
import { getTodayString, isLate } from '@/lib/utils';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'USER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId') || session.employeeId;

    if (!employeeId) {
      return NextResponse.json({ error: 'Employee ID required' }, { status: 400 });
    }

    const today = getTodayString();

    const attendance = await prisma.attendance.findFirst({
      where: {
        employeeId,
        date: today,
      },
    });

    if (!attendance) {
      return NextResponse.json({
        status: 'BELUM_ABEN',
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
