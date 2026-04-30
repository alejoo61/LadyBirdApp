'use client';

import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?:    string;
  error?:    string;
  className?: string;
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?:    string;
  error?:    string;
  className?: string;
}

const baseCls = 'w-full px-4 py-3 bg-stone-100 rounded-xl text-sm font-semibold text-stone-900 outline-none focus:ring-2 focus:ring-stone-900 transition-all';
const labelCls = 'text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1.5 block';
const errorCls = 'text-[10px] text-red-500 font-bold mt-1';

export const Input = forwardRef<HTMLInputElement, InputProps>(({
  label,
  error,
  className = '',
  ...props
}, ref) => (
  <div className="w-full">
    {label && <label className={labelCls}>{label}</label>}
    <input
      ref={ref}
      className={[baseCls, error ? 'ring-2 ring-red-400' : '', className].filter(Boolean).join(' ')}
      {...props}
    />
    {error && <p className={errorCls}>{error}</p>}
  </div>
));
Input.displayName = 'Input';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({
  label,
  error,
  className = '',
  ...props
}, ref) => (
  <div className="w-full">
    {label && <label className={labelCls}>{label}</label>}
    <textarea
      ref={ref}
      className={[baseCls, 'resize-none', error ? 'ring-2 ring-red-400' : '', className].filter(Boolean).join(' ')}
      {...props}
    />
    {error && <p className={errorCls}>{error}</p>}
  </div>
));
Textarea.displayName = 'Textarea';

export const FormSelect = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string; error?: string }>(({
  label,
  error,
  className = '',
  children,
  ...props
}, ref) => (
  <div className="w-full">
    {label && <label className={labelCls}>{label}</label>}
    <select
      ref={ref}
      className={[baseCls, 'cursor-pointer', error ? 'ring-2 ring-red-400' : '', className].filter(Boolean).join(' ')}
      {...props}
    >
      {children}
    </select>
    {error && <p className={errorCls}>{error}</p>}
  </div>
));
FormSelect.displayName = 'FormSelect';