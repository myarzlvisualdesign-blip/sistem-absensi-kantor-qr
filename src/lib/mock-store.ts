import { randomUUID } from 'crypto';
import { emptyToNull, generateEmployeeId, generateQRToken, getTodayString, isLate, normalizeEmail } from './utils';

export type MockRole = 'ADMIN' | 'USER';
export type MockAttendanceStatus = 'HADIR' | 'TERLAMBAT';

export interface MockUser {
  id: string;
  name: string;
  email: string;
  password: string;
  role: MockRole;
  isActive: boolean;
  employee?: MockEmployee;
}

export interface MockEmployee {
  id: string;
  userId: string;
  employeeId: string;
  name: string;
  email: string;
  phone: string | null;
  department: string | null;
  position: string | null;
  qrToken: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  user?: {
    email: string;
    isActive: boolean;
  };
}

export interface MockAttendance {
  id: string;
  userId: string;
  employeeId: string;
  date: string;
  checkInTime: Date;
  status: MockAttendanceStatus;
  scannedQrToken: string | null;
  note: string | null;
  editedByAdminId?: string | null;
  editedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  employee?: MockEmployee;
}

export interface MockOfficeSetting {
  id: string;
  workStartTime: string;
  lateLimitTime: string;
  companyName: string;
  createdAt: Date;
  updatedAt: Date;
}

interface MockStore {
  users: MockUser[];
  employees: MockEmployee[];
  attendances: MockAttendance[];
  settings: MockOfficeSetting;
}

interface AttendanceFilters {
  startDate?: string | null;
  endDate?: string | null;
  name?: string | null;
  employeeId?: string | null;
  department?: string | null;
  status?: string | null;
}

const globalForMockStore = globalThis as unknown as {
  attendanceMockStore?: MockStore;
};

export function shouldUseMockData(): boolean {
  return process.env.USE_REAL_DATABASE !== 'true';
}

function attachUser(employee: MockEmployee, store: MockStore): MockEmployee {
  const user = store.users.find((item) => item.id === employee.userId);
  return {
    ...employee,
    user: {
      email: user?.email || employee.email,
      isActive: user?.isActive ?? employee.isActive,
    },
  };
}

function attachEmployee(attendance: MockAttendance, store: MockStore): MockAttendance {
  const employee = store.employees.find((item) => item.id === attendance.employeeId);
  return {
    ...attendance,
    employee: employee ? attachUser(employee, store) : undefined,
  };
}

function createInitialStore(): MockStore {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const today = getTodayString(now);
  const yesterdayDate = getTodayString(yesterday);

  const users: MockUser[] = [
    {
      id: 'user-admin',
      name: 'Admin Kantor',
      email: 'admin@example.com',
      password: 'admin123',
      role: 'ADMIN',
      isActive: true,
    },
    {
      id: 'user-1',
      name: 'Budi Santoso',
      email: 'user1@example.com',
      password: 'user123',
      role: 'USER',
      isActive: true,
    },
    {
      id: 'user-2',
      name: 'Siti Rahayu',
      email: 'user2@example.com',
      password: 'user123',
      role: 'USER',
      isActive: true,
    },
    {
      id: 'user-3',
      name: 'Andi Wijaya',
      email: 'user3@example.com',
      password: 'user123',
      role: 'USER',
      isActive: true,
    },
  ];

  const employees: MockEmployee[] = [
    {
      id: 'employee-1',
      userId: 'user-1',
      employeeId: 'EMP-2026-0001',
      name: 'Budi Santoso',
      email: 'user1@example.com',
      phone: '081234567890',
      department: 'IT',
      position: 'Staff IT',
      qrToken: '11111111-1111-4111-8111-111111111111',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'employee-2',
      userId: 'user-2',
      employeeId: 'EMP-2026-0002',
      name: 'Siti Rahayu',
      email: 'user2@example.com',
      phone: '081234567891',
      department: 'HRD',
      position: 'HR Officer',
      qrToken: '22222222-2222-4222-8222-222222222222',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'employee-3',
      userId: 'user-3',
      employeeId: 'EMP-2026-0003',
      name: 'Andi Wijaya',
      email: 'user3@example.com',
      phone: '081234567892',
      department: 'Finance',
      position: 'Finance Staff',
      qrToken: '33333333-3333-4333-8333-333333333333',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
  ];

  users.forEach((user) => {
    user.employee = employees.find((employee) => employee.userId === user.id);
  });

  return {
    users,
    employees,
    attendances: [
      {
        id: 'attendance-1',
        userId: 'user-2',
        employeeId: 'employee-2',
        date: today,
        checkInTime: new Date(`${today}T08:02:00+07:00`),
        status: 'HADIR',
        scannedQrToken: '22222222-2222-4222-8222-222222222222',
        note: null,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'attendance-2',
        userId: 'user-3',
        employeeId: 'employee-3',
        date: today,
        checkInTime: new Date(`${today}T08:24:00+07:00`),
        status: 'TERLAMBAT',
        scannedQrToken: '33333333-3333-4333-8333-333333333333',
        note: 'Terlambat karena meeting luar',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'attendance-3',
        userId: 'user-1',
        employeeId: 'employee-1',
        date: yesterdayDate,
        checkInTime: new Date(`${yesterdayDate}T07:56:00+07:00`),
        status: 'HADIR',
        scannedQrToken: '11111111-1111-4111-8111-111111111111',
        note: null,
        createdAt: yesterday,
        updatedAt: yesterday,
      },
    ],
    settings: {
      id: 'settings-1',
      workStartTime: '08:00',
      lateLimitTime: '08:15',
      companyName: 'PT. Contoh Indonesia',
      createdAt: now,
      updatedAt: now,
    },
  };
}

export function getMockStore(): MockStore {
  if (!globalForMockStore.attendanceMockStore) {
    globalForMockStore.attendanceMockStore = createInitialStore();
  }
  return globalForMockStore.attendanceMockStore;
}

export function findMockUserByCredentials(email: string, password: string): MockUser | null {
  const store = getMockStore();
  const user = store.users.find((item) => item.email === normalizeEmail(email));
  if (!user || !user.isActive || user.password !== password) return null;
  const employee = store.employees.find((item) => item.userId === user.id);
  return {
    ...user,
    employee,
  };
}

export function listMockEmployees(): MockEmployee[] {
  const store = getMockStore();
  return [...store.employees]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((employee) => attachUser(employee, store));
}

export function getMockEmployee(id: string): MockEmployee | null {
  const store = getMockStore();
  const employee = store.employees.find((item) => item.id === id);
  return employee ? attachUser(employee, store) : null;
}

export function createMockEmployee(input: {
  employeeId?: string;
  name: string;
  email: string;
  password: string;
  phone?: string;
  department?: string;
  position?: string;
}): MockEmployee {
  const store = getMockStore();
  const email = normalizeEmail(input.email);
  let employeeId = input.employeeId?.trim() || generateEmployeeId();

  while (store.employees.some((employee) => employee.employeeId === employeeId)) {
    employeeId = generateEmployeeId();
  }

  if (store.users.some((user) => user.email === email) || store.employees.some((employee) => employee.email === email)) {
    throw new Error('Email sudah terdaftar');
  }

  const now = new Date();
  const userId = `user-${randomUUID()}`;
  const employee: MockEmployee = {
    id: `employee-${randomUUID()}`,
    userId,
    employeeId,
    name: input.name.trim(),
    email,
    phone: emptyToNull(input.phone),
    department: emptyToNull(input.department),
    position: emptyToNull(input.position),
    qrToken: generateQRToken(),
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };

  store.users.push({
    id: userId,
    name: employee.name,
    email,
    password: input.password,
    role: 'USER',
    isActive: true,
    employee,
  });
  store.employees.unshift(employee);
  return attachUser(employee, store);
}

export function updateMockEmployee(id: string, input: {
  name?: string;
  phone?: string;
  department?: string;
  position?: string;
  isActive?: boolean;
  regenerateQr?: boolean;
}): MockEmployee | null {
  const store = getMockStore();
  const employee = store.employees.find((item) => item.id === id);
  if (!employee) return null;

  const name = input.name?.trim() || employee.name;
  employee.name = name;
  employee.phone = input.phone !== undefined ? emptyToNull(input.phone) : employee.phone;
  employee.department = input.department !== undefined ? emptyToNull(input.department) : employee.department;
  employee.position = input.position !== undefined ? emptyToNull(input.position) : employee.position;
  employee.isActive = input.isActive ?? employee.isActive;
  employee.qrToken = input.regenerateQr ? generateQRToken() : employee.qrToken;
  employee.updatedAt = new Date();

  const user = store.users.find((item) => item.id === employee.userId);
  if (user) {
    user.name = name;
    user.isActive = employee.isActive;
    user.employee = employee;
  }

  return attachUser(employee, store);
}

export function deactivateMockEmployee(id: string): boolean {
  const employee = updateMockEmployee(id, { isActive: false });
  return Boolean(employee);
}

export function upsertImportedMockEmployee(input: {
  employeeId?: string;
  name: string;
  email: string;
  password?: string;
  phone?: string;
  department?: string;
  position?: string;
}): 'created' | 'updated' {
  const store = getMockStore();
  const email = normalizeEmail(input.email);
  const employeeById = input.employeeId
    ? store.employees.find((employee) => employee.employeeId === input.employeeId)
    : undefined;

  if (employeeById) {
    employeeById.name = input.name;
    employeeById.email = email;
    employeeById.phone = emptyToNull(input.phone);
    employeeById.department = emptyToNull(input.department);
    employeeById.position = emptyToNull(input.position);
    employeeById.isActive = true;
    employeeById.updatedAt = new Date();

    const user = store.users.find((item) => item.id === employeeById.userId);
    if (user) {
      user.name = input.name;
      user.email = email;
      user.isActive = true;
      user.password = input.password || user.password;
      user.employee = employeeById;
    }
    return 'updated';
  }

  createMockEmployee({
    employeeId: input.employeeId,
    name: input.name,
    email,
    password: input.password || 'user123',
    phone: input.phone,
    department: input.department,
    position: input.position,
  });
  return 'created';
}

function filterAttendances(filters: AttendanceFilters): MockAttendance[] {
  const store = getMockStore();
  return store.attendances
    .map((attendance) => attachEmployee(attendance, store))
    .filter((attendance) => {
      const employee = attendance.employee;
      if (filters.startDate && attendance.date < filters.startDate) return false;
      if (filters.endDate && attendance.date > filters.endDate) return false;
      if (filters.status && attendance.status !== filters.status) return false;
      if (filters.name && !employee?.name.toLowerCase().includes(filters.name.toLowerCase())) return false;
      if (filters.employeeId && !employee?.employeeId.toLowerCase().includes(filters.employeeId.toLowerCase())) return false;
      if (filters.department && !employee?.department?.toLowerCase().includes(filters.department.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => b.checkInTime.getTime() - a.checkInTime.getTime());
}

export function listMockAttendances(filters: AttendanceFilters = {}, page = 1, limit = 20) {
  const attendances = filterAttendances(filters);
  const total = attendances.length;
  const totalPages = Math.max(Math.ceil(total / limit), 1);
  const start = (Math.max(page, 1) - 1) * limit;
  return {
    attendances: attendances.slice(start, start + limit),
    total,
    totalPages,
  };
}

export function exportMockAttendances(filters: AttendanceFilters = {}): MockAttendance[] {
  return filterAttendances(filters);
}

export function getMockAttendance(id: string): MockAttendance | null {
  const store = getMockStore();
  const attendance = store.attendances.find((item) => item.id === id);
  return attendance ? attachEmployee(attendance, store) : null;
}

export function updateMockAttendance(id: string, input: {
  date?: string;
  checkInTime?: string;
  status?: MockAttendanceStatus;
  note?: string;
  editedByAdminId?: string;
}): MockAttendance | null {
  const store = getMockStore();
  const attendance = store.attendances.find((item) => item.id === id);
  if (!attendance) return null;

  attendance.date = input.date || attendance.date;
  attendance.checkInTime = input.checkInTime ? new Date(input.checkInTime) : attendance.checkInTime;
  attendance.status = input.status || attendance.status;
  attendance.note = input.note !== undefined ? input.note || null : attendance.note;
  attendance.editedByAdminId = input.editedByAdminId || attendance.editedByAdminId;
  attendance.editedAt = new Date();
  attendance.updatedAt = new Date();
  return attachEmployee(attendance, store);
}

export function deleteMockAttendance(id: string): boolean {
  const store = getMockStore();
  const before = store.attendances.length;
  store.attendances = store.attendances.filter((attendance) => attendance.id !== id);
  return store.attendances.length !== before;
}

export function getMockTodayAttendance(employeeId: string): MockAttendance | null {
  const store = getMockStore();
  const today = getTodayString();
  const attendance = store.attendances.find((item) => item.employeeId === employeeId && item.date === today);
  return attendance ? attachEmployee(attendance, store) : null;
}

export function createMockScanAttendance(session: {
  userId: string;
  employeeId: string;
}, scannedToken: string): MockAttendance {
  const store = getMockStore();
  const employee = store.employees.find((item) => item.id === session.employeeId);
  if (!employee || !employee.isActive) {
    throw new Error('Data pegawai tidak aktif atau belum terdaftar');
  }
  if (employee.userId !== session.userId) {
    throw new Error('Session tidak cocok dengan data pegawai');
  }
  if (employee.qrToken !== scannedToken) {
    throw new Error('QR/barcode tidak cocok dengan pegawai yang sedang login');
  }

  const existingAttendance = getMockTodayAttendance(employee.id);
  if (existingAttendance) {
    throw new Error('Anda sudah absen hari ini');
  }

  const now = new Date();
  const status = isLate(now, store.settings.lateLimitTime) ? 'TERLAMBAT' : 'HADIR';
  const attendance: MockAttendance = {
    id: `attendance-${randomUUID()}`,
    userId: session.userId,
    employeeId: employee.id,
    date: getTodayString(now),
    checkInTime: now,
    status,
    scannedQrToken: scannedToken,
    note: null,
    createdAt: now,
    updatedAt: now,
  };
  store.attendances.unshift(attendance);
  return attachEmployee(attendance, store);
}

export function getMockSettings(): MockOfficeSetting {
  return getMockStore().settings;
}

export function updateMockSettings(input: {
  workStartTime?: string;
  lateLimitTime?: string;
  companyName?: string;
}): MockOfficeSetting {
  const store = getMockStore();
  store.settings = {
    ...store.settings,
    workStartTime: input.workStartTime || store.settings.workStartTime,
    lateLimitTime: input.lateLimitTime || store.settings.lateLimitTime,
    companyName: input.companyName || store.settings.companyName,
    updatedAt: new Date(),
  };
  return store.settings;
}

export function getMockDashboardSnapshot() {
  const store = getMockStore();
  const today = getTodayString();
  const activeEmployees = store.employees.filter((employee) => employee.isActive).length;
  const hadirToday = store.attendances.filter((attendance) => attendance.date === today && attendance.status === 'HADIR').length;
  const terlambatToday = store.attendances.filter((attendance) => attendance.date === today && attendance.status === 'TERLAMBAT').length;

  return {
    totalEmployees: store.employees.length,
    activeEmployees,
    hadirToday,
    terlambatToday,
    belumAbsenToday: Math.max(activeEmployees - hadirToday - terlambatToday, 0),
    recentAttendances: exportMockAttendances({}).slice(0, 10),
    settings: store.settings,
  };
}
