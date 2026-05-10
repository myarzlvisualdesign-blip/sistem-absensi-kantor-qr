import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ['@prisma/client', 'bcryptjs', 'qrcode', 'xlsx'],
};

export default nextConfig;
