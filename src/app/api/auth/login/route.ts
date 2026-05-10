import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { createToken } from '@/lib/auth';
import prisma from '@/lib/db';
import { normalizeEmail } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { email, password } = (await request.json()) as { email?: string; password?: string };

    if (!email || !password) {
      return NextResponse.json({ error: 'Email dan password diperlukan' }, { status: 400 });
    }

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
      return NextResponse.json({ error: 'Email atau password salah' }, { status: 401 });
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return NextResponse.json({ error: 'Email atau password salah' }, { status: 401 });
    }

    if (user.role === 'USER' && (!user.employee || !user.employee.isActive)) {
      return NextResponse.json({ error: 'Data pegawai belum aktif atau belum terdaftar' }, { status: 403 });
    }

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
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
