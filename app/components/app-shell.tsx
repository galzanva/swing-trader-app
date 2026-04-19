'use client';

import { Session } from 'next-auth';
import Sidebar, { useSidebar } from './sidebar';

interface AppShellProps {
  session: Session;
  children: React.ReactNode;
}

function MainContent({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar();

  return (
    <>
      {/* Desktop: offset by sidebar width */}
      <main
        className={`
          min-h-screen transition-[margin] duration-200 ease-in-out
          pt-14 lg:pt-0
          ${collapsed ? 'lg:ml-[68px]' : 'lg:ml-60'}
        `}
      >
        <div className="p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </>
  );
}

export default function AppShell({ session, children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-bg">
      <Sidebar session={session} />
      <MainContent>{children}</MainContent>
    </div>
  );
}
