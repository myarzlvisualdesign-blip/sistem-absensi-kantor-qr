import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getD1UserReport } from '@/lib/d1-store';
import { getMockUserReport } from '@/lib/mock-store';

export const dynamic = 'force-dynamic';

function countWeekdaysUntilToday(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  let count = 0;
  for (const cursor = new Date(start); cursor <= date; cursor.setDate(cursor.getDate() + 1)) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) count++;
  }
  return count;
}

async function getPrismaUserReport(employeeId: string) {
  const { default: prisma } = await import('@/lib/db');
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { qrToken: true },
  });
  if (!employee) return null;

  const attendances = await prisma.attendance.findMany({
    where: {
      employeeId,
      date: { startsWith: month },
    },
    orderBy: [
      { date: 'desc' },
      { checkInTime: 'desc' },
    ],
    select: {
      id: true,
      date: true,
      checkInTime: true,
      status: true,
      note: true,
    },
  });

  const hadir = attendances.filter((attendance) => attendance.status === 'HADIR').length;
  const terlambat = attendances.filter((attendance) => attendance.status === 'TERLAMBAT').length;
  const workdays = countWeekdaysUntilToday(now);

  return {
    month,
    hadir,
    terlambat,
    alpha: Math.max(workdays - hadir - terlambat, 0),
    totalRecorded: attendances.length,
    qrToken: employee.qrToken,
    attendances: attendances.map((attendance) => ({
      ...attendance,
      checkInTime: attendance.checkInTime.toISOString(),
    })),
  };
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'USER' || !session.employeeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const report = await getD1UserReport(session.employeeId).catch((error) => {
      console.error('D1 user report fallback:', error);
      return null;
    });
    if (report) return NextResponse.json(report);

    const prismaReport = await getPrismaUserReport(session.employeeId).catch((error) => {
      console.error('Prisma user report fallback:', error);
      return null;
    });

    return NextResponse.json(prismaReport || getMockUserReport(session.employeeId));
  } catch (error) {
    console.error('User report error:', error);
    const session = await getSession();
    if (session?.role === 'USER' && session.employeeId) {
      return NextResponse.json(getMockUserReport(session.employeeId));
    }
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
