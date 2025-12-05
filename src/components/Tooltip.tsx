import { useState, useRef, useEffect } from 'react';
import { HelpCircle } from 'lucide-react';

interface TooltipProps {
  content: string;
  className?: string;
}

export function Tooltip({ content, className = '' }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState<'top' | 'bottom'>('top');
  const tooltipRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isVisible && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceAbove = rect.top;
      const spaceBelow = window.innerHeight - rect.bottom;

      setPosition(spaceAbove > spaceBelow ? 'top' : 'bottom');
    }
  }, [isVisible]);

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        className="text-overlay1 hover:text-mauve transition-colors"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
        aria-label="Help"
      >
        <HelpCircle size={16} />
      </button>

      {isVisible && (
        <div
          ref={tooltipRef}
          className={`absolute z-50 px-3 py-2 text-sm bg-surface1 text-text rounded-xl shadow-lg
            whitespace-normal max-w-xs animate-fade-in
            ${position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'}
            left-1/2 transform -translate-x-1/2`}
          role="tooltip"
        >
          {content}
          <div
            className={`absolute left-1/2 transform -translate-x-1/2 w-2 h-2 bg-surface1 rotate-45
              ${position === 'top' ? '-bottom-1' : '-top-1'}`}
          />
        </div>
      )}
    </div>
  );
}
