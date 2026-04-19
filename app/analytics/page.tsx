import { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import AppShell from '../components/app-shell';
import AnalyticsClient from './analytics-client';

export const metadata: Metadata = {
  title: 'Trade Analytics | Trader Journey',
  description: 'Detailed trading performance analytics and reports',
};

export default async function AnalyticsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  return (
    <AppShell session={session}>
      <AnalyticsClient />
    </AppShell>
  );
}
