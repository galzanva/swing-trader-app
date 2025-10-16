import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import Navbar from '../components/navbar';
import Link from 'next/link';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function StrategiesPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login');
  }

  // Get custom strategies count
  const customStrategiesCount = await prisma.userStrategy.count({
    where: { userId: session.user!.id },
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <Navbar session={session} />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Strategies</h1>
          <p className="text-blue-200">
            Create and manage your custom trading strategies
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Strategy Builder Card */}
          <Link href="/strategies/builder">
            <div className="bg-gradient-to-br from-purple-600/20 to-pink-600/20 backdrop-blur-lg rounded-xl p-8 border border-purple-500/30 hover:border-purple-500/50 transition-all cursor-pointer group shadow-xl hover:shadow-purple-500/20">
              <div className="text-5xl mb-4 group-hover:scale-110 transition-transform">🛠️</div>
              <h2 className="text-2xl font-bold text-white mb-3">Strategy Builder</h2>
              <p className="text-blue-200 mb-4">
                Create new trading strategies from plain English descriptions using AI
              </p>
              <div className="flex items-center text-purple-300 font-medium">
                Build New Strategy
                <svg className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </Link>

          {/* Manage Strategies Card */}
          <Link href="/strategies/manage">
            <div className="bg-gradient-to-br from-teal-600/20 to-blue-600/20 backdrop-blur-lg rounded-xl p-8 border border-teal-500/30 hover:border-teal-500/50 transition-all cursor-pointer group shadow-xl hover:shadow-teal-500/20">
              <div className="text-5xl mb-4 group-hover:scale-110 transition-transform">📋</div>
              <h2 className="text-2xl font-bold text-white mb-3">Manage Strategies</h2>
              <p className="text-blue-200 mb-4">
                View, edit, and manage all your custom trading strategies
              </p>
              <div className="flex items-center text-teal-300 font-medium">
                View My Strategies
                <svg className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </Link>
        </div>

        {/* Quick Stats */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white/5 backdrop-blur-lg rounded-lg p-4 border border-white/10">
            <div className="text-2xl font-bold text-white">6</div>
            <div className="text-sm text-blue-200">Core Strategies</div>
          </div>
          <div className="bg-white/5 backdrop-blur-lg rounded-lg p-4 border border-white/10">
            <div className="text-2xl font-bold text-teal-300">{customStrategiesCount}</div>
            <div className="text-sm text-blue-200">Custom Strategies</div>
          </div>
          <div className="bg-white/5 backdrop-blur-lg rounded-lg p-4 border border-white/10">
            <div className="text-2xl font-bold text-purple-300">∞</div>
            <div className="text-sm text-blue-200">Possibilities</div>
          </div>
        </div>
      </main>
    </div>
  );
}
