import { AttendanceStatus, Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
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

function escapeCsvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') === 'xlsx' ? 'xlsx' : 'csv';
    const where = buildAttendanceWhere(searchParams);

    const attendances = await prisma.attendance.findMany({
      where,
      orderBy: { checkInTime: 'desc' },
      include: {
        employee: true,
      },
    });

    const rows = attendances.map((attendance) => ({
      Tanggal: attendance.date,
      'Jam Absen': new Date(attendance.checkInTime).toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      'Nama Pegawai': attendance.employee.name,
      'Employee ID / NIP': attendance.employee.employeeId,
      Email: attendance.employee.email,
      Departemen: attendance.employee.department || '',
      Jabatan: attendance.employee.position || '',
      Status: attendance.status,
      Catatan: attendance.note || '',
    }));

    const dateLabel = new Date().toISOString().split('T')[0];

    if (format === 'xlsx') {
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Absensi');
      const data = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;

      return new NextResponse(data, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="absensi_${dateLabel}.xlsx"`,
        },
      });
    }

    const headers = [
      'Tanggal',
      'Jam Absen',
      'Nama Pegawai',
      'Employee ID / NIP',
      'Email',
      'Departemen',
      'Jabatan',
      'Status',
      'Catatan',
    ];

    const csv = [
      headers.map(escapeCsvCell).join(','),
      ...rows.map((row) => headers.map((header) => escapeCsvCell(String(row[header as keyof typeof row]))).join(',')),
    ].join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="absensi_${dateLabel}.csv"`,
      },
    });
  } catch (error) {
    console.error('Export attendance error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
