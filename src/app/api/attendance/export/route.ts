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
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const name = searchParams.get('name');
    const department = searchParams.get('department');
    const status = searchParams.get('status');

    const where: any = {};

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

    const attendances = await prisma.attendance.findMany({
      where,
      orderBy: { checkInTime: 'desc' },
      include: {
        employee: true,
      },
    });

    // Generate CSV
    const headers = [
      'Tanggal',
      'Jam Absen',
      'Nama Pegawai',
      'Employee ID',
      'Email',
      'Departemen',
      'Jabatan',
      'Status',
      'Catatan',
    ];

    const rows = attendances.map((a: { date: string; checkInTime: Date; status: string; note?: string | null; employee: { name: string; employeeId: string; email: string; department?: string | null; position?: string | null } }) => [
      a.date,
      new Date(a.checkInTime).toISOString(),
      a.employee.name,
      a.employee.employeeId,
      a.employee.email,
      a.employee.department || '',
      a.employee.position || '',
      a.status,
      a.note || '',
    ]);

    const csv = [
      headers.join(','),
      ...rows.map((row: (string | Date | undefined)[]) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="absensi_${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error('Export attendance error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
