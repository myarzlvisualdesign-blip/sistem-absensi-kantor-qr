import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { Prisma } from '@prisma/client';
import { getSession } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import { generateQRToken, generateEmployeeId as genEmpId } from '@/lib/utils';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'File diperlukan' }, { status: 400 });
    }

    // Read file
    const text = await file.text();
    const lines = text.split('\n').filter((line) => line.trim());

    if (lines.length < 2) {
      return NextResponse.json({ error: 'File tidak memiliki data' }, { status: 400 });
    }

    // Parse header
    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const requiredHeaders = ['name', 'email'];
    const missingHeaders = requiredHeaders.filter((h) => !headers.includes(h));

    if (missingHeaders.length > 0) {
      return NextResponse.json(
        { error: `Header tidak ditemukan: ${missingHeaders.join(', ')}` },
        { status: 400 }
      );
    }

    const result = {
      success: 0,
      failed: 0,
      errors: [] as Array<{ row: number; error: string }>,
    };

    // Process rows
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map((v) => v.trim());
      const row: Record<string, string> = {};

      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });

      try {
        const { name, email, password, department, position, phone } = row;

        if (!name || !email) {
          result.failed++;
          result.errors.push({ row: i + 1, error: 'Nama dan email diperlukan' });
          continue;
        }

        // Check if email exists
        const existingUser = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
        });

        if (existingUser) {
          result.failed++;
          result.errors.push({ row: i + 1, error: `Email ${email} sudah terdaftar` });
          continue;
        }

        // Generate password if not provided
        const pwd = password || Math.random().toString(36).slice(-8);
        const hashedPassword = await bcrypt.hash(pwd, 10);

        // Generate IDs
        const employeeId = row.employee_id || genEmpId();
        const qrToken = generateQRToken();

        // Create user and employee
        await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          const newUser = await tx.user.create({
            data: {
              email: email.toLowerCase(),
              password: hashedPassword,
              name,
              role: 'USER',
              isActive: true,
            },
          });

          await tx.employee.create({
            data: {
              userId: newUser.id,
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
        });

        result.success++;
      } catch (error) {
        result.failed++;
        result.errors.push({ row: i + 1, error: 'Terjadi kesalahan saat memproses' });
      }
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        adminUserId: session.userId,
        action: 'IMPORT',
        entityType: 'EMPLOYEES',
        newValue: JSON.stringify({
          success: result.success,
          failed: result.failed,
        }),
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Import employees error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
