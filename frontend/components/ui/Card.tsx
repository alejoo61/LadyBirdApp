'use client';

import type { ReactNode, HTMLAttributes } from 'react';

type CardVariant = 'default' | 'warning' | 'info' | 'purple' | 'indigo' | 'fuchsia' | 'success';
type CardPadding = 'none' | 'sm' | 'md' | 'lg';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?:  CardVariant;
  padding?:  CardPadding;
  children:  ReactNode;
  className?: string;
}

interface CardHeaderProps {
  children:   ReactNode;
  action?:    ReactNode;
  className?: string;
}

interface CardBannerProps {
  variant?:  CardVariant;
  children:  ReactNode;
  className?: string;
}

const VARIANTS: Record<CardVariant, string> = {
  default: 'border-tumbleweed/30 bg-white',
  warning: 'border-orange-200 bg-white',
  info:    'border-sky ring-1 ring-sky/30 bg-white',
  purple:  'border-purple-200 bg-white',
  indigo:  'border-indigo-300 ring-1 ring-indigo-100 bg-white',
  fuchsia: 'border-fuchsia-300 ring-1 ring-fuchsia-200 bg-white',
  success: 'border-emerald-200 bg-white',
};

const PADDINGS: Record<CardPadding, string> = {
  none: '',
  sm:   'p-4',
  md:   'p-6',
  lg:   'p-8',
};

const BANNER_VARIANTS: Record<CardVariant, string> = {
  default: 'bg-tumbleweed/20 text-night',
  warning: 'bg-orange-50 border-b border-orange-200 text-orange-500',
  info:    'bg-sky/10 border-b border-sky/20 text-sky',
  purple:  'bg-purple-50 border-b border-purple-200 text-purple-500',
  indigo:  'bg-indigo-600 text-white',
  fuchsia: 'bg-fuchsia-500 text-white',
  success: 'bg-emerald-50 border-b border-emerald-200 text-emerald-600',
};

export function CardBanner({ variant = 'default', children, className = '' }: CardBannerProps) {
  return (
    <div className={[
      'px-6 py-2 flex items-center gap-2',
      BANNER_VARIANTS[variant],
      className,
    ].filter(Boolean).join(' ')}>
      {children}
    </div>
  );
}

export function CardHeader({ children, action, className = '' }: CardHeaderProps) {
  return (
    <div className={['flex items-center justify-between mb-3', className].join(' ')}>
      <p className="text-[9px] font-black text-night/30 uppercase tracking-widest">{children}</p>
      {action && <div>{action}</div>}
    </div>
  );
}

export default function Card({
  variant   = 'default',
  padding   = 'md',
  children,
  className = '',
  ...props
}: CardProps) {
  return (
    <div
      className={[
        'rounded-[2rem] border shadow-sm overflow-hidden transition-all duration-300',
        VARIANTS[variant],
        PADDINGS[padding],
        className,
      ].filter(Boolean).join(' ')}
      {...props}
    >
      {children}
    </div>
  );
}