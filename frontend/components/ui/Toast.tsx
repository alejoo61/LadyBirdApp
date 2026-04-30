'use client';

import { useState, useCallback, useEffect, createContext, useContext, type ReactNode } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id:      string;
  type:    ToastType;
  message: string;
}

interface ToastContextValue {
  success: (msg: string) => void;
  error:   (msg: string) => void;
  warning: (msg: string) => void;
  info:    (msg: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_CONFIG: Record<ToastType, { icon: ReactNode; bg: string; text: string }> = {
  success: { icon: <CheckCircle size={16} />, bg: 'bg-night',          text: 'text-bone'          },
  error:   { icon: <XCircle size={16} />,     bg: 'bg-red-600',        text: 'text-white'         },
  warning: { icon: <AlertTriangle size={16} />,bg: 'bg-amber-500',     text: 'text-white'         },
  info:    { icon: <Info size={16} />,         bg: 'bg-sky',           text: 'text-night'         },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const remove = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const add = useCallback((type: ToastType, message: string) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => remove(id), 3500);
  }, [remove]);

  const ctx: ToastContextValue = {
    success: msg => add('success', msg),
    error:   msg => add('error',   msg),
    warning: msg => add('warning', msg),
    info:    msg => add('info',    msg),
  };

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      {/* Toast container */}
      <div className="fixed top-8 right-8 z-[200] flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => {
          const config = TOAST_CONFIG[toast.type];
          return (
            <div
              key={toast.id}
              className={[
                'flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl pointer-events-auto',
                'animate-in slide-in-from-right duration-300',
                config.bg, config.text,
              ].join(' ')}
            >
              <span className="shrink-0">{config.icon}</span>
              <span className="font-black text-xs uppercase tracking-widest">{toast.message}</span>
              <button
                onClick={() => remove(toast.id)}
                className="ml-2 opacity-60 hover:opacity-100 transition-opacity shrink-0">
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

// Componente standalone para uso sin context (compatibilidad hacia atrás)
interface StandaloneToastProps {
  message:   string | null;
  onDismiss?: () => void;
}

export function StandaloneToast({ message, onDismiss }: StandaloneToastProps) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => onDismiss?.(), 3000);
    return () => clearTimeout(timer);
  }, [message, onDismiss]);

  if (!message) return null;

  const isError = message.startsWith('❌');
  return (
    <div className={`fixed top-10 right-10 z-[100] px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-right ${
      isError ? 'bg-red-600 text-white' : 'bg-night text-bone'
    }`}>
      {isError ? <XCircle size={20} /> : <CheckCircle size={20} className="text-rose" />}
      <span className="font-black text-xs uppercase tracking-widest">{message}</span>
    </div>
  );
}