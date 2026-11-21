import { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import AppShell from '../../components/app-shell';
import AccountDetailClient from './account-detail-client';

export const metadata: Metadata = {
  title: 'Account | Trader Journey',
  description: 'Account totals and eval log',
};

export default async function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  const { id } = await params;

  return (
    <AppShell session={session}>
      <AccountDetailClient accountId={id} />
    </AppShell>
  );
}
