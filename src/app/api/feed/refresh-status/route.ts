import { NextResponse } from 'next/server';
import { getRefreshProgress } from '@/lib/fetching/refresh-progress';

export const dynamic = 'force-dynamic';

export async function GET() {
    return NextResponse.json(getRefreshProgress());
}
