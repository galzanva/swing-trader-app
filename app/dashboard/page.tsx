import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import Navbar from '../components/navbar';
import StrategyAnalyzeClient from '../strategy-analyze-client';

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <Navbar session={session} />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <StrategyAnalyzeClient />
      </main>

      {/* Principles Footer */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-6 border border-white/10">
          <h3 className="text-xl font-bold text-white mb-4">Our Principles</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <h4 className="text-teal-300 font-semibold mb-2">✨ Transparency</h4>
              <p className="text-blue-200 text-sm">
                Every signal shows exactly why it qualifies—no black boxes, just facts.
              </p>
            </div>
            <div>
              <h4 className="text-teal-300 font-semibold mb-2">📊 Data-Driven</h4>
              <p className="text-blue-200 text-sm">
                Decisions backed by real market data, technical indicators, and historical patterns.
              </p>
            </div>
            <div>
              <h4 className="text-teal-300 font-semibold mb-2">🎯 Precision</h4>
              <p className="text-blue-200 text-sm">
                Multi-bar confirmations and strict criteria ensure high-quality setups only.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
