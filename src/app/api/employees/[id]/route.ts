import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { deactivateD1Employee, deleteD1Employee, getD1Employee, updateD1Employee } from '@/lib/d1-store';
import { deactivateMockEmployee, deleteMockEmployee, getMockEmployee, shouldUseMockData, updateMockEmployee } from '@/lib/mock-store';
import { isAllowedEmailDomain } from '@/lib/app-config';
import { emptyToNull, generateInternalEmployeeId, generateQRToken, isValidEmployeeId, normalizeEmail, normalizeEmployeeId } from '@/lib/utils';

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
    const d1Employee = await getD1Employee(id);
    if (d1Employee) return NextResponse.json(d1Employee);

    if (shouldUseMockData()) {
      const employee = getMockEmployee(id);
      if (!employee) {
        return NextResponse.json({ error: 'Pegawai tidak ditemukan' }, { status: 404 });
      }
      return NextResponse.json(employee);
    }

    const { default: prisma } = await import('@/lib/db');
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
    const { id } = await params;
    const employee = getMockEmployee(id);
    if (employee) return NextResponse.json(employee);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let body: {
    employeeId?: string;
    name?: string;
    email?: string;
    phone?: string;
    department?: string;
    position?: string;
    isActive?: boolean;
    regenerateQr?: boolean;
  } = {};

  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    body = (await request.json()) as typeof body;

    const employeeId = body.employeeId !== undefined ? normalizeEmployeeId(body.employeeId) : undefined;
    const email = body.email !== undefined ? normalizeEmail(body.email) : undefined;

    if (employeeId !== undefined && !isValidEmployeeId(employeeId)) {
      return NextResponse.json({ error: 'NIP hanya boleh berisi angka dan boleh dikosongkan' }, { status: 400 });
    }

    if (email !== undefined && !isAllowedEmailDomain(email)) {
      return NextResponse.json({ error: 'Email wajib memakai domain @gmail.com' }, { status: 400 });
    }

    try {
      const d1Employee = await updateD1Employee(id, { ...body, employeeId, email });
      if (d1Employee) return NextResponse.json({ success: true, employee: d1Employee });
    } catch (d1Error) {
      const message = d1Error instanceof Error ? d1Error.message : 'Server error';
      const status = message.includes('terdaftar') ? 409 : 400;
      return NextResponse.json({ error: message }, { status });
    }

    if (shouldUseMockData()) {
      try {
        const employee = updateMockEmployee(id, { ...body, employeeId, email });
        if (!employee) {
          return NextResponse.json({ error: 'Pegawai tidak ditemukan' }, { status: 404 });
        }
        return NextResponse.json({ success: true, employee });
      } catch (mockError) {
        const message = mockError instanceof Error ? mockError.message : 'Server error';
        const status = message.includes('terdaftar') ? 409 : 400;
        return NextResponse.json({ error: message }, { status });
      }
    }

    const { default: prisma } = await import('@/lib/db');
    const existingEmployee = await prisma.employee.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!existingEmployee) {
      return NextResponse.json({ error: 'Pegawai tidak ditemukan' }, { status: 404 });
    }

    const oldValue = toJsonValue(existingEmployee);
    const name = body.name?.trim() || existingEmployee.name;
    const finalEmployeeId = employeeId !== undefined ? employeeId || generateInternalEmployeeId() : existingEmployee.employeeId;
    const finalEmail = email ?? existingEmployee.email;
    const qrToken = body.regenerateQr ? generateQRToken() : existingEmployee.qrToken;
    const isActive = body.isActive ?? existingEmployee.isActive;

    if (finalEmployeeId !== existingEmployee.employeeId) {
      const duplicateEmployeeId = await prisma.employee.findFirst({
        where: { employeeId: finalEmployeeId, id: { not: id } },
      });
      if (duplicateEmployeeId) {
        return NextResponse.json({ error: 'NIP sudah terdaftar' }, { status: 409 });
      }
    }

    if (finalEmail !== existingEmployee.email) {
      const [duplicateUserEmail, duplicateEmployeeEmail] = await Promise.all([
        prisma.user.findFirst({ where: { email: finalEmail, id: { not: existingEmployee.userId } } }),
        prisma.employee.findFirst({ where: { email: finalEmail, id: { not: id } } }),
      ]);
      if (duplicateUserEmail || duplicateEmployeeEmail) {
        return NextResponse.json({ error: 'Email sudah terdaftar' }, { status: 409 });
      }
    }

    const employee = await prisma.$transaction(async (tx) => {
      const updatedEmployee = await tx.employee.update({
        where: { id },
        data: {
          employeeId: finalEmployeeId,
          name,
          email: finalEmail,
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
          email: finalEmail,
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
    const { id } = await params;
    const employee = updateMockEmployee(id, body);
    if (employee) return NextResponse.json({ success: true, employee });
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
    const d1Employee = await getD1Employee(id);
    if (d1Employee) {
      if (d1Employee.isActive) {
        await deactivateD1Employee(id);
        return NextResponse.json({ success: true, mode: 'deactivated' });
      }
      await deleteD1Employee(id);
      return NextResponse.json({ success: true, mode: 'deleted' });
    }

    if (shouldUseMockData()) {
      const employee = getMockEmployee(id);
      if (!employee) {
        return NextResponse.json({ error: 'Pegawai tidak ditemukan' }, { status: 404 });
      }
      if (employee.isActive) {
        deactivateMockEmployee(id);
        return NextResponse.json({ success: true, mode: 'deactivated' });
      }
      deleteMockEmployee(id);
      return NextResponse.json({ success: true, mode: 'deleted' });
    }

    const { default: prisma } = await import('@/lib/db');
    const existingEmployee = await prisma.employee.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!existingEmployee) {
      return NextResponse.json({ error: 'Pegawai tidak ditemukan' }, { status: 404 });
    }

    if (!existingEmployee.isActive) {
      await prisma.$transaction(async (tx) => {
        await tx.attendance.deleteMany({ where: { employeeId: id } });
        await tx.employee.delete({ where: { id } });
        await tx.user.delete({ where: { id: existingEmployee.userId } });
      });

      await prisma.auditLog.create({
        data: {
          adminUserId: session.userId,
          action: 'DELETE',
          entityType: 'EMPLOYEE',
          entityId: id,
          oldValue: toJsonValue(existingEmployee),
        },
      });

      return NextResponse.json({ success: true, mode: 'deleted' });
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

    return NextResponse.json({ success: true, mode: 'deactivated' });
  } catch (error) {
    console.error('Deactivate employee error:', error);
    const { id } = await params;
    const employee = getMockEmployee(id);
    if (employee?.isActive && deactivateMockEmployee(id)) {
      return NextResponse.json({ success: true, mode: 'deactivated' });
    }
    if (employee && deleteMockEmployee(id)) {
      return NextResponse.json({ success: true, mode: 'deleted' });
    }
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
