import { PrismaClient } from '@prisma/client';
import { PrismaD1 } from '@prisma/adapter-d1';

declare global {
  interface CloudflareEnv {
    absensi_db: D1Database;
  }
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export function createPrismaClient(env: CloudflareEnv | Record<string, any>) {
  if (env?.absensi_db) {
    const adapter = new PrismaD1(env.absensi_db);
    return new PrismaClient({ adapter } as any);
  }
  return new PrismaClient();
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient({});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;