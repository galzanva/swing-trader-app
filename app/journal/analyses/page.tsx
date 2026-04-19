import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AppShell from '../../components/app-shell';
import AnalysesClient from './analyses-client';

export default async function AnalysesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect('/login');
  }

  return (
    <AppShell session={session}>
      <AnalysesClient session={session} />
    </AppShell>
  );
}
