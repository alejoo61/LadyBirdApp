'use client';

import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open:       boolean;
  onClose:    () => void;
  title?:     string;
  subtitle?:  string;
  children:   ReactNode;
  footer?:    ReactNode;
  size?:      'sm' | 'md' | 'lg' | 'xl' | 'full';
  className?: string;
}

const SIZES = {
  sm:   'max-w-md',
  md:   'max-w-2xl',
  lg:   'max-w-3xl',
  xl:   'max-w-5xl',
  full: 'max-w-[95vw]',
};

export default function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size      = 'md',
  className = '',
}: ModalProps) {
  // Cerrar con Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Bloquear scroll del body
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-night/60 backdrop-blur-sm p-4">
      <div
        className={[
          'bg-white rounded-[2.5rem] shadow-2xl w-full max-h-[92vh] flex flex-col',
          SIZES[size],
          className,
        ].filter(Boolean).join(' ')}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        {(title || subtitle) && (
          <div className="flex items-start justify-between p-8 pb-4 shrink-0">
            <div>
              {title && (
                <h3 className="text-xl font-black text-night uppercase italic tracking-tight">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="text-xs text-night/40 font-medium mt-1">{subtitle}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 text-night/30 hover:text-rose transition-colors rounded-xl hover:bg-rose/10 ml-4 shrink-0">
              <X size={20} />
            </button>
          </div>
        )}

        {/* Body */}
        <div className="overflow-y-auto px-8 pb-4 flex-1">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="p-8 pt-4 shrink-0 border-t border-tumbleweed/20">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}