import { AttendanceStatus, Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { getSession } from '@/lib/auth';
import { exportD1Attendances } from '@/lib/d1-store';
import { exportMockAttendances, MockAttendance, shouldUseMockData } from '@/lib/mock-store';
import { formatEmployeeId } from '@/lib/utils';

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

async function createExportResponse(attendances: Array<MockAttendance | {
  date: string;
  checkInTime: Date | string;
  status: string;
  note: string | null;
  employee: {
    name: string;
    employeeId: string;
    email: string;
    department: string | null;
    position: string | null;
  };
}>, format: 'csv' | 'xlsx') {
  const rows = attendances.map((attendance) => ({
    Tanggal: attendance.date,
    'Jam Absen': new Date(attendance.checkInTime).toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
    'Nama Pegawai': attendance.employee?.name || '',
    'NIP Pegawai': formatEmployeeId(attendance.employee?.employeeId),
    Email: attendance.employee?.email || '',
    Jabatan: attendance.employee?.position || '',
    Status: attendance.status,
    Catatan: attendance.note || '',
  }));

  const dateLabel = new Date().toISOString().split('T')[0];
  const headers = [
    'Tanggal',
    'Jam Absen',
    'Nama Pegawai',
    'NIP Pegawai',
    'Email',
    'Jabatan',
    'Status',
    'Catatan',
  ];

  if (format === 'xlsx') {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Absensi');
    worksheet.columns = headers.map((header) => ({
      header,
      key: header,
      width: Math.max(header.length + 4, 16),
    }));
    rows.forEach((row) => worksheet.addRow(row));
    worksheet.getRow(1).font = { bold: true };
    const data = await workbook.xlsx.writeBuffer();

    return new NextResponse(data, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="absensi_${dateLabel}.xlsx"`,
      },
    });
  }

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

    const d1Attendances = await exportD1Attendances({
      startDate: searchParams.get('startDate'),
      endDate: searchParams.get('endDate'),
      name: searchParams.get('name'),
      employeeId: searchParams.get('employeeId'),
      department: searchParams.get('department'),
      status: searchParams.get('status'),
    });
    if (d1Attendances) return await createExportResponse(d1Attendances, format);

    if (shouldUseMockData()) {
      const attendances = exportMockAttendances({
        startDate: searchParams.get('startDate'),
        endDate: searchParams.get('endDate'),
        name: searchParams.get('name'),
        employeeId: searchParams.get('employeeId'),
        department: searchParams.get('department'),
        status: searchParams.get('status'),
      });
      return await createExportResponse(attendances, format);
    }

    const { default: prisma } = await import('@/lib/db');
    const attendances = await prisma.attendance.findMany({
      where,
      orderBy: { checkInTime: 'desc' },
      include: {
        employee: true,
      },
    });

    return await createExportResponse(attendances, format);
  } catch (error) {
    console.error('Export attendance error:', error);
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') === 'xlsx' ? 'xlsx' : 'csv';
    const attendances = exportMockAttendances({
      startDate: searchParams.get('startDate'),
      endDate: searchParams.get('endDate'),
      name: searchParams.get('name'),
      employeeId: searchParams.get('employeeId'),
      department: searchParams.get('department'),
      status: searchParams.get('status'),
    });
    return await createExportResponse(attendances, format);
  }
}
