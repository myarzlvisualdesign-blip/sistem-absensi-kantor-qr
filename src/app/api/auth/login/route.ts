import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/db';
import { createToken, setSessionCookie } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email dan password diperlukan' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Email atau password salah' },
        { status: 401 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: 'Akun tidak aktif. Hubungi administrator.' },
        { status: 403 }
      );
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Email atau password salah' },
        { status: 401 }
      );
    }

    // Get employee data for USER role
    let employeeId: string | undefined;
    let qrToken: string | undefined;

    if (user.role === 'USER') {
      const employee = await prisma.employee.findUnique({
        where: { userId: user.id },
      });

      if (!employee) {
        return NextResponse.json(
          { error: 'Data pegawai tidak ditemukan. Hubungi administrator.' },
          { status: 403 }
        );
      }

      if (!employee.isActive) {
        return NextResponse.json(
          { error: 'Data pegawai tidak aktif. Hubungi administrator.' },
          { status: 403 }
        );
      }

      employeeId = employee.id;
      qrToken = employee.qrToken;
    }

    const token = await createToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role as 'ADMIN' | 'USER',
      employeeId,
      qrToken,
    });

    await setSessionCookie(token);

    const redirectUrl = user.role === 'ADMIN' ? '/admin/dashboard' : '/user/absen';

    return NextResponse.json({
      success: true,
      message: 'Login berhasil',
      redirectUrl,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan server' },
      { status: 500 }
    );
  }
}
