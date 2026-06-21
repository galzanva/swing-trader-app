import { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import AppShell from '../components/app-shell';
import AccountsClient from './accounts-client';

export const metadata: Metadata = {
  title: 'Accounts | Trader Journey',
  description: 'Manage your broker and trading accounts',
};

export default async function AccountsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  return (
    <AppShell session={session}>
      <AccountsClient />
    </AppShell>
  );
}
