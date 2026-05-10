CREATE TABLE IF NOT EXISTS User (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'USER',
  isActive INTEGER DEFAULT 1,
  createdAt TEXT DEFAULT (datetime('now')),
  updatedAt TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS Employee (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  userId TEXT UNIQUE NOT NULL,
  employeeId TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  department TEXT,
  position TEXT,
  qrToken TEXT UNIQUE NOT NULL,
  isActive INTEGER DEFAULT 1,
  createdAt TEXT DEFAULT (datetime('now')),
  updatedAt TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS Attendance (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  userId TEXT NOT NULL,
  employeeId TEXT NOT NULL,
  date TEXT NOT NULL,
  checkInTime TEXT DEFAULT (datetime('now')),
  status TEXT NOT NULL,
  scannedQrToken TEXT,
  note TEXT,
  editedByAdminId TEXT,
  editedAt TEXT,
  createdAt TEXT DEFAULT (datetime('now')),
  updatedAt TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS OfficeSetting (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  workStartTime TEXT DEFAULT '08:00',
  lateLimitTime TEXT DEFAULT '08:15',
  companyName TEXT DEFAULT 'PT. Contoh Indonesia',
  createdAt TEXT DEFAULT (datetime('now')),
  updatedAt TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS AuditLog (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  adminUserId TEXT NOT NULL,
  action TEXT NOT NULL,
  entityType TEXT NOT NULL,
  entityId TEXT,
  oldValue TEXT,
  newValue TEXT,
  createdAt TEXT DEFAULT (datetime('now'))
);
