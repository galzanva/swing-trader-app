import { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import AppShell from '../../../components/app-shell';
import AccountDetailClient from '../../[id]/account-detail-client';

export const metadata: Metadata = {
  title: 'Account | Trader Journey',
  description: 'Prop firm eval or payout log',
};

export default async function FirmLogPage({
  params,
  searchParams,
}: {
  params: Promise<{ firmSlug: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  const { firmSlug } = await params;
  const { view } = await searchParams;

  return (
    <AppShell session={session}>
      <AccountDetailClient firmSlug={firmSlug} view={view === 'payout' ? 'payout' : 'eval'} />
    </AppShell>
  );
}
