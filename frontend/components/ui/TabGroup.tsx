'use client';

import type { ReactNode } from 'react';

interface Tab<T extends string> {
  key:       T;
  label:     string;
  count?:    number;
  dotColor?: string;
  icon?:     ReactNode;
}

interface TabGroupProps<T extends string> {
  tabs:      Tab<T>[];
  active:    T;
  onChange:  (key: T) => void;
  className?: string;
}

export default function TabGroup<T extends string>({
  tabs,
  active,
  onChange,
  className = '',
}: TabGroupProps<T>) {
  return (
    <div className={`flex gap-1 bg-bone p-1.5 rounded-2xl w-fit ${className}`}>
      {tabs.map(tab => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`relative flex items-center gap-2 px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${
            active === tab.key
              ? 'bg-white shadow-sm text-night'
              : 'text-night/40 hover:text-night'
          }`}
        >
          {tab.icon && (
            <span className={active === tab.key ? 'text-night' : 'text-night/30'}>
              {tab.icon}
            </span>
          )}
          {tab.label}
          {tab.count !== undefined && (
            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
              active === tab.key ? 'bg-night/10 text-night' : 'bg-night/5 text-night/40'
            }`}>
              {tab.count}
            </span>
          )}
          {tab.dotColor && (
            <span className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${tab.dotColor}`} />
          )}
        </button>
      ))}
    </div>
  );
}