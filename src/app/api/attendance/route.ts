import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    // Filters
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const name = searchParams.get('name');
    const department = searchParams.get('department');
    const status = searchParams.get('status');

    if (startDate) {
      where.date = { ...where.date, gte: startDate };
    }
    if (endDate) {
      where.date = { ...where.date, lte: endDate };
    }
    if (name || department) {
      where.employee = {
        ...(name && { name: { contains: name } }),
        ...(department && { department: { contains: department } }),
      };
    }
    if (status) {
      where.status = status;
    }

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
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Get attendances error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
