import { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import AppShell from '../components/app-shell';
import AlpacaScannerClient from './alpaca-scanner-client';

export const metadata: Metadata = {
  title: 'Alpaca Real-Time Scanner | Trader Journey',
  description: 'Real-time stock scanner powered by Alpaca WebSocket streaming',
};

export default async function AlpacaScannerPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login');
  }

  return (
    <AppShell session={session}>
      <AlpacaScannerClient />
    </AppShell>
  );
}
