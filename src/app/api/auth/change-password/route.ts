import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { changeD1Password } from '@/lib/d1-store';
import { changeMockPassword } from '@/lib/mock-store';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as {
      oldPassword?: string;
      newPassword?: string;
      confirmPassword?: string;
    };

    if (!body.oldPassword || !body.newPassword || !body.confirmPassword) {
      return NextResponse.json({ error: 'Semua field password wajib diisi' }, { status: 400 });
    }

    if (body.newPassword.length < 6) {
      return NextResponse.json({ error: 'Password baru minimal 6 karakter' }, { status: 400 });
    }

    if (body.newPassword !== body.confirmPassword) {
      return NextResponse.json({ error: 'Konfirmasi password tidak sama' }, { status: 400 });
    }

    const d1Result = await changeD1Password(session.userId, body.oldPassword, body.newPassword);
    const result = d1Result || changeMockPassword(session.userId, body.oldPassword, body.newPassword);

    if (!result.ok) {
      return NextResponse.json({ error: result.error || 'Gagal mengubah password' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Change password error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
