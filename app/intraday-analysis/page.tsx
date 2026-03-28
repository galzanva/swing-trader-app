import { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import Navbar from '../components/navbar';
import IntradayAnalysisClient from './intraday-analysis-client';

export const metadata: Metadata = {
  title: 'Intraday Analysis | Swing Advisor',
  description: 'Professional intraday analysis with VWAP, EMAs, MACD, FVGs, key levels and AI trading plan',
};

export default async function IntradayAnalysisPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <Navbar session={session} />
      <IntradayAnalysisClient />
    </div>
  );
}
