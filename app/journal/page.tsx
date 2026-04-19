import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AppShell from '../components/app-shell';
import JournalClient from './journal-client';

export default async function JournalPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/login');
  }

  return (
    <AppShell session={session}>
      <JournalClient session={session} />
    </AppShell>
  );
}
