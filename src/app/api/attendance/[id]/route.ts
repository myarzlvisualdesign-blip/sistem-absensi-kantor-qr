import { AttendanceStatus } from '@prisma/client';
import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function toJsonValue<T>(value: T) {
  return JSON.parse(JSON.stringify(value));
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const attendance = await prisma.attendance.findUnique({
      where: { id },
      include: {
        employee: true,
      },
    });

    if (!attendance) {
      return NextResponse.json({ error: 'Data tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json(attendance);
  } catch (error) {
    console.error('Get attendance error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = (await request.json()) as {
      date?: string;
      checkInTime?: string;
      status?: AttendanceStatus;
      note?: string;
    };

    const existingAttendance = await prisma.attendance.findUnique({
      where: { id },
    });

    if (!existingAttendance) {
      return NextResponse.json({ error: 'Data tidak ditemukan' }, { status: 404 });
    }

    if (body.status && !Object.values(AttendanceStatus).includes(body.status)) {
      return NextResponse.json({ error: 'Status absensi tidak valid' }, { status: 400 });
    }

    const attendance = await prisma.attendance.update({
      where: { id },
      data: {
        date: body.date || existingAttendance.date,
        checkInTime: body.checkInTime ? new Date(body.checkInTime) : existingAttendance.checkInTime,
        status: body.status || existingAttendance.status,
        note: body.note !== undefined ? body.note || null : existingAttendance.note,
        editedByAdminId: session.userId,
        editedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        adminUserId: session.userId,
        action: 'UPDATE',
        entityType: 'ATTENDANCE',
        entityId: id,
        oldValue: toJsonValue(existingAttendance),
        newValue: toJsonValue(attendance),
      },
    });

    return NextResponse.json({ success: true, attendance });
  } catch (error) {
    console.error('Update attendance error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const existingAttendance = await prisma.attendance.findUnique({
      where: { id },
    });

    if (!existingAttendance) {
      return NextResponse.json({ error: 'Data tidak ditemukan' }, { status: 404 });
    }

    await prisma.attendance.delete({
      where: { id },
    });

    await prisma.auditLog.create({
      data: {
        adminUserId: session.userId,
        action: 'DELETE',
        entityType: 'ATTENDANCE',
        entityId: id,
        oldValue: toJsonValue(existingAttendance),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete attendance error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
