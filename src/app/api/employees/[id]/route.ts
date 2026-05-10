import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { Prisma } from '@prisma/client';
import { getSession } from '@/lib/auth';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json() as { name?: string; phone?: string; department?: string; position?: string; isActive?: boolean; regenerateQr?: boolean };
    const { name, phone, department, position, isActive, regenerateQr } = body;

    const existingEmployee = await prisma.employee.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!existingEmployee) {
      return NextResponse.json({ error: 'Pegawai tidak ditemukan' }, { status: 404 });
    }

    const oldValue = JSON.stringify(existingEmployee);

    let qrToken = existingEmployee.qrToken;
    if (regenerateQr) {
      const crypto = await import('crypto');
      qrToken = crypto.randomBytes(16).toString('hex');
    }

    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const employee = await tx.employee.update({
        where: { id },
        data: {
          name: name || existingEmployee.name,
          phone: phone !== undefined ? phone : existingEmployee.phone,
          department: department !== undefined ? department : existingEmployee.department,
          position: position !== undefined ? position : existingEmployee.position,
          qrToken,
          isActive: isActive !== undefined ? isActive : existingEmployee.isActive,
        },
      });

      if (isActive !== undefined) {
        await tx.user.update({
          where: { id: existingEmployee.userId },
          data: { isActive },
        });
      }

      return employee;
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        adminUserId: session.userId,
        action: 'UPDATE',
        entityType: 'EMPLOYEE',
        entityId: id,
        oldValue,
        newValue: JSON.stringify(result),
      },
    });

    return NextResponse.json({
      success: true,
      employee: result,
    });
  } catch (error) {
    console.error('Update employee error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const existingEmployee = await prisma.employee.findUnique({
      where: { id },
    });

    if (!existingEmployee) {
      return NextResponse.json({ error: 'Pegawai tidak ditemukan' }, { status: 404 });
    }

    // Delete employee and user (cascade)
    await prisma.employee.delete({
      where: { id },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        adminUserId: session.userId,
        action: 'DELETE',
        entityType: 'EMPLOYEE',
        entityId: id,
        oldValue: JSON.stringify(existingEmployee),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete employee error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
