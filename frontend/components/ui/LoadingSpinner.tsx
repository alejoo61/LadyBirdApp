'use client';

type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface LoadingSpinnerProps {
  size?:    SpinnerSize;
  label?:   string;
  fullPage?: boolean;
  className?: string;
}

const SIZES: Record<SpinnerSize, string> = {
  xs: 'w-3 h-3 border',
  sm: 'w-4 h-4 border-2',
  md: 'w-6 h-6 border-2',
  lg: 'w-8 h-8 border-2',
  xl: 'w-12 h-12 border-4',
};

export default function LoadingSpinner({
  size      = 'md',
  label,
  fullPage  = false,
  className = '',
}: LoadingSpinnerProps) {
  const spinner = (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <div className={[
        'border-night/20 border-t-night rounded-full animate-spin',
        SIZES[size],
      ].join(' ')} />
      {label && (
        <p className="text-[10px] font-black uppercase tracking-widest text-night/40 animate-pulse">
          {label}
        </p>
      )}
    </div>
  );

  if (fullPage) {
    return (
      <div className="flex items-center justify-center py-20">
        {spinner}
      </div>
    );
  }

  return spinner;
}