import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { getSession } from '@/lib/auth';
import { DEFAULT_USER_PASSWORD, createOfficeEmail, isAllowedEmailDomain } from '@/lib/app-config';
import { csvRowsToObjects, parseCsvRows } from '@/lib/csv';
import { getD1Database, upsertImportedD1Employee } from '@/lib/d1-store';
import { shouldUseMockData, upsertImportedMockEmployee } from '@/lib/mock-store';
import { emptyToNull, generateInternalEmployeeId, generateQRToken, isValidEmployeeId, normalizeEmail, normalizeEmployeeId } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type ImportRow = {
  employee_id?: string;
  nip?: string;
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

function getRowEmployeeId(row: ImportRow): string {
  return normalizeEmployeeId(row.nip || row.employee_id);
}

function cellValueToString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== 'object') return String(value);

  const objectValue = value as Record<string, unknown>;
  if (typeof objectValue.text === 'string') return objectValue.text;
  if (objectValue.result !== undefined) return cellValueToString(objectValue.result);
  if (Array.isArray(objectValue.richText)) {
    return objectValue.richText
      .map((part) => {
        if (part && typeof part === 'object' && 'text' in part) {
          return String((part as Record<string, unknown>).text || '');
        }
        return '';
      })
      .join('');
  }

  return String(value);
}

async function parseImportRows(file: File): Promise<Record<string, unknown>[]> {
  const arrayBuffer = await file.arrayBuffer();
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith('.csv') || file.type === 'text/csv') {
    const text = new TextDecoder('utf-8').decode(arrayBuffer);
    return csvRowsToObjects(parseCsvRows(text));
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const headerRow = worksheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colNumber - 1] = cellValueToString(cell.value).trim();
  });

  const rows: Record<string, unknown>[] = [];
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;

    const item: Record<string, string> = {};
    let hasValue = false;
    headers.forEach((header, index) => {
      if (!header) return;
      const value = cellValueToString(row.getCell(index + 1).value).trim();
      item[header] = value;
      if (value) hasValue = true;
    });
    if (hasValue) rows.push(item);
  });

  return rows;
}

async function createUniqueEmployeeId(): Promise<string> {
  const { default: prisma } = await import('@/lib/db');
  for (let i = 0; i < 8; i++) {
    const employeeId = generateInternalEmployeeId();
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

    rawRows = await parseImportRows(file);

    if (rawRows.length === 0) {
      return NextResponse.json({ error: 'File tidak memiliki data' }, { status: 400 });
    }

    const useD1 = Boolean(await getD1Database());
    if (useD1 || shouldUseMockData()) {
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
        const email = row.email ? normalizeEmail(row.email) : (name ? createOfficeEmail(name) : '');
        const employeeId = getRowEmployeeId(row);

        if (!name) {
          result.failed++;
          result.errors.push({ row: rowNumber, error: 'Kolom name wajib diisi' });
          continue;
        }

        if (!isValidEmployeeId(employeeId)) {
          result.failed++;
          result.errors.push({ row: rowNumber, error: 'Kolom NIP hanya boleh angka atau dikosongkan' });
          continue;
        }

        if (!isAllowedEmailDomain(email)) {
          result.failed++;
          result.errors.push({ row: rowNumber, error: 'Email wajib memakai domain @gmail.com' });
          continue;
        }

        try {
          const d1Action = await upsertImportedD1Employee({
            employeeId,
            name,
            email,
            password: row.password?.trim() || DEFAULT_USER_PASSWORD,
            phone: row.phone,
            department: row.department,
            position: row.position,
          });
          const action = d1Action || upsertImportedMockEmployee({
            employeeId,
            name,
            email,
            password: row.password?.trim() || DEFAULT_USER_PASSWORD,
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
      const email = row.email ? normalizeEmail(row.email) : (name ? createOfficeEmail(name) : '');
      const rowEmployeeId = getRowEmployeeId(row);
      const employeeId = rowEmployeeId || await createUniqueEmployeeId();
      const password = row.password?.trim() || DEFAULT_USER_PASSWORD;

      if (!name) {
        result.failed++;
        result.errors.push({ row: rowNumber, error: 'Kolom name wajib diisi' });
        continue;
      }

      if (!isValidEmployeeId(rowEmployeeId)) {
        result.failed++;
        result.errors.push({ row: rowNumber, error: 'Kolom NIP hanya boleh angka atau dikosongkan' });
        continue;
      }

      if (!isAllowedEmailDomain(email)) {
        result.failed++;
        result.errors.push({ row: rowNumber, error: 'Email wajib memakai domain @gmail.com' });
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
        const email = row.email ? normalizeEmail(row.email) : (name ? createOfficeEmail(name) : '');
        const employeeId = getRowEmployeeId(row);

        if (!name || !email) {
          result.failed++;
          result.errors.push({ row: rowNumber, error: 'Kolom name dan email wajib diisi' });
          continue;
        }

        if (!isValidEmployeeId(employeeId)) {
          result.failed++;
          result.errors.push({ row: rowNumber, error: 'Kolom NIP hanya boleh angka atau dikosongkan' });
          continue;
        }

        if (!isAllowedEmailDomain(email)) {
          result.failed++;
          result.errors.push({ row: rowNumber, error: 'Email wajib memakai domain @gmail.com' });
          continue;
        }

        try {
          const action = upsertImportedMockEmployee({
            employeeId,
            name,
            email,
            password: row.password?.trim() || DEFAULT_USER_PASSWORD,
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
