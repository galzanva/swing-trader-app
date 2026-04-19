import { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import Navbar from '../components/navbar';
import AlpacaScannerClient from './alpaca-scanner-client';

export const metadata: Metadata = {
  title: 'Alpaca Real-Time Scanner | Trader Journey',
  description: 'Real-time stock scanner powered by Alpaca WebSocket streaming',
};

export default async function AlpacaScannerPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <Navbar session={session} />
      <AlpacaScannerClient />
    </div>
  );
}
