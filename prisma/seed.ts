import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  // Create office settings
  const existingSettings = await prisma.officeSetting.findFirst();
  if (!existingSettings) {
    await prisma.officeSetting.create({
      data: {
        workStartTime: '08:00',
        lateLimitTime: '08:15',
        companyName: 'PT. Contoh Indonesia',
      },
    });
    console.log('Created office settings');
  }

  // Create admin user
  const adminExists = await prisma.user.findUnique({
    where: { email: 'admin@example.com' },
  });

  if (!adminExists) {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await prisma.user.create({
      data: {
        email: 'admin@example.com',
        password: hashedPassword,
        name: 'Administrator',
        role: 'ADMIN',
        isActive: true,
      },
    });
    console.log('Created admin user: admin@example.com / admin123');
  }

  // Create dummy employees
  const dummyUsers = [
    { email: 'user1@example.com', name: 'Budi Santoso', department: 'IT', position: 'Software Engineer' },
    { email: 'user2@example.com', name: 'Siti Rahayu', department: 'HRD', position: 'HR Manager' },
    { email: 'user3@example.com', name: 'Ahmad Fauzi', department: 'Marketing', position: 'Marketing Specialist' },
  ];

  for (const userData of dummyUsers) {
    const userExists = await prisma.user.findUnique({
      where: { email: userData.email },
    });

    if (!userExists) {
      const hashedPassword = await bcrypt.hash('user123', 10);
      const qrToken = generateQRToken();

      const user = await prisma.user.create({
        data: {
          email: userData.email,
          password: hashedPassword,
          name: userData.name,
          role: 'USER',
          isActive: true,
        },
      });

      await prisma.employee.create({
        data: {
          userId: user.id,
          employeeId: generateEmployeeId(),
          name: userData.name,
          email: userData.email,
          phone: '08' + Math.floor(Math.random() * 100000000).toString().padStart(8, '0'),
          department: userData.department,
          position: userData.position,
          qrToken: qrToken,
          isActive: true,
        },
      });

      console.log(`Created user: ${userData.email} / user123`);
    }
  }

  console.log('Seed completed!');
}

function generateQRToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateEmployeeId(): string {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `EMP-${year}-${random}`;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
