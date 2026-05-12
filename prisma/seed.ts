import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin.lapas@gmail.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

  await prisma.officeSetting.upsert({
    where: { id: 'default-office-setting' },
    update: {
      workStartTime: '08:00',
      lateLimitTime: '08:15',
      companyName: 'E-ABSENSI LASDAUN',
    },
    create: {
      id: 'default-office-setting',
      workStartTime: '08:00',
      lateLimitTime: '08:15',
      companyName: 'E-ABSENSI LASDAUN',
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
      employeeId: '0001',
      email: 'budi.santoso@gmail.com',
      name: 'Budi Santoso',
      phone: '081234567890',
      department: null,
      position: 'Staff',
    },
    {
      employeeId: '0002',
      email: 'siti.rahayu@gmail.com',
      name: 'Siti Rahayu',
      phone: '081234567891',
      department: null,
      position: 'Staff',
    },
    {
      employeeId: '0003',
      email: 'andi.wijaya@gmail.com',
      name: 'Andi Wijaya',
      phone: '081234567892',
      department: null,
      position: 'Staff',
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
  console.log('User dummy: budi.santoso@gmail.com, siti.rahayu@gmail.com, andi.wijaya@gmail.com / user123');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
