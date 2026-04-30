'use client';

import { Search, X } from 'lucide-react';
import type { InputHTMLAttributes } from 'react';

interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value:       string;
  onChange:    (value: string) => void;
  placeholder?: string;
  className?:  string;
}

export default function SearchInput({
  value,
  onChange,
  placeholder = 'Search...',
  className = '',
  ...props
}: SearchInputProps) {
  return (
    <div className={`relative ${className}`}>
      <Search
        className="absolute left-4 top-1/2 -translate-y-1/2 text-night/30 pointer-events-none"
        size={16}
      />
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-11 pr-10 py-3 bg-bone border-none rounded-2xl focus:ring-2 focus:ring-night transition-all text-sm font-bold text-night outline-none"
        {...props}
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-night/30 hover:text-night transition-colors p-1 rounded-full hover:bg-bone">
          <X size={14} />
        </button>
      )}
    </div>
  );
}