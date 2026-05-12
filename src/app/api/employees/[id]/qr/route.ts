import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getD1Employee } from '@/lib/d1-store';
import { getMockEmployee, shouldUseMockData } from '@/lib/mock-store';
import { generateQRCodeBuffer } from '@/lib/qr';
import { formatEmployeeId } from '@/lib/utils';

export const dynamic = 'force-dynamic';

function buildQrFilename(employee: { id?: string; employeeId: string; name: string }) {
  const safeName = employee.name.replace(/[^a-z0-9_-]+/gi, '_');
  const nip = formatEmployeeId(employee.employeeId);
  const identifier = nip === '-' ? employee.id || safeName : nip;
  return `QR_${identifier}_${safeName}.png`;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const d1Employee = await getD1Employee(id);
    if (d1Employee) {
      const buffer = await generateQRCodeBuffer(d1Employee.qrToken);
      const body = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;

      return new NextResponse(body, {
        headers: {
          'Content-Type': 'image/png',
          'Content-Disposition': `attachment; filename="${buildQrFilename(d1Employee)}"`,
        },
      });
    }

    if (shouldUseMockData()) {
      const employee = getMockEmployee(id);
      if (!employee) {
        return NextResponse.json({ error: 'Pegawai tidak ditemukan' }, { status: 404 });
      }
      const buffer = await generateQRCodeBuffer(employee.qrToken);
      const body = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;

      return new NextResponse(body, {
        headers: {
          'Content-Type': 'image/png',
          'Content-Disposition': `attachment; filename="${buildQrFilename(employee)}"`,
        },
      });
    }

    const { default: prisma } = await import('@/lib/db');
    const employee = await prisma.employee.findUnique({
      where: { id },
      select: {
        employeeId: true,
        name: true,
        qrToken: true,
      },
    });

    if (!employee) {
      return NextResponse.json({ error: 'Pegawai tidak ditemukan' }, { status: 404 });
    }

    const buffer = await generateQRCodeBuffer(employee.qrToken);

    const body = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;

    return new NextResponse(body, {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `attachment; filename="${buildQrFilename({ ...employee, id })}"`,
      },
    });
  } catch (error) {
    console.error('Generate QR image error:', error);
    const { id } = await params;
    const employee = getMockEmployee(id);
    if (employee) {
      const buffer = await generateQRCodeBuffer(employee.qrToken);
      const body = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;

      return new NextResponse(body, {
        headers: {
          'Content-Type': 'image/png',
          'Content-Disposition': `attachment; filename="${buildQrFilename(employee)}"`,
        },
      });
    }
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
