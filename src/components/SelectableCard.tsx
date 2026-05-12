import { CheckCircle } from 'lucide-react';
import type { SearchResult } from '../types';

interface SelectableCardProps {
  result: SearchResult;
  selected: boolean;
  onSelect: () => void;
}

export function SelectableCard({ result, selected, onSelect }: SelectableCardProps) {
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
        ${selected ? 'ring-2 ring-mauve' : ''}`}
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
        {renderField('Název', result.nazev, result.highlightedFields.nazev)}
        {renderField('Artikl', result.artikl, result.highlightedFields.artikl)}
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
