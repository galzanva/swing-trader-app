import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import AppShell from '../components/app-shell';
import TradeCalculatorClient from './trade-calculator-client';

export default async function TradeCalculatorPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login');
  }

  return (
    <AppShell session={session}>
      <TradeCalculatorClient />
    </AppShell>
  );
}
