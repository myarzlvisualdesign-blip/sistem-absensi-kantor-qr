import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { emptyToNull, generateEmployeeId, generateQRToken, normalizeEmail } from '@/lib/utils';

export const dynamic = 'force-dynamic';

async function createUniqueEmployeeId(proposed?: string): Promise<string> {
  if (proposed) return proposed.trim();

  for (let i = 0; i < 8; i++) {
    const value = generateEmployeeId();
    const exists = await prisma.employee.findUnique({ where: { employeeId: value } });
    if (!exists) return value;
  }

  throw new Error('Gagal membuat employee ID unik');
}

async function createUniqueQrToken(): Promise<string> {
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
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as {
      employeeId?: string;
      name?: string;
      email?: string;
      password?: string;
      phone?: string;
      department?: string;
      position?: string;
    };

    const name = body.name?.trim();
    const email = body.email ? normalizeEmail(body.email) : '';
    const password = body.password?.trim();

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Nama, email, dan password diperlukan' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password minimal 6 karakter' }, { status: 400 });
    }

    const [existingUser, existingEmployeeEmail] = await Promise.all([
      prisma.user.findUnique({ where: { email } }),
      prisma.employee.findUnique({ where: { email } }),
    ]);

    if (existingUser || existingEmployeeEmail) {
      return NextResponse.json({ error: 'Email sudah terdaftar' }, { status: 409 });
    }

    const employeeId = await createUniqueEmployeeId(body.employeeId);
    const existingEmployeeId = await prisma.employee.findUnique({ where: { employeeId } });
    if (existingEmployeeId) {
      return NextResponse.json({ error: 'Employee ID sudah terdaftar' }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
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
          employeeId,
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
          employeeId,
        },
      },
    });

    return NextResponse.json({ success: true, employee: result.employee }, { status: 201 });
  } catch (error) {
    console.error('Create employee error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
