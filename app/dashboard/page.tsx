import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import AppShell from '../components/app-shell';
import DashboardNewClient from '../dashboard-new-client';

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login');
  }

  return (
    <AppShell session={session}>
      <DashboardNewClient session={session} />
    </AppShell>
  );
}
