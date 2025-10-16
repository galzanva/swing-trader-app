import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import Navbar from '../../../components/navbar';
import StrategyEditClient from './strategy-edit-client';

export default async function EditStrategyPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login');
  }

  // Await params as required by Next.js 15
  const { id } = await params;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <Navbar session={session} />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <StrategyEditClient 
          strategyId={id} 
          userId={session.user?.id || ''} 
        />
      </main>
    </div>
  );
}
