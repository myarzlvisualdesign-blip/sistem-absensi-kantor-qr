import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json() as { email: string; password: string };

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email dan password diperlukan' },
        { status: 400 }
      );
    }

    // Demo users - accept these passwords
    const demoUsers = [
      {
        id: 'admin-001',
        email: 'admin@example.com',
        password: 'admin123',
        name: 'Administrator',
        role: 'ADMIN',
      },
      {
        id: 'user-001',
        email: 'user1@example.com',
        password: 'user123',
        name: 'Budi Santoso',
        role: 'USER',
      },
      {
        id: 'user-002',
        email: 'user2@example.com',
        password: 'user123',
        name: 'Siti Rahayu',
        role: 'USER',
      },
      {
        id: 'user-003',
        email: 'user3@example.com',
        password: 'user123',
        name: 'Ahmad Fauzi',
        role: 'USER',
      },
    ];

    const user = demoUsers.find((u) => u.email.toLowerCase() === email.toLowerCase());

    if (!user) {
      return NextResponse.json(
        { error: 'Email atau password salah' },
        { status: 401 }
      );
    }

    if (user.password !== password) {
      return NextResponse.json(
        { error: 'Email atau password salah' },
        { status: 401 }
      );
    }

    const token = Buffer.from(JSON.stringify({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    })).toString('base64');

    const redirectUrl = user.role === 'ADMIN' ? '/admin/dashboard' : '/user/absen';

    const response = NextResponse.json({
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

    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: true, // Cloudflare Pages always uses HTTPS
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days for longer session
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan server' },
      { status: 500 }
    );
  }
}
