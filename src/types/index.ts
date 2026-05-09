export type Role = 'ADMIN' | 'USER';

export type AttendanceStatus = 'HADIR' | 'TERLAMBAT' | 'BELUM_ABEN';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Employee {
  id: string;
  userId: string;
  employeeId: string;
  name: string;
  email: string;
  phone?: string;
  department?: string;
  position?: string;
  qrToken: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Attendance {
  id: string;
  userId: string;
  employeeId: string;
  date: string;
  checkInTime: Date;
  status: AttendanceStatus;
  scannedQrToken?: string;
  note?: string;
  editedByAdminId?: string;
  editedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  employee?: Employee;
  user?: User;
}

export interface OfficeSetting {
  id: string;
  workStartTime: string;
  lateLimitTime: string;
  companyName: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditLog {
  id: string;
  adminUserId: string;
  action: string;
  entityType: string;
  entityId?: string;
  oldValue?: string;
  newValue?: string;
  createdAt: Date;
}

export interface AttendanceStats {
  totalEmployees: number;
  activeEmployees: number;
  hadirToday: number;
  terlambatToday: number;
  belumAbsenToday: number;
}

export interface AttendanceFilter {
  startDate?: string;
  endDate?: string;
  employeeId?: string;
  name?: string;
  department?: string;
  status?: AttendanceStatus;
}

export interface ImportResult {
  success: number;
  failed: number;
  errors: Array<{ row: number; error: string }>;
}
