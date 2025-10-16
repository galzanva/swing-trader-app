'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { Session } from 'next-auth';

interface NavbarProps {
  session: Session;
}

export default function Navbar({ session }: NavbarProps) {
  const pathname = usePathname();

  const navItems = [
    { href: '/dashboard', label: '🎯 Strategy Analysis', exact: true },
    { href: '/analyze', label: '🔍 Deep Analysis' },
    { href: '/scanner', label: '📊 Market Scanner' },
    { href: '/strategies', label: '🛠️ Strategies' },
    { href: '/account', label: '👤 Account' },
  ];

  const isActive = (href: string, exact: boolean = false) => {
    if (exact) {
      return pathname === href;
    }
    return pathname?.startsWith(href);
  };

  return (
    <header className="border-b border-white/10 bg-slate-900/50 backdrop-blur-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center space-x-2">
            <div className="text-2xl">📈</div>
            <span className="text-xl font-bold text-white">Swing Advisor</span>
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive(item.href, item.exact)
                    ? 'bg-gradient-to-r from-teal-500 to-blue-500 text-white shadow-lg'
                    : 'text-blue-200 hover:text-white hover:bg-white/10'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* User Info & Sign Out */}
          <div className="flex items-center space-x-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-white">
                {session.user?.name || 'User'}
              </p>
              <p className="text-xs text-blue-300">{session.user?.email}</p>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-300 rounded-lg text-sm font-medium transition-all border border-red-500/30"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <nav className="md:hidden flex overflow-x-auto space-x-2 py-2 -mx-4 px-4">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                isActive(item.href, item.exact)
                  ? 'bg-gradient-to-r from-teal-500 to-blue-500 text-white'
                  : 'text-blue-200 hover:text-white bg-white/5'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
