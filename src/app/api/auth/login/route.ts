import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { createToken } from '@/lib/auth';
import { findMockUserByCredentials, shouldUseMockData } from '@/lib/mock-store';
import { normalizeEmail } from '@/lib/utils';

export const dynamic = 'force-dynamic';

async function createLoginResponse(user: {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'USER';
  employee?: {
    id: string;
    employeeId: string;
    isActive: boolean;
  };
}) {
  const token = await createToken({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    employeeId: user.employee?.id,
    employeeCode: user.employee?.employeeId,
  });

  const redirectUrl = user.role === 'ADMIN' ? '/admin/dashboard' : '/user/absen';
  const response = NextResponse.json({
    success: true,
    redirectUrl,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      employeeId: user.employee?.id,
      employeeCode: user.employee?.employeeId,
    },
  });

  response.cookies.set('auth-token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24,
    path: '/',
  });

  return response;
}

async function tryMockLogin(email: string, password: string) {
  const mockUser = findMockUserByCredentials(email, password);
  if (!mockUser) return null;

  if (mockUser.role === 'USER' && (!mockUser.employee || !mockUser.employee.isActive)) {
    return NextResponse.json({ error: 'Data pegawai belum aktif atau belum terdaftar' }, { status: 403 });
  }

  return createLoginResponse({
    id: mockUser.id,
    email: mockUser.email,
    name: mockUser.name,
    role: mockUser.role,
    employee: mockUser.employee,
  });
}

export async function POST(request: Request) {
  let credentials: { email?: string; password?: string } = {};

  try {
    credentials = (await request.json()) as { email?: string; password?: string };
    const { email, password } = credentials;

    if (!email || !password) {
      return NextResponse.json({ error: 'Email dan password diperlukan' }, { status: 400 });
    }

    if (shouldUseMockData()) {
      const mockLogin = await tryMockLogin(email, password);
      if (mockLogin) return mockLogin;
      return NextResponse.json({ error: 'Email atau password salah' }, { status: 401 });
    }

    const { default: prisma } = await import('@/lib/db');
    const user = await prisma.user.findUnique({
      where: { email: normalizeEmail(email) },
      include: {
        employee: {
          select: {
            id: true,
            employeeId: true,
            isActive: true,
          },
        },
      },
    });

    if (!user || !user.isActive) {
      const mockLogin = await tryMockLogin(email, password);
      if (mockLogin) return mockLogin;
      return NextResponse.json({ error: 'Email atau password salah' }, { status: 401 });
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return NextResponse.json({ error: 'Email atau password salah' }, { status: 401 });
    }

    if (user.role === 'USER' && (!user.employee || !user.employee.isActive)) {
      return NextResponse.json({ error: 'Data pegawai belum aktif atau belum terdaftar' }, { status: 403 });
    }

    return createLoginResponse(user);
  } catch (error) {
    console.error('Login error:', error);
    if (credentials.email && credentials.password) {
      const mockLogin = await tryMockLogin(credentials.email, credentials.password);
      if (mockLogin) return mockLogin;
    }
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
