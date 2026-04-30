'use client';

import type { SelectHTMLAttributes } from 'react';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  options:    SelectOption[];
  value:      string;
  onChange:   (value: string) => void;
  placeholder?: string;
  highlight?:   boolean; // resalta cuando tiene valor seleccionado
  className?:   string;
}

export default function Select({
  options,
  value,
  onChange,
  placeholder,
  highlight   = false,
  className   = '',
  ...props
}: SelectProps) {
  const hasValue = value !== '' && value !== undefined;

  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className={[
        'px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest border-none outline-none cursor-pointer transition-all',
        hasValue && highlight
          ? 'bg-night text-bone'
          : 'bg-bone text-night/60',
        className,
      ].filter(Boolean).join(' ')}
      {...props}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}