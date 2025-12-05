import { Search, Copy, CheckCircle } from 'lucide-react';
import { useState } from 'react';
import type { SearchResult } from '../types';

interface ResultCardProps {
  result: SearchResult;
}

export function ResultCard({ result }: ResultCardProps) {
  const [copied, setCopied] = useState(false);

  const getMatchColor = () => {
    switch (result.matchType) {
      case 'wildcard':
        return 'border-l-purple-500';
      case 'exact':
        return 'border-l-green';
      case 'minimal':
        return 'border-l-yellow';
      case 'medium':
        return 'border-l-peach';
      case 'large':
        return 'border-l-red';
      default:
        return 'border-l-overlay0';
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(result.artikl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleGoogleSearch = (query: string) => {
    window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank');
  };

  const renderField = (label: string, value: string, highlighted?: string, withSearch = false) => (
    <div className="flex items-start gap-2">
      <span className="text-subtext0 text-sm min-w-[140px]">{label}:</span>
      <div className="flex-1 flex items-center gap-2">
        {highlighted ? (
          <span
            className="text-text font-medium"
            dangerouslySetInnerHTML={{ __html: highlighted }}
          />
        ) : (
          <span className="text-text font-medium">{value}</span>
        )}
        {withSearch && value && (
          <button
            onClick={() => handleGoogleSearch(value)}
            className="text-overlay1 hover:text-mauve transition-colors flex-shrink-0"
            aria-label={`Vyhledat ${value} na Google`}
            title="Vyhledat na Google"
          >
            <Search size={16} />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div
      className={`bg-surface0 rounded-2xl p-5 border-l-4 ${getMatchColor()}
        hover:bg-surface1 transition-all animate-fade-in shadow-lg`}
    >
      {/* Score badge */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span
            className={`px-3 py-1 rounded-xl text-sm font-bold ${
              result.matchType === 'wildcard'
                ? 'bg-purple-500/20 text-purple-500'
                : result.matchType === 'exact'
                ? 'bg-green/20 text-green'
                : result.matchType === 'minimal'
                ? 'bg-yellow/20 text-yellow'
                : result.matchType === 'medium'
                ? 'bg-peach/20 text-peach'
                : 'bg-red/20 text-red'
            }`}
          >
            {result.matchType === 'wildcard' ? 'Wild card' : `${result.score.toFixed(0)}% shoda`}
          </span>
          {result.matchType !== 'wildcard' && (
            <span className="text-xs text-overlay1">
              {result.matchType === 'exact' && '(Přesná shoda)'}
              {result.matchType === 'minimal' && '(Minimální rozdíl)'}
              {result.matchType === 'medium' && '(Střední rozdíl)'}
              {result.matchType === 'large' && '(Velký rozdíl)'}
            </span>
          )}
        </div>
        <span className="text-xs text-subtext0 font-medium px-3 py-1 bg-surface2 rounded-xl">
          {result.vyrobce}
        </span>
      </div>

      {/* Fields */}
      <div className="space-y-2">
        {renderField('Název', result.nazev, result.highlightedFields.nazev)}

        <div className="flex items-start gap-2">
          <span className="text-subtext0 text-sm min-w-[140px]">Artikl:</span>
          <div className="flex-1 flex items-center gap-2">
            <span
              className="text-text font-medium"
              dangerouslySetInnerHTML={{
                __html: result.highlightedFields.artikl || result.artikl,
              }}
            />
            <button
              onClick={handleCopy}
              className="text-overlay1 hover:text-mauve transition-colors flex-shrink-0"
              aria-label="Kopírovat artikl"
              title="Kopírovat artikl"
            >
              {copied ? (
                <CheckCircle size={16} className="text-green" />
              ) : (
                <Copy size={16} />
              )}
            </button>
          </div>
        </div>

        {renderField(
          'Typové označení',
          result.typoveOznaceni,
          result.highlightedFields.typoveOznaceni,
          true
        )}

        {result.cisloDiluVyrobce && renderField(
          'Číslo dílu výrobce',
          result.cisloDiluVyrobce,
          result.highlightedFields.cisloDiluVyrobce,
          true
        )}
      </div>
    </div>
  );
}
