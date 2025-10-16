import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import Navbar from '../components/navbar';

export default async function ScannerPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <Navbar session={session} />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 shadow-2xl">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Market Scanner</h1>
              <p className="text-blue-200">
                Scan the market for the best swing trading setups based on your criteria
              </p>
            </div>
            <div className="px-4 py-2 rounded-full bg-teal-500/20 text-teal-300 text-sm font-medium border border-teal-500/30">
              Coming Soon
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="p-6 rounded-xl bg-white/5 border border-white/10">
              <div className="text-3xl mb-3">🎯</div>
              <h3 className="text-white font-semibold mb-2">Pattern Detection</h3>
              <p className="text-sm text-blue-200">
                Find bullish and bearish patterns across multiple timeframes
              </p>
            </div>
            <div className="p-6 rounded-xl bg-white/5 border border-white/10">
              <div className="text-3xl mb-3">📈</div>
              <h3 className="text-white font-semibold mb-2">Technical Analysis</h3>
              <p className="text-sm text-blue-200">
                Automated EMA, RSI, and momentum screening
              </p>
            </div>
            <div className="p-6 rounded-xl bg-white/5 border border-white/10">
              <div className="text-3xl mb-3">⚡</div>
              <h3 className="text-white font-semibold mb-2">Real-Time Alerts</h3>
              <p className="text-sm text-blue-200">
                Get notified when new setups match your criteria
              </p>
            </div>
          </div>

          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-6">
            <h3 className="text-blue-200 font-semibold mb-2">🚀 Coming in Next Update</h3>
            <p className="text-blue-100">
              The Market Scanner will allow you to scan thousands of tickers in seconds,
              filtering by your custom strategies, technical indicators, and risk criteria.
              Stay tuned!
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
