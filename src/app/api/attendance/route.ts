import { AttendanceStatus, Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function buildAttendanceWhere(searchParams: URLSearchParams): Prisma.AttendanceWhereInput {
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const name = searchParams.get('name');
  const employeeCode = searchParams.get('employeeId');
  const department = searchParams.get('department');
  const status = searchParams.get('status');

  const where: Prisma.AttendanceWhereInput = {};

  if (startDate || endDate) {
    where.date = {
      ...(startDate ? { gte: startDate } : {}),
      ...(endDate ? { lte: endDate } : {}),
    };
  }

  if (name || employeeCode || department) {
    where.employee = {
      ...(name ? { name: { contains: name, mode: 'insensitive' } } : {}),
      ...(employeeCode ? { employeeId: { contains: employeeCode, mode: 'insensitive' } } : {}),
      ...(department ? { department: { contains: department, mode: 'insensitive' } } : {}),
    };
  }

  if (status === AttendanceStatus.HADIR || status === AttendanceStatus.TERLAMBAT) {
    where.status = status;
  }

  return where;
}

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get('page') || '1');
    const limit = 20;
    const skip = (Math.max(page, 1) - 1) * limit;
    const where = buildAttendanceWhere(searchParams);

    const [attendances, total] = await Promise.all([
      prisma.attendance.findMany({
        where,
        skip,
        take: limit,
        orderBy: { checkInTime: 'desc' },
        include: {
          employee: true,
        },
      }),
      prisma.attendance.count({ where }),
    ]);

    return NextResponse.json({
      attendances,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    });
  } catch (error) {
    console.error('Get attendances error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
