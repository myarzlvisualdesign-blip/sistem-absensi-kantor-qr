import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { date, checkInTime, status, note } = body;

    const existingAttendance = await prisma.attendance.findUnique({
      where: { id },
    });

    if (!existingAttendance) {
      return NextResponse.json({ error: 'Data tidak ditemukan' }, { status: 404 });
    }

    const oldValue = JSON.stringify(existingAttendance);

    const attendance = await prisma.attendance.update({
      where: { id },
      data: {
        date: date || existingAttendance.date,
        checkInTime: checkInTime ? new Date(checkInTime) : existingAttendance.checkInTime,
        status: status || existingAttendance.status,
        note: note !== undefined ? note : existingAttendance.note,
        editedByAdminId: session.userId,
        editedAt: new Date(),
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        adminUserId: session.userId,
        action: 'UPDATE',
        entityType: 'ATTENDANCE',
        entityId: id,
        oldValue,
        newValue: JSON.stringify(attendance),
      },
    });

    return NextResponse.json({
      success: true,
      attendance,
    });
  } catch (error) {
    console.error('Update attendance error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
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

    // Create audit log
    await prisma.auditLog.create({
      data: {
        adminUserId: session.userId,
        action: 'DELETE',
        entityType: 'ATTENDANCE',
        entityId: id,
        oldValue: JSON.stringify(existingAttendance),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete attendance error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
