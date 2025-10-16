import { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import Navbar from '../components/navbar';
import ScannerClient from './scanner-client';

export const metadata: Metadata = {
  title: 'Market Scanner | Swing Advisor',
  description: 'Scan thousands of stocks to find the best matches for your trading strategies',
};

export default async function ScannerPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <Navbar session={session} />
      <ScannerClient />
    </div>
  );
}
