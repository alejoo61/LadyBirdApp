'use client';

import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'warning' | 'success';
type Size    = 'xs' | 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:  Variant;
  size?:     Size;
  loading?:  boolean;
  icon?:     ReactNode;
  iconRight?: ReactNode;
  children?: ReactNode;
  fullWidth?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  primary:   'bg-night text-bone hover:bg-rose hover:text-night',
  secondary: 'bg-bone text-night/60 hover:text-night hover:bg-tumbleweed/40',
  danger:    'bg-rose/10 text-rose hover:bg-rose hover:text-night',
  ghost:     'bg-transparent text-night/40 hover:text-night hover:bg-bone',
  warning:   'bg-amber-100 text-amber-600 hover:bg-amber-500 hover:text-white',
  success:   'bg-emerald-100 text-emerald-600 hover:bg-emerald-500 hover:text-white',
};

const SIZES: Record<Size, string> = {
  xs: 'px-3 py-1.5 text-[9px] gap-1',
  sm: 'px-4 py-2 text-[10px] gap-1.5',
  md: 'px-5 py-3 text-[11px] gap-2',
  lg: 'px-6 py-4 text-xs gap-2',
};

const SPINNER_SIZES: Record<Size, string> = {
  xs: 'w-3 h-3',
  sm: 'w-3.5 h-3.5',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
  variant  = 'primary',
  size     = 'md',
  loading  = false,
  icon,
  iconRight,
  children,
  fullWidth = false,
  disabled,
  className = '',
  ...props
}, ref) => {
  const isDisabled = disabled || loading;

  return (
    <button
      ref={ref}
      disabled={isDisabled}
      className={[
        'inline-flex items-center justify-center',
        'rounded-2xl font-black uppercase tracking-widest',
        'transition-all active:scale-95',
        'disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100',
        VARIANTS[variant],
        SIZES[size],
        fullWidth ? 'w-full' : '',
        className,
      ].filter(Boolean).join(' ')}
      {...props}
    >
      {loading ? (
        <span className={`border-2 border-current border-t-transparent rounded-full animate-spin shrink-0 ${SPINNER_SIZES[size]}`} />
      ) : icon ? (
        <span className="shrink-0">{icon}</span>
      ) : null}
      {children && <span>{children}</span>}
      {iconRight && !loading && <span className="shrink-0">{iconRight}</span>}
    </button>
  );
});

Button.displayName = 'Button';
export default Button;