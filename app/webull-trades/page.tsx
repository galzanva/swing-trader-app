import { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import Navbar from '../components/navbar';
import WebullTradesClient from './webull-trades-client';

export const metadata: Metadata = {
  title: 'Webull Trade Sync | Trader Journey',
  description: 'Import trades from your Webull account into your trading journal',
};

export default async function WebullTradesPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <Navbar session={session} />
      <WebullTradesClient />
    </div>
  );
}
