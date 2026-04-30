'use client';

import type { ReactNode } from 'react';

interface PageHeaderProps {
  title:     string;
  subtitle?: string | ReactNode;
  actions?:  ReactNode;
  className?: string;
}

export default function PageHeader({
  title,
  subtitle,
  actions,
  className = '',
}: PageHeaderProps) {
  return (
    <div className={`flex items-start justify-between gap-4 ${className}`}>
      <div>
        <h2 className="text-2xl font-black text-night tracking-tight uppercase italic">
          {title}
        </h2>
        {subtitle && (
          <div className="text-sm text-night/50 font-medium flex items-center gap-2 flex-wrap mt-0.5">
            {subtitle}
          </div>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-3 shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}