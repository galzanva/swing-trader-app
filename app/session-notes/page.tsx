import { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import AppShell from '../components/app-shell';
import SessionNotesClient from './session-notes-client';

export const metadata: Metadata = {
  title: 'Session Notes | Trader Journey',
  description: 'Intraday notes and strategy checklists to paste into Claude',
};

export default async function SessionNotesPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  return (
    <AppShell session={session}>
      <SessionNotesClient />
    </AppShell>
  );
}
