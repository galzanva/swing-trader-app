'use client';

import { ReactNode } from 'react';

interface DashboardCardProps {
  title: string;
  icon?: string;
  children: ReactNode;
  className?: string;
  headerAction?: ReactNode;
}

export default function DashboardCard({ 
  title, 
  icon, 
  children, 
  className = '',
  headerAction 
}: DashboardCardProps) {
  return (
    <div className={`bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 shadow-2xl ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          {icon && <span>{icon}</span>}
          {title}
        </h2>
        {headerAction}
      </div>
      {children}
    </div>
  );
}

