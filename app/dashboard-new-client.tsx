'use client';

import { Session } from 'next-auth';

interface DashboardNewClientProps {
  session: Session;
}

/**
 * Minimal dashboard shell — expanded in the upcoming redesign.
 */
export default function DashboardNewClient({ session }: DashboardNewClientProps) {
  const firstName = session.user?.name?.split(' ')[0] || 'Trader';

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">
          Welcome back, {firstName}
        </h1>
        <p className="text-blue-200 max-w-2xl">
          Trader Journey home — use the navigation for your journal, analytics, strategies, imports, technical
          analysis, saved reports, Alpaca scanner, and tools.
        </p>
      </div>
    </div>
  );
}
