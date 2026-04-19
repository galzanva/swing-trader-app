import { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import AppShell from '../components/app-shell';
import StrategiesClient from './strategies-client';

export const metadata: Metadata = {
  title: 'Strategies | Trader Journey',
  description: 'Manage your trading strategies',
};

export default async function StrategiesPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  return (
    <AppShell session={session}>
      <StrategiesClient />
    </AppShell>
  );
}
