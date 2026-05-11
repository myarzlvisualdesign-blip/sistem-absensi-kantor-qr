import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getSession } from '@/lib/auth';
import { shouldUseMockData, upsertImportedMockEmployee } from '@/lib/mock-store';
import { emptyToNull, generateEmployeeId, generateQRToken, normalizeEmail } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type ImportRow = {
  employee_id?: string;
  name?: string;
  email?: string;
  password?: string;
  department?: string;
  position?: string;
  phone?: string;
};

function normalizeRow(row: Record<string, unknown>): ImportRow {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(row)) {
    normalized[key.trim().toLowerCase()] = String(value ?? '').trim();
  }
  return normalized;
}

async function createUniqueEmployeeId(): Promise<string> {
  const { default: prisma } = await import('@/lib/db');
  for (let i = 0; i < 8; i++) {
    const employeeId = generateEmployeeId();
    const exists = await prisma.employee.findUnique({ where: { employeeId } });
    if (!exists) return employeeId;
  }
  throw new Error('Gagal membuat employee ID unik');
}

async function createUniqueQrToken(): Promise<string> {
  const { default: prisma } = await import('@/lib/db');
  for (let i = 0; i < 8; i++) {
    const qrToken = generateQRToken();
    const exists = await prisma.employee.findUnique({ where: { qrToken } });
    if (!exists) return qrToken;
  }
  throw new Error('Gagal membuat QR token unik');
}

export async function POST(request: Request) {
  let rawRows: Record<string, unknown>[] = [];

  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'File diperlukan' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' });

    if (rawRows.length === 0) {
      return NextResponse.json({ error: 'File tidak memiliki data' }, { status: 400 });
    }

    if (shouldUseMockData()) {
      const result = {
        success: 0,
        created: 0,
        updated: 0,
        failed: 0,
        errors: [] as Array<{ row: number; error: string }>,
      };

      for (const [index, rawRow] of rawRows.entries()) {
        const rowNumber = index + 2;
        const row = normalizeRow(rawRow);
        const name = row.name?.trim();
        const email = row.email ? normalizeEmail(row.email) : '';

        if (!name || !email) {
          result.failed++;
          result.errors.push({ row: rowNumber, error: 'Kolom name dan email wajib diisi' });
          continue;
        }

        try {
          const action = upsertImportedMockEmployee({
            employeeId: row.employee_id?.trim(),
            name,
            email,
            password: row.password?.trim() || 'user123',
            phone: row.phone,
            department: row.department,
            position: row.position,
          });
          result.success++;
          if (action === 'created') result.created++;
          if (action === 'updated') result.updated++;
        } catch {
          result.failed++;
          result.errors.push({ row: rowNumber, error: 'Terjadi kesalahan saat memproses baris' });
        }
      }

      return NextResponse.json(result);
    }

    const { default: prisma } = await import('@/lib/db');
    const result = {
      success: 0,
      created: 0,
      updated: 0,
      failed: 0,
      errors: [] as Array<{ row: number; error: string }>,
    };

    for (const [index, rawRow] of rawRows.entries()) {
      const rowNumber = index + 2;
      const row = normalizeRow(rawRow);
      const name = row.name?.trim();
      const email = row.email ? normalizeEmail(row.email) : '';
      const employeeId = row.employee_id?.trim() || await createUniqueEmployeeId();
      const password = row.password?.trim() || 'user123';

      if (!name || !email) {
        result.failed++;
        result.errors.push({ row: rowNumber, error: 'Kolom name dan email wajib diisi' });
        continue;
      }

      try {
        const existingEmployeeById = await prisma.employee.findUnique({
          where: { employeeId },
          include: { user: true },
        });

        if (existingEmployeeById) {
          const existingEmailOwner = await prisma.user.findUnique({ where: { email } });
          if (existingEmailOwner && existingEmailOwner.id !== existingEmployeeById.userId) {
            result.failed++;
            result.errors.push({ row: rowNumber, error: `Email ${email} sudah digunakan pegawai lain` });
            continue;
          }

          const passwordData = row.password?.trim()
            ? { passwordHash: await bcrypt.hash(password, 12) }
            : {};

          await prisma.$transaction(async (tx) => {
            await tx.user.update({
              where: { id: existingEmployeeById.userId },
              data: {
                name,
                email,
                isActive: true,
                ...passwordData,
              },
            });
            await tx.employee.update({
              where: { id: existingEmployeeById.id },
              data: {
                name,
                email,
                phone: emptyToNull(row.phone),
                department: emptyToNull(row.department),
                position: emptyToNull(row.position),
                isActive: true,
              },
            });
          });

          result.success++;
          result.updated++;
          continue;
        }

        const [existingUser, existingEmployeeEmail] = await Promise.all([
          prisma.user.findUnique({ where: { email } }),
          prisma.employee.findUnique({ where: { email } }),
        ]);

        if (existingUser || existingEmployeeEmail) {
          result.failed++;
          result.errors.push({ row: rowNumber, error: `Email ${email} sudah terdaftar` });
          continue;
        }

        const passwordHash = await bcrypt.hash(password, 12);
        const qrToken = await createUniqueQrToken();

        await prisma.$transaction(async (tx) => {
          const user = await tx.user.create({
            data: {
              email,
              passwordHash,
              name,
              role: 'USER',
              isActive: true,
            },
          });

          await tx.employee.create({
            data: {
              userId: user.id,
              employeeId,
              name,
              email,
              phone: emptyToNull(row.phone),
              department: emptyToNull(row.department),
              position: emptyToNull(row.position),
              qrToken,
              isActive: true,
            },
          });
        });

        result.success++;
        result.created++;
      } catch (error) {
        result.failed++;
        result.errors.push({ row: rowNumber, error: 'Terjadi kesalahan saat memproses baris' });
      }
    }

    await prisma.auditLog.create({
      data: {
        adminUserId: session.userId,
        action: 'IMPORT',
        entityType: 'EMPLOYEES',
        newValue: result,
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Import employees error:', error);
    if (rawRows.length > 0) {
      const result = {
        success: 0,
        created: 0,
        updated: 0,
        failed: 0,
        errors: [] as Array<{ row: number; error: string }>,
      };

      for (const [index, rawRow] of rawRows.entries()) {
        const rowNumber = index + 2;
        const row = normalizeRow(rawRow);
        const name = row.name?.trim();
        const email = row.email ? normalizeEmail(row.email) : '';

        if (!name || !email) {
          result.failed++;
          result.errors.push({ row: rowNumber, error: 'Kolom name dan email wajib diisi' });
          continue;
        }

        try {
          const action = upsertImportedMockEmployee({
            employeeId: row.employee_id?.trim(),
            name,
            email,
            password: row.password?.trim() || 'user123',
            phone: row.phone,
            department: row.department,
            position: row.position,
          });
          result.success++;
          if (action === 'created') result.created++;
          if (action === 'updated') result.updated++;
        } catch {
          result.failed++;
          result.errors.push({ row: rowNumber, error: 'Terjadi kesalahan saat memproses baris' });
        }
      }

      return NextResponse.json(result);
    }
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
