import { CheckCircle, Copy, AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import type { SearchResult } from '../types';

interface SelectableCardProps {
  result: SearchResult;
  selected: boolean;
  onSelect: () => void;
}

export function SelectableCard({ result, selected, onSelect }: SelectableCardProps) {
  const [copied, setCopied] = useState(false);

  const effectiveArtikl = result.vybehovyDil || result.artikl;

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(effectiveArtikl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const getMatchColor = () => {
    switch (result.matchType) {
      case 'wildcard': return 'border-l-purple-500';
      case 'exact':    return 'border-l-green';
      case 'minimal':  return 'border-l-yellow';
      case 'medium':   return 'border-l-peach';
      case 'large':    return 'border-l-red';
      default:         return 'border-l-overlay0';
    }
  };

  const getScoreBadgeClass = () => {
    switch (result.matchType) {
      case 'wildcard': return 'bg-purple-500/20 text-purple-500';
      case 'exact':    return 'bg-green/20 text-green';
      case 'minimal':  return 'bg-yellow/20 text-yellow';
      case 'medium':   return 'bg-peach/20 text-peach';
      case 'large':    return 'bg-red/20 text-red';
      default:         return 'bg-overlay0/20 text-overlay0';
    }
  };

  const renderField = (label: string, value: string, highlighted?: string) => (
    <div className="flex items-start gap-2">
      <span className="text-subtext0 text-xs min-w-[120px]">{label}:</span>
      <span
        className="text-text text-sm font-medium flex-1"
        dangerouslySetInnerHTML={{ __html: highlighted || value }}
      />
    </div>
  );

  return (
    <div
      onClick={onSelect}
      className={`bg-surface0 rounded-2xl p-4 border-l-4 ${getMatchColor()}
        hover:bg-surface1 transition-all cursor-pointer animate-fade-in shadow-lg
        ${selected ? 'ring-2 ring-mauve ring-offset-2 ring-offset-mantle bg-mauve/10 shadow-mauve/20' : ''}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`px-2 py-0.5 rounded-xl text-xs font-bold ${getScoreBadgeClass()}`}>
            {result.matchType === 'wildcard'
              ? `Wild card • ${result.score.toFixed(0)}%`
              : `${result.score.toFixed(0)}% shoda`}
          </span>
          <span className="text-xs text-overlay1">
            {result.matchType === 'exact' && '(Přesná)'}
            {result.matchType === 'minimal' && '(Minimální)'}
            {result.matchType === 'medium' && '(Střední)'}
            {result.matchType === 'large' && '(Velký rozdíl)'}
            {result.matchType === 'wildcard' && '(Wildcard)'}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-subtext0 px-2 py-0.5 bg-surface2 rounded-xl">
            {result.vyrobce}
          </span>
          {selected && <CheckCircle size={16} className="text-mauve" />}
        </div>
      </div>

      <div className="space-y-1.5">
        {result.status === 'U' && (
          <div className="flex items-center gap-1.5 px-2 py-1 bg-red/10 border border-red/30 rounded-lg">
            <AlertTriangle size={11} className="text-red flex-shrink-0" />
            <span className="text-red text-xs font-medium">Materiál není aktivní!</span>
          </div>
        )}
        {result.vybehovyDil && (
          <div className="flex items-center gap-1.5 px-2 py-1 bg-peach/10 border border-peach/30 rounded-lg">
            <AlertTriangle size={11} className="text-peach flex-shrink-0" />
            <span className="text-peach text-xs font-medium">Výběhový díl</span>
          </div>
        )}
        {renderField('Název', result.nazev, result.highlightedFields.nazev)}
        <div className="flex items-start gap-2">
          <span className="text-subtext0 text-xs min-w-[120px]">Artikl:</span>
          <div className="flex-1 flex items-center gap-1.5">
            <span
              className={`text-sm font-medium ${result.vybehovyDil ? 'text-overlay1 line-through' : 'text-text'}`}
              dangerouslySetInnerHTML={{ __html: result.highlightedFields.artikl || result.artikl }}
            />
            {!result.vybehovyDil && (
              <button
                onClick={handleCopy}
                className="text-overlay1 hover:text-mauve transition-colors flex-shrink-0"
                aria-label="Kopírovat artikl"
                title="Kopírovat artikl"
              >
                {copied ? <CheckCircle size={13} className="text-green" /> : <Copy size={13} />}
              </button>
            )}
          </div>
        </div>
        {result.vybehovyDil && (
          <div className="flex items-start gap-2">
            <span className="text-peach text-xs font-semibold min-w-[120px]">Výběhový díl:</span>
            <div className="flex-1 flex items-center gap-1.5">
              <span
                className="text-peach text-sm font-bold"
                dangerouslySetInnerHTML={{ __html: result.highlightedFields.vybehovyDil || result.vybehovyDil }}
              />
              <button
                onClick={handleCopy}
                className="text-overlay1 hover:text-peach transition-colors flex-shrink-0"
                aria-label="Kopírovat artikl náhrady"
                title="Kopírovat artikl náhrady"
              >
                {copied ? <CheckCircle size={13} className="text-green" /> : <Copy size={13} />}
              </button>
            </div>
          </div>
        )}
        {renderField('Typové označení', result.typoveOznaceni, result.highlightedFields.typoveOznaceni)}
        {result.cisloDiluVyrobce && renderField(
          'Číslo dílu výrobce',
          result.cisloDiluVyrobce,
          result.highlightedFields.cisloDiluVyrobce
        )}
      </div>
    </div>
  );
}
