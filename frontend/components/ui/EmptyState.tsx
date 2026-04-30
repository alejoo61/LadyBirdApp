'use client';

import type { ReactNode } from 'react';
import { Package } from 'lucide-react';

interface EmptyStateProps {
  icon?:     ReactNode;
  title:     string;
  subtitle?: string;
  action?:   ReactNode;
  className?: string;
}

export default function EmptyState({
  icon,
  title,
  subtitle,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-20 text-night/30 ${className}`}>
      <div className="mb-4 opacity-50">
        {icon || <Package size={48} />}
      </div>
      <p className="font-black uppercase tracking-widest text-sm text-night/40">{title}</p>
      {subtitle && (
        <p className="text-xs text-night/25 mt-1 font-medium">{subtitle}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}