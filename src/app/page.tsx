'use client';

import { DashboardClient } from '@/components/dashboard/DashboardClient';

export const dynamic = 'force-dynamic';

// Client-side only - data fetching happens in DashboardClient via SWR
export default function Dashboard() {
  return <DashboardClient initialItems={[]} />;
}
