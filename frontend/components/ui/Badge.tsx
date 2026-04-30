'use client';

import type { ReactNode } from 'react';

type BadgeVariant =
  | 'default'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'purple'
  | 'indigo'
  | 'fuchsia'
  | 'amber'
  | 'taco'
  | 'birdbox'
  | 'personalbox'
  | 'fooda'
  | 'needsreview';

type BadgeSize = 'xs' | 'sm' | 'md';

interface BadgeProps {
  variant?:  BadgeVariant;
  size?:     BadgeSize;
  children:  ReactNode;
  dot?:      boolean;
  className?: string;
}

const VARIANTS: Record<BadgeVariant, string> = {
  default:     'bg-stone-100 text-stone-600 border-stone-200',
  success:     'bg-emerald-100 text-emerald-700 border-emerald-200',
  warning:     'bg-orange-100 text-orange-600 border-orange-200',
  danger:      'bg-red-100 text-red-500 border-red-200',
  info:        'bg-sky/20 text-sky border-sky/30',
  purple:      'bg-purple-100 text-purple-600 border-purple-200',
  indigo:      'bg-indigo-100 text-indigo-600 border-indigo-200',
  fuchsia:     'bg-fuchsia-100 text-fuchsia-600 border-fuchsia-200',
  amber:       'bg-amber-100 text-amber-600 border-amber-200',
  taco:        'bg-rose/20 text-rose border-rose/30',
  birdbox:     'bg-sky/20 text-sky border-sky/30',
  personalbox: 'bg-tumbleweed/30 text-night/70 border-tumbleweed',
  fooda:       'bg-night/10 text-night border-night/20',
  needsreview: 'bg-yellow-100 text-yellow-700 border-yellow-300',
};

const SIZES: Record<BadgeSize, string> = {
  xs: 'text-[8px] px-2 py-0.5',
  sm: 'text-[9px] px-2.5 py-0.5',
  md: 'text-[10px] px-3 py-1',
};

// Helpers para mapear valores del dominio a variantes
export function eventTypeVariant(eventType: string): BadgeVariant {
  const map: Record<string, BadgeVariant> = {
    TACO_BAR:     'taco',
    BIRD_BOX:     'birdbox',
    PERSONAL_BOX: 'personalbox',
    FOODA:        'fooda',
    NEEDS_REVIEW: 'needsreview',
  };
  return map[eventType] || 'default';
}

export function statusVariant(status: string): BadgeVariant {
  const map: Record<string, BadgeVariant> = {
    pending:   'amber',
    confirmed: 'success',
    completed: 'info',
    cancelled: 'danger',
  };
  return map[status] || 'default';
}

export function paymentVariant(paymentStatus: string): BadgeVariant {
  const map: Record<string, BadgeVariant> = {
    OPEN:   'warning',
    PAID:   'success',
    CLOSED: 'success',
  };
  return map[paymentStatus] || 'default';
}

export default function Badge({
  variant   = 'default',
  size      = 'sm',
  children,
  dot,
  className = '',
}: BadgeProps) {
  return (
    <span className={[
      'inline-flex items-center gap-1.5',
      'font-black uppercase tracking-widest rounded-full border',
      VARIANTS[variant],
      SIZES[size],
      className,
    ].filter(Boolean).join(' ')}>
      {dot && (
        <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
      )}
      {children}
    </span>
  );
}