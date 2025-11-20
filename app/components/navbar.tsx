'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { Session } from 'next-auth';
import { useState, useEffect } from 'react';

interface NavbarProps {
  session: Session;
}

interface NavItem {
  href: string;
  label: string;
  exact?: boolean;
}

export default function Navbar({ session }: NavbarProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  const navItems = {
    dashboard: {
      label: '🏠 Dashboard',
      href: '/dashboard',
    },
    analysis: {
      label: '📊 Analysis',
      items: [
        { href: '/strategy-analyze', label: '🎯 Strategy Analysis' },
        { href: '/analyze', label: '🔍 Deep Analysis' },
        { href: '/reports', label: '📂 Saved Reports' },
      ] as NavItem[],
    },
    tools: {
      label: '🛠️ Tools',
      items: [
        { href: '/scanner', label: '📊 Market Scanner' },
        { href: '/trade-calculator', label: '🧮 Trade Calculator' },
      ] as NavItem[],
    },
    strategies: {
      label: 'Strategies',
      href: '/strategies',
    },
    journal: {
      label: '📓 Trading Journal',
      href: '/journal',
    },
  };

  const isActive = (href: string, exact: boolean = false) => {
    if (exact) {
      return pathname === href;
    }
    return pathname?.startsWith(href);
  };

  const isAnyItemActive = (items: NavItem[]) => {
    return items.some((item) => isActive(item.href, item.exact ?? false));
  };

  const handleMobileMenuToggle = () => {
    setMobileMenuOpen(!mobileMenuOpen);
    setActiveDropdown(null);
  };

  const handleDropdownToggle = (key: string) => {
    setActiveDropdown(activeDropdown === key ? null : key);
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
    setActiveDropdown(null);
  };

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  return (
    <>
      <header className="border-b border-white/10 bg-slate-900/50 backdrop-blur-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/dashboard" className="flex items-center space-x-2" onClick={closeMobileMenu}>
              <div className="text-2xl">📈</div>
              <span className="text-xl font-bold text-white">Swing Advisor</span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center space-x-1">
            {/* Dashboard Link */}
            <Link
              href={navItems.dashboard.href}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                isActive(navItems.dashboard.href, true)
                  ? 'bg-gradient-to-r from-teal-500 to-blue-500 text-white shadow-lg'
                  : 'text-blue-200 hover:text-white hover:bg-white/10'
              }`}
            >
              {navItems.dashboard.label}
            </Link>

            {/* Analysis Dropdown */}
            <div className="relative">
              <button
                onClick={() => handleDropdownToggle('analysis')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center space-x-1 ${
                  isAnyItemActive(navItems.analysis.items)
                    ? 'bg-gradient-to-r from-teal-500 to-blue-500 text-white shadow-lg'
                    : 'text-blue-200 hover:text-white hover:bg-white/10'
                }`}
              >
                <span>{navItems.analysis.label}</span>
                <span className={`transform transition-transform ${activeDropdown === 'analysis' ? 'rotate-180' : ''}`}>
                  ▼
                </span>
              </button>
              {activeDropdown === 'analysis' && (
                <div className="absolute top-full left-0 mt-1 w-56 bg-slate-800 border border-white/10 rounded-lg shadow-xl overflow-hidden">
                  {navItems.analysis.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setActiveDropdown(null)}
                      className={`block px-4 py-3 text-sm transition-all ${
                        isActive(item.href, item.exact ?? false)
                          ? 'bg-gradient-to-r from-teal-500/20 to-blue-500/20 text-white border-l-2 border-teal-500'
                          : 'text-blue-200 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Tools Dropdown */}
            <div className="relative">
              <button
                onClick={() => handleDropdownToggle('tools')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center space-x-1 ${
                  isAnyItemActive(navItems.tools.items)
                    ? 'bg-gradient-to-r from-teal-500 to-blue-500 text-white shadow-lg'
                    : 'text-blue-200 hover:text-white hover:bg-white/10'
                }`}
              >
                <span>{navItems.tools.label}</span>
                <span className={`transform transition-transform ${activeDropdown === 'tools' ? 'rotate-180' : ''}`}>
                  ▼
                </span>
              </button>
              {activeDropdown === 'tools' && (
                <div className="absolute top-full left-0 mt-1 w-56 bg-slate-800 border border-white/10 rounded-lg shadow-xl overflow-hidden">
                  {navItems.tools.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setActiveDropdown(null)}
                      className={`block px-4 py-3 text-sm transition-all ${
                        isActive(item.href, item.exact ?? false)
                          ? 'bg-gradient-to-r from-teal-500/20 to-blue-500/20 text-white border-l-2 border-teal-500'
                          : 'text-blue-200 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Strategies Link */}
            <Link
              href={navItems.strategies.href}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                isActive(navItems.strategies.href)
                  ? 'bg-gradient-to-r from-teal-500 to-blue-500 text-white shadow-lg'
                  : 'text-blue-200 hover:text-white hover:bg-white/10'
              }`}
            >
              {navItems.strategies.label}
            </Link>

            {/* Trading Journal Link */}
            <Link
              href={navItems.journal.href}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                isActive(navItems.journal.href)
                  ? 'bg-gradient-to-r from-teal-500 to-blue-500 text-white shadow-lg'
                  : 'text-blue-200 hover:text-white hover:bg-white/10'
              }`}
            >
              {navItems.journal.label}
            </Link>
            </nav>

            {/* User Info & Sign Out */}
            <div className="flex items-center space-x-3">
            {/* Account Icon with Name - Clickable */}
            <Link
              href="/account"
              className="flex items-center space-x-2 hover:bg-white/10 rounded-lg px-2 py-1 transition-all"
            >
              <div className="text-xl">👤</div>
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-white">
                  {session.user?.name || 'User'}
                </p>
              </div>
            </Link>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-300 rounded-lg text-sm font-medium transition-all border border-red-500/30"
            >
              Sign Out
            </button>
            
            {/* Mobile Menu Button */}
            <button
              onClick={handleMobileMenuToggle}
              className="lg:hidden p-2 text-blue-200 hover:text-white hover:bg-white/10 rounded-lg transition-all"
              aria-label="Toggle menu"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                {mobileMenuOpen ? (
                  <path d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu - Full Screen Overlay */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-[9999] bg-slate-900 backdrop-blur-lg overflow-hidden">
          <div className="flex flex-col h-full w-full overflow-y-auto">
            {/* Mobile Menu Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10 bg-slate-900">
              <Link
                href="/dashboard"
                onClick={closeMobileMenu}
                className="flex items-center space-x-2"
              >
                <div className="text-2xl">📈</div>
                <span className="text-xl font-bold text-white">Swing Advisor</span>
              </Link>
              <button
                onClick={handleMobileMenuToggle}
                className="p-2 text-blue-200 hover:text-white rounded-lg"
                aria-label="Close menu"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Mobile Menu Content */}
            <div className="flex-1 overflow-y-auto px-4 py-6">
              <nav className="space-y-2">
                {/* Dashboard Link */}
                <Link
                  href={navItems.dashboard.href}
                  onClick={closeMobileMenu}
                  className={`block px-4 py-3 rounded-lg text-base font-medium transition-all ${
                    isActive(navItems.dashboard.href, true)
                      ? 'bg-gradient-to-r from-teal-500 to-blue-500 text-white'
                      : 'text-blue-200 hover:bg-white/10'
                  }`}
                >
                  {navItems.dashboard.label}
                </Link>

                {/* Analysis Dropdown */}
                <div>
                  <button
                    onClick={() => handleDropdownToggle('analysis')}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-base font-medium transition-all ${
                      isAnyItemActive(navItems.analysis.items)
                        ? 'bg-gradient-to-r from-teal-500 to-blue-500 text-white'
                        : 'text-blue-200 hover:bg-white/10'
                    }`}
                  >
                    <span>{navItems.analysis.label}</span>
                    <span className={`transform transition-transform ${activeDropdown === 'analysis' ? 'rotate-180' : ''}`}>
                      ▼
                    </span>
                  </button>
                  {activeDropdown === 'analysis' && (
                    <div className="mt-2 ml-4 space-y-1">
                      {navItems.analysis.items.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={closeMobileMenu}
                          className={`block px-4 py-3 rounded-lg text-sm transition-all ${
                            isActive(item.href, item.exact ?? false)
                              ? 'bg-gradient-to-r from-teal-500/20 to-blue-500/20 text-white border-l-2 border-teal-500'
                              : 'text-blue-200 hover:bg-white/10'
                          }`}
                        >
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>

                {/* Tools Dropdown */}
                <div>
                  <button
                    onClick={() => handleDropdownToggle('tools')}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-base font-medium transition-all ${
                      isAnyItemActive(navItems.tools.items)
                        ? 'bg-gradient-to-r from-teal-500 to-blue-500 text-white'
                        : 'text-blue-200 hover:bg-white/10'
                    }`}
                  >
                    <span>{navItems.tools.label}</span>
                    <span className={`transform transition-transform ${activeDropdown === 'tools' ? 'rotate-180' : ''}`}>
                      ▼
                    </span>
                  </button>
                  {activeDropdown === 'tools' && (
                    <div className="mt-2 ml-4 space-y-1">
                      {navItems.tools.items.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={closeMobileMenu}
                          className={`block px-4 py-3 rounded-lg text-sm transition-all ${
                            isActive(item.href, item.exact ?? false)
                              ? 'bg-gradient-to-r from-teal-500/20 to-blue-500/20 text-white border-l-2 border-teal-500'
                              : 'text-blue-200 hover:bg-white/10'
                          }`}
                        >
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>

                {/* Strategies Link */}
                <Link
                  href={navItems.strategies.href}
                  onClick={closeMobileMenu}
                  className={`block px-4 py-3 rounded-lg text-base font-medium transition-all ${
                    isActive(navItems.strategies.href)
                      ? 'bg-gradient-to-r from-teal-500 to-blue-500 text-white'
                      : 'text-blue-200 hover:bg-white/10'
                  }`}
                >
                  {navItems.strategies.label}
                </Link>

                {/* Trading Journal Link */}
                <Link
                  href={navItems.journal.href}
                  onClick={closeMobileMenu}
                  className={`block px-4 py-3 rounded-lg text-base font-medium transition-all ${
                    isActive(navItems.journal.href)
                      ? 'bg-gradient-to-r from-teal-500 to-blue-500 text-white'
                      : 'text-blue-200 hover:bg-white/10'
                  }`}
                >
                  {navItems.journal.label}
                </Link>
              </nav>
            </div>

            {/* Mobile Menu Footer */}
            <div className="border-t border-white/10 p-4">
              <div className="flex items-center justify-between">
                <Link
                  href="/account"
                  onClick={closeMobileMenu}
                  className="flex items-center space-x-2 hover:bg-white/10 rounded-lg px-2 py-1 transition-all"
                >
                  <div className="text-xl">👤</div>
                  <p className="text-sm font-medium text-white">
                    {session.user?.name || 'User'}
                  </p>
                </Link>
                <button
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-300 rounded-lg text-sm font-medium transition-all border border-red-500/30"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Click outside to close dropdown */}
      {activeDropdown && !mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setActiveDropdown(null)}
        />
      )}
    </>
  );
}
