import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { emptyToNull, generateQRToken } from '@/lib/utils';

export const dynamic = 'force-dynamic';

function toJsonValue<T>(value: T) {
  return JSON.parse(JSON.stringify(value));
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
    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            email: true,
            isActive: true,
          },
        },
      },
    });

    if (!employee) {
      return NextResponse.json({ error: 'Pegawai tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json(employee);
  } catch (error) {
    console.error('Get employee error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = (await request.json()) as {
      name?: string;
      phone?: string;
      department?: string;
      position?: string;
      isActive?: boolean;
      regenerateQr?: boolean;
    };

    const existingEmployee = await prisma.employee.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!existingEmployee) {
      return NextResponse.json({ error: 'Pegawai tidak ditemukan' }, { status: 404 });
    }

    const oldValue = toJsonValue(existingEmployee);
    const name = body.name?.trim() || existingEmployee.name;
    const qrToken = body.regenerateQr ? generateQRToken() : existingEmployee.qrToken;
    const isActive = body.isActive ?? existingEmployee.isActive;

    const employee = await prisma.$transaction(async (tx) => {
      const updatedEmployee = await tx.employee.update({
        where: { id },
        data: {
          name,
          phone: body.phone !== undefined ? emptyToNull(body.phone) : existingEmployee.phone,
          department: body.department !== undefined ? emptyToNull(body.department) : existingEmployee.department,
          position: body.position !== undefined ? emptyToNull(body.position) : existingEmployee.position,
          qrToken,
          isActive,
        },
      });

      await tx.user.update({
        where: { id: existingEmployee.userId },
        data: {
          name,
          isActive,
        },
      });

      return updatedEmployee;
    });

    await prisma.auditLog.create({
      data: {
        adminUserId: session.userId,
        action: body.regenerateQr ? 'REGENERATE_QR' : 'UPDATE',
        entityType: 'EMPLOYEE',
        entityId: id,
        oldValue,
        newValue: toJsonValue(employee),
      },
    });

    return NextResponse.json({ success: true, employee });
  } catch (error) {
    console.error('Update employee error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const existingEmployee = await prisma.employee.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!existingEmployee) {
      return NextResponse.json({ error: 'Pegawai tidak ditemukan' }, { status: 404 });
    }

    const employee = await prisma.$transaction(async (tx) => {
      const updatedEmployee = await tx.employee.update({
        where: { id },
        data: { isActive: false },
      });
      await tx.user.update({
        where: { id: existingEmployee.userId },
        data: { isActive: false },
      });
      return updatedEmployee;
    });

    await prisma.auditLog.create({
      data: {
        adminUserId: session.userId,
        action: 'DEACTIVATE',
        entityType: 'EMPLOYEE',
        entityId: id,
        oldValue: toJsonValue(existingEmployee),
        newValue: toJsonValue(employee),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Deactivate employee error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
