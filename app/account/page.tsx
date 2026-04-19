import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import AppShell from '../components/app-shell';
import AccountClient from '../account/account-client';

export default async function AccountPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login');
  }

  return (
    <AppShell session={session}>
      <AccountClient session={session} />
    </AppShell>
  );
}
