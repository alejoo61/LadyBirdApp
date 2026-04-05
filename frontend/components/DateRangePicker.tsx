'use client';

import { useState, useRef, useEffect } from 'react';
import { DayPicker, DateRange } from 'react-day-picker';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { Calendar, X } from 'lucide-react';
import 'react-day-picker/dist/style.css';

interface DateRangePickerProps {
  value: DateRange | undefined;
  onChange: (range: DateRange | undefined) => void;
  placeholder?: string;
}

export default function DateRangePicker({ value, onChange, placeholder = 'Select date range' }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Cerrar al clickear afuera
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const label = value?.from
    ? value.to
      ? `${format(value.from, 'MMM d')} – ${format(value.to, 'MMM d, yyyy')}`
      : format(value.from, 'MMM d, yyyy')
    : placeholder;

  const hasValue = !!value?.from;

  return (
    <div className="relative" ref={ref}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${
          hasValue
            ? 'bg-night text-bone'
            : 'bg-bone text-night/60 hover:text-night'
        }`}
      >
        <Calendar size={13} />
        <span>{label}</span>
        {hasValue && (
          <span
            onClick={(e) => { e.stopPropagation(); onChange(undefined); }}
            className="ml-1 hover:text-rose transition-colors cursor-pointer"
          >
            <X size={12} />
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full mt-2 left-0 z-50 bg-white rounded-[1.5rem] shadow-2xl border border-tumbleweed p-4 animate-in fade-in zoom-in-95 duration-150">
          <style>{`
            .rdp {
              --rdp-accent-color: #1a1a1a;
              --rdp-background-color: #f5f0e8;
              --rdp-accent-color-dark: #1a1a1a;
              --rdp-background-color-dark: #f5f0e8;
              margin: 0;
              font-family: inherit;
            }
            .rdp-day_selected, .rdp-day_range_middle {
              border-radius: 8px;
            }
            .rdp-day_range_start, .rdp-day_range_end {
              border-radius: 8px;
              background-color: #1a1a1a !important;
              color: #f5f0e8 !important;
            }
            .rdp-day_range_middle {
              background-color: #f5f0e8;
              color: #1a1a1a;
            }
            .rdp-button:hover:not([disabled]):not(.rdp-day_selected) {
              background-color: #f5f0e8;
              border-radius: 8px;
            }
            .rdp-head_cell {
              font-size: 10px;
              font-weight: 900;
              text-transform: uppercase;
              letter-spacing: 0.1em;
              color: #1a1a1a99;
            }
            .rdp-caption_label {
              font-size: 13px;
              font-weight: 900;
              text-transform: uppercase;
              letter-spacing: 0.05em;
            }
          `}</style>

          {/* Quick presets */}
          <div className="flex gap-2 mb-3 flex-wrap">
            {[
              { label: 'This Week', range: getThisWeek() },
              { label: 'This Month', range: getThisMonth() },
              { label: 'Next 30d', range: getNext30() },
            ].map((preset) => (
              <button
                key={preset.label}
                onClick={() => { onChange(preset.range); setOpen(false); }}
                className="px-3 py-1.5 bg-bone rounded-xl text-[10px] font-black uppercase tracking-widest text-night/60 hover:bg-night hover:text-bone transition-all"
              >
                {preset.label}
              </button>
            ))}
          </div>

          <DayPicker
            mode="range"
            selected={value}
            onSelect={onChange}
            numberOfMonths={2}
            defaultMonth={value?.from ?? new Date()}
          />

          {/* Footer */}
          <div className="flex justify-between items-center pt-3 border-t border-tumbleweed/20 mt-2">
            <button
              onClick={() => { onChange(undefined); }}
              className="text-[10px] font-black uppercase tracking-widest text-night/30 hover:text-rose transition-colors"
            >
              Clear
            </button>
            <button
              onClick={() => setOpen(false)}
              className="px-4 py-2 bg-night text-bone rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-night/90 transition-all"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function getThisWeek(): DateRange {
  const now   = new Date();
  const day   = now.getDay();
  const from  = new Date(now);
  from.setDate(now.getDate() - day);
  const to    = new Date(from);
  to.setDate(from.getDate() + 6);
  return { from, to };
}

function getThisMonth(): DateRange {
  const now = new Date();
  return { from: startOfMonth(now), to: endOfMonth(now) };
}

function getNext30(): DateRange {
  const from = new Date();
  const to   = new Date();
  to.setDate(from.getDate() + 30);
  return { from, to };
}