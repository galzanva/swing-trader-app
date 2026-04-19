import { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import Navbar from '../components/navbar';
import AnalyticsClient from './analytics-client';

export const metadata: Metadata = {
  title: 'Trade Analytics | Trader Journey',
  description: 'Detailed trading performance analytics and reports',
};

export default async function AnalyticsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <Navbar session={session} />
      <AnalyticsClient />
    </div>
  );
}
