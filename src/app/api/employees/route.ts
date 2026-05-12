import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { DEFAULT_USER_PASSWORD, createOfficeEmail, isAllowedEmailDomain } from '@/lib/app-config';
import { createD1Employee, listD1Employees } from '@/lib/d1-store';
import { createMockEmployee, listMockEmployees, shouldUseMockData } from '@/lib/mock-store';
import { emptyToNull, generateInternalEmployeeId, generateQRToken, isValidEmployeeId, normalizeEmail, normalizeEmployeeId } from '@/lib/utils';

export const dynamic = 'force-dynamic';

async function createUniqueEmployeeId(proposed?: string): Promise<string> {
  const normalized = normalizeEmployeeId(proposed);
  if (normalized) return normalized;

  const { default: prisma } = await import('@/lib/db');
  for (let i = 0; i < 8; i++) {
    const value = generateInternalEmployeeId();
    const exists = await prisma.employee.findUnique({ where: { employeeId: value } });
    if (!exists) return value;
  }

  throw new Error('Gagal membuat employee ID unik');
}

async function createUniqueQrToken(): Promise<string> {
  const { default: prisma } = await import('@/lib/db');
  for (let i = 0; i < 8; i++) {
    const value = generateQRToken();
    const exists = await prisma.employee.findUnique({ where: { qrToken: value } });
    if (!exists) return value;
  }

  throw new Error('Gagal membuat QR token unik');
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const d1Employees = await listD1Employees();
    if (d1Employees) return NextResponse.json(d1Employees);
    if (shouldUseMockData()) return NextResponse.json(listMockEmployees());

    const { default: prisma } = await import('@/lib/db');
    const employees = await prisma.employee.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            email: true,
            isActive: true,
          },
        },
      },
    });

    return NextResponse.json(employees);
  } catch (error) {
    console.error('Get employees error:', error);
    return NextResponse.json(listMockEmployees());
  }
}

export async function POST(request: Request) {
  let body: {
    employeeId?: string;
    name?: string;
    email?: string;
    password?: string;
    phone?: string;
    department?: string;
    position?: string;
  } = {};

  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    body = (await request.json()) as typeof body;

    const name = body.name?.trim();
    const email = normalizeEmail(body.email || (name ? createOfficeEmail(name) : ''));
    const employeeId = normalizeEmployeeId(body.employeeId);
    const password = body.password?.trim();

    if (!name) {
      return NextResponse.json({ error: 'Nama diperlukan' }, { status: 400 });
    }

    if (password && password.length < 6) {
      return NextResponse.json({ error: 'Password minimal 6 karakter' }, { status: 400 });
    }

    if (!isAllowedEmailDomain(email)) {
      return NextResponse.json({ error: 'Email wajib memakai domain @gmail.com' }, { status: 400 });
    }

    if (!isValidEmployeeId(employeeId)) {
      return NextResponse.json({ error: 'NIP hanya boleh berisi angka dan boleh dikosongkan' }, { status: 400 });
    }

    try {
      const d1Employee = await createD1Employee({
        employeeId,
        name,
        email,
        password,
        phone: body.phone,
        department: body.department,
        position: body.position,
      });
      if (d1Employee) return NextResponse.json({ success: true, employee: d1Employee }, { status: 201 });
    } catch (d1Error) {
      const message = d1Error instanceof Error ? d1Error.message : 'Server error';
      const status = message.includes('terdaftar') ? 409 : 400;
      return NextResponse.json({ error: message }, { status });
    }

    if (shouldUseMockData()) {
      try {
        const employee = createMockEmployee({
          employeeId,
          name,
          email,
          password,
          phone: body.phone,
          department: body.department,
          position: body.position,
        });
        return NextResponse.json({ success: true, employee }, { status: 201 });
      } catch (mockError) {
        const message = mockError instanceof Error ? mockError.message : 'Server error';
        return NextResponse.json({ error: message }, { status: 409 });
      }
    }

    const { default: prisma } = await import('@/lib/db');
    const [existingUser, existingEmployeeEmail] = await Promise.all([
      prisma.user.findUnique({ where: { email } }),
      prisma.employee.findUnique({ where: { email } }),
    ]);

    if (existingUser || existingEmployeeEmail) {
      return NextResponse.json({ error: 'Email sudah terdaftar' }, { status: 409 });
    }

    const finalEmployeeId = await createUniqueEmployeeId(employeeId);
    const existingEmployeeId = await prisma.employee.findUnique({ where: { employeeId: finalEmployeeId } });
    if (existingEmployeeId) {
      return NextResponse.json({ error: 'NIP sudah terdaftar' }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password || DEFAULT_USER_PASSWORD, 12);
    const qrToken = await createUniqueQrToken();

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          name,
          role: 'USER',
          isActive: true,
        },
      });

      const employee = await tx.employee.create({
        data: {
          userId: user.id,
          employeeId: finalEmployeeId,
          name,
          email,
          phone: emptyToNull(body.phone),
          department: emptyToNull(body.department),
          position: emptyToNull(body.position),
          qrToken,
          isActive: true,
        },
      });

      return { user, employee };
    });

    await prisma.auditLog.create({
      data: {
        adminUserId: session.userId,
        action: 'CREATE',
        entityType: 'EMPLOYEE',
        entityId: result.employee.id,
        newValue: {
          name,
          email,
          employeeId: finalEmployeeId,
        },
      },
    });

    return NextResponse.json({ success: true, employee: result.employee }, { status: 201 });
  } catch (error) {
    console.error('Create employee error:', error);
    if (body.name && body.email && body.password && body.password.trim().length >= 6) {
      try {
        const employee = createMockEmployee({
          employeeId: normalizeEmployeeId(body.employeeId),
          name: body.name,
          email: body.email,
          password: body.password,
          phone: body.phone,
          department: body.department,
          position: body.position,
        });
        return NextResponse.json({ success: true, employee }, { status: 201 });
      } catch (mockError) {
        const message = mockError instanceof Error ? mockError.message : 'Server error';
        return NextResponse.json({ error: message }, { status: 409 });
      }
    }
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
