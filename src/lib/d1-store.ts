import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import {
  APP_ORGANIZATION,
  DEFAULT_USER_PASSWORD,
  OFFICE_LOCATION,
  createOfficeEmail,
  validateOfficeDistance,
} from './app-config';
import { emptyToNull, generateInternalEmployeeId, generateQRToken, getTodayString, isLate, normalizeEmail, normalizeEmployeeId } from './utils';

type D1DatabaseLike = {
  exec(query: string): Promise<unknown>;
  prepare(query: string): {
    bind(...values: unknown[]): {
      first<T = Record<string, unknown>>(): Promise<T | null>;
      all<T = Record<string, unknown>>(): Promise<{ results?: T[] }>;
      run(): Promise<unknown>;
    };
    first<T = Record<string, unknown>>(): Promise<T | null>;
    all<T = Record<string, unknown>>(): Promise<{ results?: T[] }>;
    run(): Promise<unknown>;
  };
  batch?(statements: Array<ReturnType<D1DatabaseLike['prepare']> | unknown>): Promise<unknown>;
};

type Role = 'ADMIN' | 'USER';
type AttendanceStatus = 'HADIR' | 'TERLAMBAT';

type D1UserRow = {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: Role;
  is_active: number;
  employee_id?: string | null;
  employee_code?: string | null;
  employee_active?: number | null;
};

type D1EmployeeRow = {
  id: string;
  user_id: string;
  employee_id: string;
  name: string;
  email: string;
  phone: string | null;
  department: string | null;
  position: string | null;
  qr_token: string;
  is_active: number;
  created_at: string;
  updated_at: string;
  user_email?: string;
  user_active?: number;
};

type D1AttendanceRow = {
  id: string;
  user_id: string;
  employee_id: string;
  date: string;
  check_in_time: string;
  status: AttendanceStatus;
  scanned_qr_token: string | null;
  note: string | null;
  latitude?: number | null;
  longitude?: number | null;
  distance_meters?: number | null;
  edited_by_admin_id?: string | null;
  edited_at?: string | null;
  created_at: string;
  updated_at: string;
  employee_code?: string;
  employee_name?: string;
  employee_email?: string;
  employee_department?: string | null;
  employee_position?: string | null;
};

type AttendanceFilters = {
  startDate?: string | null;
  endDate?: string | null;
  name?: string | null;
  employeeId?: string | null;
  department?: string | null;
  status?: string | null;
};

let setupPromise: Promise<void> | null = null;

export async function getD1Database(): Promise<D1DatabaseLike | null> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return ((env as Record<string, unknown>).DB as D1DatabaseLike | undefined) || null;
  } catch {
    return null;
  }
}

export async function getR2Bucket() {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return (env as Record<string, unknown>).ATTENDANCE_R2 || null;
  } catch {
    return null;
  }
}

async function runD1(db: D1DatabaseLike, query: string, values: unknown[] = []) {
  const statement = db.prepare(query);
  return values.length ? statement.bind(...values).run() : statement.run();
}

async function getD1ColumnNames(db: D1DatabaseLike, tableName: string) {
  const result = await db.prepare(`PRAGMA table_info(${tableName})`).all<{ name: string }>();
  return new Set((result.results || []).map((column) => column.name));
}

async function ensureD1Column(db: D1DatabaseLike, tableName: string, columnName: string, definition: string) {
  const columns = await getD1ColumnNames(db, tableName);
  if (columns.has(columnName)) return;
  await runD1(db, `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
}

async function setupD1Schema(db: D1DatabaseLike) {
  const schemaStatements = [
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      employee_id TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT,
      department TEXT,
      position TEXT,
      qr_token TEXT NOT NULL UNIQUE,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS attendances (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      employee_id TEXT NOT NULL,
      date TEXT NOT NULL,
      check_in_time TEXT NOT NULL,
      status TEXT NOT NULL,
      scanned_qr_token TEXT,
      note TEXT,
      latitude REAL,
      longitude REAL,
      distance_meters REAL,
      edited_by_admin_id TEXT,
      edited_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(employee_id, date)
    )`,
    `CREATE TABLE IF NOT EXISTS office_settings (
      id TEXT PRIMARY KEY,
      work_start_time TEXT NOT NULL,
      late_limit_time TEXT NOT NULL,
      company_name TEXT NOT NULL,
      office_lat REAL DEFAULT ${OFFICE_LOCATION.latitude},
      office_lng REAL DEFAULT ${OFFICE_LOCATION.longitude},
      office_radius_meters INTEGER DEFAULT ${OFFICE_LOCATION.radiusMeters},
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    'CREATE INDEX IF NOT EXISTS idx_employees_name ON employees(name)',
    'CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department)',
    'CREATE INDEX IF NOT EXISTS idx_attendances_date ON attendances(date)',
    'CREATE INDEX IF NOT EXISTS idx_attendances_status ON attendances(status)',
  ];

  for (const statement of schemaStatements) {
    await runD1(db, statement);
  }

  await ensureD1Column(db, 'attendances', 'latitude', 'REAL');
  await ensureD1Column(db, 'attendances', 'longitude', 'REAL');
  await ensureD1Column(db, 'attendances', 'distance_meters', 'REAL');
  await ensureD1Column(db, 'attendances', 'edited_by_admin_id', 'TEXT');
  await ensureD1Column(db, 'attendances', 'edited_at', 'TEXT');
  await ensureD1Column(db, 'office_settings', 'office_lat', `REAL DEFAULT ${OFFICE_LOCATION.latitude}`);
  await ensureD1Column(db, 'office_settings', 'office_lng', `REAL DEFAULT ${OFFICE_LOCATION.longitude}`);
  await ensureD1Column(db, 'office_settings', 'office_radius_meters', `INTEGER DEFAULT ${OFFICE_LOCATION.radiusMeters}`);

  await runD1(db, `
    UPDATE office_settings
    SET office_lat = COALESCE(office_lat, ?),
      office_lng = COALESCE(office_lng, ?),
      office_radius_meters = COALESCE(office_radius_meters, ?)
  `, [OFFICE_LOCATION.latitude, OFFICE_LOCATION.longitude, OFFICE_LOCATION.radiusMeters]);

  const existing = await db.prepare('SELECT COUNT(*) AS count FROM users').first<{ count: number }>();
  if (!existing?.count) {
    await seedD1(db);
  }

  const settings = await db.prepare('SELECT id FROM office_settings LIMIT 1').first<{ id: string }>();
  if (!settings) {
    const now = new Date().toISOString();
    await runD1(db, `
      INSERT INTO office_settings (id, work_start_time, late_limit_time, company_name, office_lat, office_lng, office_radius_meters, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      'settings-1',
      '08:00',
      '08:15',
      APP_ORGANIZATION,
      OFFICE_LOCATION.latitude,
      OFFICE_LOCATION.longitude,
      OFFICE_LOCATION.radiusMeters,
      now,
      now,
    ]);
  }
}

async function setupD1(db: D1DatabaseLike) {
  if (!setupPromise) {
    setupPromise = setupD1Schema(db).catch((error) => {
      setupPromise = null;
      throw error;
    });
  }

  await setupPromise;
}

async function seedD1(db: D1DatabaseLike) {
  const now = new Date().toISOString();
  const today = getTodayString();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayDate = getTodayString(yesterday);

  const adminHash = await bcrypt.hash('admin123', 10);
  const userHash = await bcrypt.hash(DEFAULT_USER_PASSWORD, 10);

  const users = [
    ['user-admin', 'Admin Lapas', createOfficeEmail('Admin Lapas'), adminHash, 'ADMIN'],
    ['user-1', 'Budi Santoso', createOfficeEmail('Budi Santoso'), userHash, 'USER'],
    ['user-2', 'Siti Rahayu', createOfficeEmail('Siti Rahayu'), userHash, 'USER'],
    ['user-3', 'Andi Wijaya', createOfficeEmail('Andi Wijaya'), userHash, 'USER'],
  ];

  for (const user of users) {
    await db.prepare(
      'INSERT INTO users (id, name, email, password_hash, role, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)',
    ).bind(...user, now, now).run();
  }

  const employees = [
    ['employee-1', 'user-1', '0001', 'Budi Santoso', createOfficeEmail('Budi Santoso'), '081234567890', null, 'Staff', '11111111-1111-4111-8111-111111111111'],
    ['employee-2', 'user-2', '0002', 'Siti Rahayu', createOfficeEmail('Siti Rahayu'), '081234567891', null, 'Staff', '22222222-2222-4222-8222-222222222222'],
    ['employee-3', 'user-3', '0003', 'Andi Wijaya', createOfficeEmail('Andi Wijaya'), '081234567892', null, 'Staff', '33333333-3333-4333-8333-333333333333'],
  ];

  for (const employee of employees) {
    await db.prepare(
      'INSERT INTO employees (id, user_id, employee_id, name, email, phone, department, position, qr_token, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)',
    ).bind(...employee, now, now).run();
  }

  const attendances = [
    ['attendance-1', 'user-2', 'employee-2', today, `${today}T08:02:00+07:00`, 'HADIR', '22222222-2222-4222-8222-222222222222', null],
    ['attendance-2', 'user-3', 'employee-3', today, `${today}T08:24:00+07:00`, 'TERLAMBAT', '33333333-3333-4333-8333-333333333333', 'Terlambat karena dinas luar'],
    ['attendance-3', 'user-1', 'employee-1', yesterdayDate, `${yesterdayDate}T07:56:00+07:00`, 'HADIR', '11111111-1111-4111-8111-111111111111', null],
  ];

  for (const attendance of attendances) {
    await db.prepare(
      'INSERT INTO attendances (id, user_id, employee_id, date, check_in_time, status, scanned_qr_token, note, latitude, longitude, distance_meters, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ).bind(...attendance, OFFICE_LOCATION.latitude, OFFICE_LOCATION.longitude, 0, now, now).run();
  }

  await db.prepare(
    'INSERT INTO office_settings (id, work_start_time, late_limit_time, company_name, office_lat, office_lng, office_radius_meters, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ).bind(
    'settings-1',
    '08:00',
    '08:15',
    APP_ORGANIZATION,
    OFFICE_LOCATION.latitude,
    OFFICE_LOCATION.longitude,
    OFFICE_LOCATION.radiusMeters,
    now,
    now,
  ).run();
}

function employeeFromRow(row: D1EmployeeRow) {
  return {
    id: row.id,
    userId: row.user_id,
    employeeId: row.employee_id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    department: row.department,
    position: row.position,
    qrToken: row.qr_token,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    user: {
      email: row.user_email || row.email,
      isActive: Boolean(row.user_active ?? row.is_active),
    },
  };
}

function attendanceFromRow(row: D1AttendanceRow) {
  return {
    id: row.id,
    userId: row.user_id,
    employeeId: row.employee_id,
    date: row.date,
    checkInTime: row.check_in_time,
    status: row.status,
    scannedQrToken: row.scanned_qr_token,
    note: row.note,
    latitude: row.latitude,
    longitude: row.longitude,
    distanceMeters: row.distance_meters,
    editedByAdminId: row.edited_by_admin_id,
    editedAt: row.edited_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    employee: {
      id: row.employee_id,
      userId: row.user_id,
      employeeId: row.employee_code || '',
      name: row.employee_name || '',
      email: row.employee_email || '',
      phone: null,
      department: row.employee_department || null,
      position: row.employee_position || null,
      qrToken: '',
      isActive: true,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
  };
}

async function ensureD1() {
  const db = await getD1Database();
  if (!db) return null;
  await setupD1(db);
  return db;
}

export async function findD1UserByCredentials(email: string, password: string) {
  const db = await ensureD1();
  if (!db) return null;

  const user = await db.prepare(`
    SELECT u.*, e.id AS employee_id, e.employee_id AS employee_code, e.is_active AS employee_active
    FROM users u
    LEFT JOIN employees e ON e.user_id = u.id
    WHERE u.email = ?
  `).bind(normalizeEmail(email)).first<D1UserRow>();

  if (!user || !user.is_active) return null;
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: Boolean(user.is_active),
    employee: user.employee_id ? {
      id: user.employee_id,
      employeeId: user.employee_code || '',
      isActive: Boolean(user.employee_active),
    } : undefined,
  };
}

export async function changeD1Password(userId: string, oldPassword: string, newPassword: string) {
  const db = await ensureD1();
  if (!db) return null;
  const user = await db.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first<D1UserRow>();
  if (!user) return { ok: false, error: 'User tidak ditemukan' };
  const valid = await bcrypt.compare(oldPassword, user.password_hash);
  if (!valid) return { ok: false, error: 'Password lama salah' };
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').bind(passwordHash, new Date().toISOString(), userId).run();
  return { ok: true };
}

export async function listD1Employees() {
  const db = await ensureD1();
  if (!db) return null;
  const result = await db.prepare(`
    SELECT e.*, u.email AS user_email, u.is_active AS user_active
    FROM employees e
    JOIN users u ON u.id = e.user_id
    ORDER BY e.created_at DESC
  `).all<D1EmployeeRow>();
  return (result.results || []).map(employeeFromRow);
}

export async function getD1Employee(id: string) {
  const db = await ensureD1();
  if (!db) return null;
  const row = await db.prepare(`
    SELECT e.*, u.email AS user_email, u.is_active AS user_active
    FROM employees e
    JOIN users u ON u.id = e.user_id
    WHERE e.id = ?
  `).bind(id).first<D1EmployeeRow>();
  return row ? employeeFromRow(row) : null;
}

export async function createD1Employee(input: {
  employeeId?: string;
  name: string;
  email?: string;
  password?: string;
  phone?: string;
  department?: string;
  position?: string;
}) {
  const db = await ensureD1();
  if (!db) return null;
  const now = new Date().toISOString();
  const email = normalizeEmail(input.email || createOfficeEmail(input.name));
  const existing = await db.prepare('SELECT id FROM users WHERE email = ? UNION SELECT id FROM employees WHERE email = ?').bind(email, email).first();
  if (existing) throw new Error('Email sudah terdaftar');

  let employeeId = normalizeEmployeeId(input.employeeId) || generateInternalEmployeeId();
  while (await db.prepare('SELECT id FROM employees WHERE employee_id = ?').bind(employeeId).first()) {
    employeeId = generateInternalEmployeeId();
  }

  const userId = `user-${randomUUID()}`;
  const employeeDbId = `employee-${randomUUID()}`;
  const passwordHash = await bcrypt.hash(input.password || DEFAULT_USER_PASSWORD, 10);
  const name = input.name.trim();
  const qrToken = generateQRToken();

  await db.prepare(
    'INSERT INTO users (id, name, email, password_hash, role, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)',
  ).bind(userId, name, email, passwordHash, 'USER', now, now).run();
  await db.prepare(
    'INSERT INTO employees (id, user_id, employee_id, name, email, phone, department, position, qr_token, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)',
  ).bind(employeeDbId, userId, employeeId, name, email, emptyToNull(input.phone), emptyToNull(input.department), emptyToNull(input.position), qrToken, now, now).run();

  return getD1Employee(employeeDbId);
}

export async function updateD1Employee(id: string, input: {
  employeeId?: string;
  name?: string;
  email?: string;
  phone?: string;
  department?: string;
  position?: string;
  isActive?: boolean;
  regenerateQr?: boolean;
}) {
  const db = await ensureD1();
  if (!db) return null;
  const existing = await getD1Employee(id);
  if (!existing) return null;

  const name = input.name?.trim() || existing.name;
  const employeeId = input.employeeId !== undefined ? normalizeEmployeeId(input.employeeId) || generateInternalEmployeeId() : existing.employeeId;
  const email = input.email !== undefined ? normalizeEmail(input.email || existing.email) : existing.email;
  const now = new Date().toISOString();
  const qrToken = input.regenerateQr ? generateQRToken() : existing.qrToken;
  const isActive = input.isActive ?? existing.isActive;

  if (employeeId !== existing.employeeId) {
    const duplicateEmployeeId = await db.prepare('SELECT id FROM employees WHERE employee_id = ? AND id != ?').bind(employeeId, id).first();
    if (duplicateEmployeeId) throw new Error('NIP sudah terdaftar');
  }

  if (email !== existing.email) {
    const duplicateEmail = await db.prepare(`
      SELECT id FROM users WHERE email = ? AND id != ?
      UNION
      SELECT id FROM employees WHERE email = ? AND id != ?
    `).bind(email, existing.userId, email, id).first();
    if (duplicateEmail) throw new Error('Email sudah terdaftar');
  }

  await db.prepare(`
    UPDATE employees
    SET employee_id = ?, name = ?, email = ?, phone = ?, department = ?, position = ?, qr_token = ?, is_active = ?, updated_at = ?
    WHERE id = ?
  `).bind(employeeId, name, email, emptyToNull(input.phone ?? existing.phone), emptyToNull(input.department ?? existing.department), emptyToNull(input.position ?? existing.position), qrToken, isActive ? 1 : 0, now, id).run();
  await db.prepare('UPDATE users SET name = ?, email = ?, is_active = ?, updated_at = ? WHERE id = ?').bind(name, email, isActive ? 1 : 0, now, existing.userId).run();
  return getD1Employee(id);
}

export async function deactivateD1Employee(id: string) {
  const employee = await updateD1Employee(id, { isActive: false });
  return Boolean(employee);
}

export async function deleteD1Employee(id: string) {
  const db = await ensureD1();
  if (!db) return false;
  const existing = await getD1Employee(id);
  if (!existing || existing.isActive) return false;

  await db.prepare('DELETE FROM attendances WHERE employee_id = ? OR user_id = ?').bind(id, existing.userId).run();
  await db.prepare('DELETE FROM employees WHERE id = ?').bind(id).run();
  await db.prepare('DELETE FROM users WHERE id = ?').bind(existing.userId).run();
  return true;
}

export async function upsertImportedD1Employee(input: {
  employeeId?: string;
  name: string;
  email?: string;
  password?: string;
  phone?: string;
  department?: string;
  position?: string;
}) {
  const db = await ensureD1();
  if (!db) return null;
  const existing = input.employeeId
    ? await db.prepare('SELECT id FROM employees WHERE employee_id = ?').bind(input.employeeId).first<{ id: string }>()
    : null;
  if (!existing) {
    await createD1Employee(input);
    return 'created';
  }
  await updateD1Employee(existing.id, {
    employeeId: input.employeeId,
    name: input.name,
    email: input.email,
    phone: input.phone,
    department: input.department,
    position: input.position,
    isActive: true,
  });
  if (input.password) {
    const passwordHash = await bcrypt.hash(input.password, 10);
    await db.prepare(`
      UPDATE users
      SET password_hash = ?, email = ?, updated_at = ?
      WHERE id = (SELECT user_id FROM employees WHERE id = ?)
    `).bind(passwordHash, normalizeEmail(input.email || createOfficeEmail(input.name)), new Date().toISOString(), existing.id).run();
  }
  return 'updated';
}

function buildAttendanceWhere(filters: AttendanceFilters) {
  const clauses: string[] = [];
  const values: unknown[] = [];

  if (filters.startDate) {
    clauses.push('a.date >= ?');
    values.push(filters.startDate);
  }
  if (filters.endDate) {
    clauses.push('a.date <= ?');
    values.push(filters.endDate);
  }
  if (filters.status === 'HADIR' || filters.status === 'TERLAMBAT') {
    clauses.push('a.status = ?');
    values.push(filters.status);
  }
  if (filters.name) {
    clauses.push('LOWER(e.name) LIKE ?');
    values.push(`%${filters.name.toLowerCase()}%`);
  }
  if (filters.employeeId) {
    clauses.push('LOWER(e.employee_id) LIKE ?');
    values.push(`%${filters.employeeId.toLowerCase()}%`);
  }
  if (filters.department) {
    clauses.push('LOWER(COALESCE(e.department, "")) LIKE ?');
    values.push(`%${filters.department.toLowerCase()}%`);
  }

  return {
    where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    values,
  };
}

export async function listD1Attendances(filters: AttendanceFilters = {}, page = 1, limit = 20) {
  const db = await ensureD1();
  if (!db) return null;
  const { where, values } = buildAttendanceWhere(filters);
  const offset = (Math.max(page, 1) - 1) * limit;
  const base = `
    FROM attendances a
    JOIN employees e ON e.id = a.employee_id
    ${where}
  `;
  const data = await db.prepare(`
    SELECT a.*, e.employee_id AS employee_code, e.name AS employee_name, e.email AS employee_email,
      e.department AS employee_department, e.position AS employee_position
    ${base}
    ORDER BY a.check_in_time DESC
    LIMIT ? OFFSET ?
  `).bind(...values, limit, offset).all<D1AttendanceRow>();
  const count = await db.prepare(`SELECT COUNT(*) AS total ${base}`).bind(...values).first<{ total: number }>();
  const total = count?.total || 0;
  return {
    attendances: (data.results || []).map(attendanceFromRow),
    total,
    totalPages: Math.max(Math.ceil(total / limit), 1),
  };
}

export async function exportD1Attendances(filters: AttendanceFilters = {}) {
  const db = await ensureD1();
  if (!db) return null;
  const { where, values } = buildAttendanceWhere(filters);
  const data = await db.prepare(`
    SELECT a.*, e.employee_id AS employee_code, e.name AS employee_name, e.email AS employee_email,
      e.department AS employee_department, e.position AS employee_position
    FROM attendances a
    JOIN employees e ON e.id = a.employee_id
    ${where}
    ORDER BY a.check_in_time DESC
  `).bind(...values).all<D1AttendanceRow>();
  return (data.results || []).map(attendanceFromRow);
}

export async function getD1Attendance(id: string) {
  const db = await ensureD1();
  if (!db) return null;
  const row = await db.prepare(`
    SELECT a.*, e.employee_id AS employee_code, e.name AS employee_name, e.email AS employee_email,
      e.department AS employee_department, e.position AS employee_position
    FROM attendances a
    JOIN employees e ON e.id = a.employee_id
    WHERE a.id = ?
  `).bind(id).first<D1AttendanceRow>();
  return row ? attendanceFromRow(row) : null;
}

export async function updateD1Attendance(id: string, input: {
  date?: string;
  checkInTime?: string;
  status?: AttendanceStatus;
  note?: string;
  editedByAdminId?: string;
}) {
  const db = await ensureD1();
  if (!db) return null;
  const existing = await getD1Attendance(id);
  if (!existing) return null;
  await db.prepare(`
    UPDATE attendances
    SET date = ?, check_in_time = ?, status = ?, note = ?, edited_by_admin_id = ?, edited_at = ?, updated_at = ?
    WHERE id = ?
  `).bind(
    input.date || existing.date,
    input.checkInTime ? new Date(input.checkInTime).toISOString() : existing.checkInTime,
    input.status || existing.status,
    input.note !== undefined ? input.note || null : existing.note,
    input.editedByAdminId || existing.editedByAdminId || null,
    new Date().toISOString(),
    new Date().toISOString(),
    id,
  ).run();
  return getD1Attendance(id);
}

export async function deleteD1Attendance(id: string) {
  const db = await ensureD1();
  if (!db) return null;
  await db.prepare('DELETE FROM attendances WHERE id = ?').bind(id).run();
  return true;
}

export async function getD1TodayAttendance(employeeId: string) {
  const db = await ensureD1();
  if (!db) return null;
  const today = getTodayString();
  const row = await db.prepare(`
    SELECT a.*, e.employee_id AS employee_code, e.name AS employee_name, e.email AS employee_email,
      e.department AS employee_department, e.position AS employee_position
    FROM attendances a
    JOIN employees e ON e.id = a.employee_id
    WHERE a.employee_id = ? AND a.date = ?
  `).bind(employeeId, today).first<D1AttendanceRow>();
  return row ? attendanceFromRow(row) : null;
}

export async function createD1ScanAttendance(session: {
  userId: string;
  employeeId: string;
}, scannedToken: string, location: { latitude?: number; longitude?: number }) {
  const db = await ensureD1();
  if (!db) return null;
  const locationValidation = validateOfficeDistance(location.latitude, location.longitude);
  if (!locationValidation.ok) {
    throw new Error(locationValidation.message);
  }

  const employee = await db.prepare('SELECT * FROM employees WHERE id = ?').bind(session.employeeId).first<D1EmployeeRow>();
  if (!employee || !employee.is_active) throw new Error('Data pegawai tidak aktif atau belum terdaftar');
  if (employee.user_id !== session.userId) throw new Error('Session tidak cocok dengan data pegawai');
  if (employee.qr_token !== scannedToken) throw new Error('QR/barcode tidak cocok dengan pegawai yang sedang login');

  const today = getTodayString();
  const existing = await db.prepare('SELECT id FROM attendances WHERE employee_id = ? AND date = ?').bind(employee.id, today).first();
  if (existing) throw new Error('Anda sudah absen hari ini');

  const settings = await getD1Settings();
  const now = new Date();
  const nowIso = now.toISOString();
  const status = isLate(now, settings?.lateLimitTime || '08:15') ? 'TERLAMBAT' : 'HADIR';
  const attendanceId = `attendance-${randomUUID()}`;

  await db.prepare(`
    INSERT INTO attendances
    (id, user_id, employee_id, date, check_in_time, status, scanned_qr_token, note, latitude, longitude, distance_meters, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?)
  `).bind(
    attendanceId,
    session.userId,
    employee.id,
    today,
    nowIso,
    status,
    scannedToken,
    location.latitude,
    location.longitude,
    locationValidation.distanceMeters,
    nowIso,
    nowIso,
  ).run();

  return getD1Attendance(attendanceId);
}

export async function getD1Settings() {
  const db = await ensureD1();
  if (!db) return null;
  const row = await db.prepare('SELECT * FROM office_settings LIMIT 1').first<{
    id: string;
    work_start_time: string;
    late_limit_time: string;
    company_name: string;
    office_lat: number;
    office_lng: number;
    office_radius_meters: number;
    created_at: string;
    updated_at: string;
  }>();
  if (!row) return null;
  return {
    id: row.id,
    workStartTime: row.work_start_time,
    lateLimitTime: row.late_limit_time,
    companyName: row.company_name,
    officeLat: row.office_lat,
    officeLng: row.office_lng,
    officeRadiusMeters: row.office_radius_meters,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function updateD1Settings(input: {
  workStartTime?: string;
  lateLimitTime?: string;
  companyName?: string;
}) {
  const db = await ensureD1();
  if (!db) return null;
  const current = await getD1Settings();
  if (!current) return null;
  const now = new Date().toISOString();
  await db.prepare(`
    UPDATE office_settings
    SET work_start_time = ?, late_limit_time = ?, company_name = ?, updated_at = ?
    WHERE id = ?
  `).bind(
    input.workStartTime || current.workStartTime,
    input.lateLimitTime || current.lateLimitTime,
    input.companyName || current.companyName,
    now,
    current.id,
  ).run();
  return getD1Settings();
}

export async function getD1DashboardSnapshot() {
  const db = await ensureD1();
  if (!db) return null;
  const today = getTodayString();
  const totalEmployees = await db.prepare('SELECT COUNT(*) AS count FROM employees').first<{ count: number }>();
  const activeEmployees = await db.prepare('SELECT COUNT(*) AS count FROM employees WHERE is_active = 1').first<{ count: number }>();
  const hadirToday = await db.prepare('SELECT COUNT(*) AS count FROM attendances WHERE date = ? AND status = ?').bind(today, 'HADIR').first<{ count: number }>();
  const terlambatToday = await db.prepare('SELECT COUNT(*) AS count FROM attendances WHERE date = ? AND status = ?').bind(today, 'TERLAMBAT').first<{ count: number }>();
  const recent = await exportD1Attendances({});
  const settings = await getD1Settings();

  return {
    totalEmployees: totalEmployees?.count || 0,
    activeEmployees: activeEmployees?.count || 0,
    hadirToday: hadirToday?.count || 0,
    terlambatToday: terlambatToday?.count || 0,
    belumAbsenToday: Math.max((activeEmployees?.count || 0) - (hadirToday?.count || 0) - (terlambatToday?.count || 0), 0),
    recentAttendances: (recent || []).slice(0, 10),
    settings,
  };
}

function countWeekdaysUntilToday(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  let count = 0;
  for (const cursor = new Date(start); cursor <= date; cursor.setDate(cursor.getDate() + 1)) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) count++;
  }
  return count;
}

export async function getD1UserReport(employeeId: string) {
  const db = await ensureD1();
  if (!db) return null;
  const now = new Date();
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const employee = await db.prepare('SELECT qr_token FROM employees WHERE id = ?').bind(employeeId).first<{ qr_token: string }>();
  const result = await db.prepare(`
    SELECT a.*, e.employee_id AS employee_code, e.name AS employee_name, e.email AS employee_email,
      e.department AS employee_department, e.position AS employee_position
    FROM attendances a
    JOIN employees e ON e.id = a.employee_id
    WHERE a.employee_id = ? AND a.date LIKE ?
    ORDER BY a.date DESC, a.check_in_time DESC
  `).bind(employeeId, `${monthPrefix}%`).all<D1AttendanceRow>();
  const attendances = (result.results || []).map(attendanceFromRow);
  const hadir = attendances.filter((item) => item.status === 'HADIR').length;
  const terlambat = attendances.filter((item) => item.status === 'TERLAMBAT').length;
  const workdays = countWeekdaysUntilToday(now);

  return {
    month: monthPrefix,
    hadir,
    terlambat,
    alpha: Math.max(workdays - hadir - terlambat, 0),
    totalRecorded: attendances.length,
    qrToken: employee?.qr_token || null,
    attendances,
  };
}
