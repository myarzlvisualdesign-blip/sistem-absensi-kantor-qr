import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

  await prisma.officeSetting.upsert({
    where: { id: 'default-office-setting' },
    update: {
      workStartTime: '08:00',
      lateLimitTime: '08:15',
      companyName: 'Sistem Absensi Kantor QR',
    },
    create: {
      id: 'default-office-setting',
      workStartTime: '08:00',
      lateLimitTime: '08:15',
      companyName: 'Sistem Absensi Kantor QR',
    },
  });

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: 'Administrator',
      role: 'ADMIN',
      isActive: true,
    },
    create: {
      email: adminEmail,
      passwordHash: await bcrypt.hash(adminPassword, 12),
      name: 'Administrator',
      role: 'ADMIN',
      isActive: true,
    },
  });

  const employees = [
    {
      employeeId: 'EMP-2026-0001',
      email: 'user1@example.com',
      name: 'Budi Santoso',
      phone: '081234567890',
      department: 'IT',
      position: 'Software Engineer',
    },
    {
      employeeId: 'EMP-2026-0002',
      email: 'user2@example.com',
      name: 'Siti Rahayu',
      phone: '081234567891',
      department: 'HRD',
      position: 'HR Manager',
    },
    {
      employeeId: 'EMP-2026-0003',
      email: 'user3@example.com',
      name: 'Ahmad Fauzi',
      phone: '081234567892',
      department: 'Marketing',
      position: 'Marketing Specialist',
    },
  ];

  for (const employeeData of employees) {
    const user = await prisma.user.upsert({
      where: { email: employeeData.email },
      update: {
        name: employeeData.name,
        role: 'USER',
        isActive: true,
      },
      create: {
        email: employeeData.email,
        passwordHash: await bcrypt.hash('user123', 12),
        name: employeeData.name,
        role: 'USER',
        isActive: true,
      },
    });

    await prisma.employee.upsert({
      where: { employeeId: employeeData.employeeId },
      update: {
        userId: user.id,
        name: employeeData.name,
        email: employeeData.email,
        phone: employeeData.phone,
        department: employeeData.department,
        position: employeeData.position,
        isActive: true,
      },
      create: {
        userId: user.id,
        employeeId: employeeData.employeeId,
        name: employeeData.name,
        email: employeeData.email,
        phone: employeeData.phone,
        department: employeeData.department,
        position: employeeData.position,
        qrToken: crypto.randomUUID(),
        isActive: true,
      },
    });
  }

  console.log('Seed selesai');
  console.log(`Admin: ${adminEmail} / ${adminPassword}`);
  console.log('User dummy: user1@example.com, user2@example.com, user3@example.com / user123');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
