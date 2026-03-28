import { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import Navbar from '../components/navbar';
import DayScannerClient from './day-scanner-client';

export const metadata: Metadata = {
  title: 'Day Trading Scanner | Swing Advisor',
  description: 'Live scanner for high-momentum, low-float stocks with catalysts for intraday trading',
};

export default async function DayScannerPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <Navbar session={session} />
      <DayScannerClient />
    </div>
  );
}
