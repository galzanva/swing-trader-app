import { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import AppShell from '../components/app-shell';
import WebullTradesClient from './webull-trades-client';

export const metadata: Metadata = {
  title: 'Webull Trade Sync | Trader Journey',
  description: 'Import trades from your Webull account into your trading journal',
};

export default async function WebullTradesPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  return (
    <AppShell session={session}>
      <WebullTradesClient />
    </AppShell>
  );
}
