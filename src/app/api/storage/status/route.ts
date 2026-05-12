import { NextResponse } from 'next/server';
import { getD1Database, getR2Bucket } from '@/lib/d1-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const [db, bucket] = await Promise.all([
    getD1Database(),
    getR2Bucket(),
  ]);

  return NextResponse.json({
    d1: Boolean(db),
    r2: Boolean(bucket),
  });
}
