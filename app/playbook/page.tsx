import { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import AppShell from '../components/app-shell';
import PlaybookClient from './playbook-client';

export const metadata: Metadata = {
  title: 'Playbook | Trader Journey',
  description: 'Daily rules checklist and how it lines up with P/L',
};

export default async function PlaybookPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  return (
    <AppShell session={session}>
      <PlaybookClient />
    </AppShell>
  );
}
