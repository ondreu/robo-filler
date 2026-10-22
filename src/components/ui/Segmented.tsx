import type { ReactNode } from 'react';

export interface SegmentedOption<T> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
  title?: string;
}

interface SegmentedProps<T> {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
}

/** Přepínač jedné volby z několika (segmentované tlačítko). */
export function Segmented<T extends string | number>({
  value, onChange, options, disabled, ariaLabel, className = '',
}: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`inline-flex items-center rounded-lg border border-surface1 bg-surface0 p-0.5 ${className}`}
    >
      {options.map(o => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            title={o.title}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-sm whitespace-nowrap transition-colors
              disabled:opacity-50 disabled:cursor-not-allowed ${
              active
                ? 'bg-raised text-text font-medium shadow-sm ring-1 ring-surface1'
                : 'text-subtext0 hover:text-text'
            }`}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
