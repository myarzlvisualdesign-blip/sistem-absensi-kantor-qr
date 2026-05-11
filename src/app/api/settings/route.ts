import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getMockSettings, shouldUseMockData, updateMockSettings } from '@/lib/mock-store';

export const dynamic = 'force-dynamic';

function toJsonValue<T>(value: T) {
  return JSON.parse(JSON.stringify(value));
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (shouldUseMockData()) {
      return NextResponse.json(getMockSettings());
    }

    const { default: prisma } = await import('@/lib/db');
    let settings = await prisma.officeSetting.findFirst();

    if (!settings) {
      settings = await prisma.officeSetting.create({
        data: {
          workStartTime: '08:00',
          lateLimitTime: '08:15',
          companyName: 'PT. Contoh Indonesia',
        },
      });
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Get settings error:', error);
    return NextResponse.json(getMockSettings());
  }
}

export async function PUT(request: Request) {
  let body: { workStartTime?: string; lateLimitTime?: string; companyName?: string } = {};

  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    body = await request.json() as typeof body;
    const { workStartTime, lateLimitTime, companyName } = body;

    if (shouldUseMockData()) {
      return NextResponse.json(updateMockSettings(body));
    }

    const { default: prisma } = await import('@/lib/db');
    let settings = await prisma.officeSetting.findFirst();
    const oldValue = toJsonValue(settings);

    if (!settings) {
      settings = await prisma.officeSetting.create({
        data: {
          workStartTime: workStartTime || '08:00',
          lateLimitTime: lateLimitTime || '08:15',
          companyName: companyName || 'PT. Contoh Indonesia',
        },
      });
    } else {
      settings = await prisma.officeSetting.update({
        where: { id: settings.id },
        data: {
          workStartTime: workStartTime || settings.workStartTime,
          lateLimitTime: lateLimitTime || settings.lateLimitTime,
          companyName: companyName || settings.companyName,
        },
      });
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        adminUserId: session.userId,
        action: 'UPDATE',
        entityType: 'SETTINGS',
        oldValue,
        newValue: toJsonValue(settings),
      },
    });

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Update settings error:', error);
    return NextResponse.json(updateMockSettings(body));
  }
}
