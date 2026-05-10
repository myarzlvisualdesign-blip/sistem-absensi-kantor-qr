import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';
import { generateQRCodeBuffer } from '@/lib/qr';

export const dynamic = 'force-dynamic';

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
    const safeName = employee.name.replace(/[^a-z0-9_-]+/gi, '_');

    const body = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;

    return new NextResponse(body, {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `attachment; filename="QR_${employee.employeeId}_${safeName}.png"`,
      },
    });
  } catch (error) {
    console.error('Generate QR image error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
