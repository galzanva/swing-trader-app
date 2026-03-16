import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import TickerHistoryClient from './ticker-history-client';

export default async function TickerHistoryPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/login');
  }

  return <TickerHistoryClient session={session} />;
}
