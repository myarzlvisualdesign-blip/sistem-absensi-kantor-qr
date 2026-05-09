import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';
import { generateQRToken, generateEmployeeId as generateEmpId } from '@/lib/utils';

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

    const { name, email, password, phone, department, position } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Nama, email, dan password diperlukan' },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email sudah terdaftar' },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate unique IDs
    const employeeId = generateEmpId();
    const qrToken = generateQRToken();

    // Create user and employee in transaction
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: email.toLowerCase(),
          password: hashedPassword,
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
          email: email.toLowerCase(),
          phone: phone || null,
          department: department || null,
          position: position || null,
          qrToken,
          isActive: true,
        },
      });

      return { user, employee };
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        adminUserId: session.userId,
        action: 'CREATE',
        entityType: 'EMPLOYEE',
        entityId: result.employee.id,
        newValue: JSON.stringify({
          name,
          email,
          employeeId,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      employee: result.employee,
    });
  } catch (error) {
    console.error('Create employee error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
