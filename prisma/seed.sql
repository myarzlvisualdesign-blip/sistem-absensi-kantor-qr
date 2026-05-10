-- Admin user (password: admin123)
INSERT INTO User (id, email, password, name, role, isActive) VALUES ('admin-001', 'admin@example.com', '$2a$10$K7J1bVGJ3Z5Yv1R5C5X8KO2Z9Y4Q7Z1R5C5X8KO2Z9Y4Q7Z1R5C5X8KO', 'Administrator', 'ADMIN', 1);

-- Regular users
INSERT INTO User (id, email, password, name, role, isActive) VALUES ('user-001', 'user1@example.com', '$2a$10$K7J1bVGJ3Z5Yv1R5C5X8KO2Z9Y4Q7Z1R5C5X8KO2Z9Y4Q7Z1R5C5X8KO', 'Budi Santoso', 'USER', 1);
INSERT INTO User (id, email, password, name, role, isActive) VALUES ('user-002', 'user2@example.com', '$2a$10$K7J1bVGJ3Z5Yv1R5C5X8KO2Z9Y4Q7Z1R5C5X8KO2Z9Y4Q7Z1R5C5X8KO', 'Siti Rahayu', 'USER', 1);
INSERT INTO User (id, email, password, name, role, isActive) VALUES ('user-003', 'user3@example.com', '$2a$10$K7J1bVGJ3Z5Yv1R5C5X8KO2Z9Y4Q7Z1R5C5X8KO2Z9Y4Q7Z1R5C5X8KO', 'Ahmad Fauzi', 'USER', 1);

-- Employees
INSERT INTO Employee (id, userId, employeeId, name, email, phone, department, position, qrToken, isActive) VALUES ('emp-001', 'user-001', 'EMP-2024-0001', 'Budi Santoso', 'user1@example.com', '081234567890', 'IT', 'Software Engineer', 'qr-budi-12345678', 1);
INSERT INTO Employee (id, userId, employeeId, name, email, phone, department, position, qrToken, isActive) VALUES ('emp-002', 'user-002', 'EMP-2024-0002', 'Siti Rahayu', 'user2@example.com', '081234567891', 'HRD', 'HR Manager', 'qr-siti-12345678', 1);
INSERT INTO Employee (id, userId, employeeId, name, email, phone, department, position, qrToken, isActive) VALUES ('emp-003', 'user-003', 'EMP-2024-0003', 'Ahmad Fauzi', 'user3@example.com', '081234567892', 'Marketing', 'Marketing Specialist', 'qr-ahmad-12345678', 1);

-- Office Settings
INSERT INTO OfficeSetting (id, workStartTime, lateLimitTime, companyName) VALUES ('setting-001', '08:00', '08:15', 'PT. Contoh Indonesia');
