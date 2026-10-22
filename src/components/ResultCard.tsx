import { Copy, CheckCircle, AlertTriangle, ExternalLink } from 'lucide-react';
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
        return 'border-l-lavender';
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

  const effectiveArtikl = result.vybehovyDil || result.artikl;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(effectiveArtikl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleGoogleSearch = (query: string) => {
    window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank');
  };

  const matchLabel =
    result.matchType === 'exact' ? 'Přesná shoda'
    : result.matchType === 'minimal' ? 'Minimální rozdíl'
    : result.matchType === 'medium' ? 'Střední rozdíl'
    : result.matchType === 'large' ? 'Velký rozdíl'
    : 'Wild Card';

  const matchTone =
    result.matchType === 'wildcard' ? 'bg-lavender/10 text-lavender border-lavender/25'
    : result.matchType === 'exact' ? 'bg-green/10 text-green border-green/25'
    : result.matchType === 'minimal' ? 'bg-yellow/10 text-yellow border-yellow/25'
    : result.matchType === 'medium' ? 'bg-peach/10 text-peach border-peach/25'
    : 'bg-red/10 text-red border-red/25';

  const renderField = (label: string, value: string, highlighted?: string, withSearch = false) => (
    <div className="min-w-0">
      <dt className="field-label mb-0.5">{label}</dt>
      <dd className="flex items-center gap-1.5 min-w-0">
        {highlighted ? (
          <span
            className="font-mono text-[13px] text-text break-all"
            dangerouslySetInnerHTML={{ __html: highlighted }}
          />
        ) : (
          <span className="font-mono text-[13px] text-text break-all">{value || '—'}</span>
        )}
        {withSearch && value && (
          <button
            onClick={() => handleGoogleSearch(value)}
            className="text-overlay0 hover:text-text transition-colors flex-shrink-0"
            aria-label={`Vyhledat ${value} na webu`}
            title="Vyhledat na webu"
          >
            <ExternalLink size={13} />
          </button>
        )}
      </dd>
    </div>
  );

  const copyButton = (title: string) => (
    <button
      onClick={handleCopy}
      className="text-overlay0 hover:text-text transition-colors flex-shrink-0"
      aria-label={title}
      title={title}
    >
      {copied ? <CheckCircle size={14} className="text-green" /> : <Copy size={14} />}
    </button>
  );

  return (
    <article
      className={`panel border-l-[3px] ${getMatchColor()} px-4 py-3 hover:border-surface2 transition-colors animate-fade-in`}
    >
      {/* Title row */}
      <div className="flex items-start gap-3">
        <h3
          className="flex-1 min-w-0 text-[15px] font-medium text-text leading-snug"
          dangerouslySetInnerHTML={{ __html: result.highlightedFields.nazev || result.nazev }}
        />
        <div className="flex items-center gap-2 shrink-0">
          {result.vyrobce && (
            <span className="text-xs font-medium text-subtext1 px-2 py-0.5 bg-surface0 border border-surface1 rounded">
              {result.vyrobce}
            </span>
          )}
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded border tabular-nums ${matchTone}`}
            title={matchLabel}
          >
            {result.score.toFixed(0)} %
            <span className="hidden sm:inline font-normal opacity-80"> · {matchLabel}</span>
          </span>
        </div>
      </div>

      {(result.status === 'U' || result.vybehovyDil) && (
        <div className="flex flex-wrap gap-2 mt-2">
          {result.status === 'U' && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-red/10 border border-red/25 rounded text-red text-xs font-medium">
              <AlertTriangle size={12} /> Materiál není aktivní
            </span>
          )}
          {result.vybehovyDil && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-peach/10 border border-peach/25 rounded text-peach text-xs font-medium">
              <AlertTriangle size={12} /> Výběhový díl — použijte náhradu
            </span>
          )}
        </div>
      )}

      {/* Fields */}
      <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-2 mt-3">
        <div className="min-w-0">
          <dt className="field-label mb-0.5">Artikl</dt>
          <dd className="flex items-center gap-1.5">
            <span
              className={`font-mono text-[13px] ${result.vybehovyDil ? 'text-overlay1 line-through' : 'text-text font-semibold'}`}
              dangerouslySetInnerHTML={{
                __html: result.highlightedFields.artikl || result.artikl,
              }}
            />
            {!result.vybehovyDil && copyButton('Kopírovat artikl')}
          </dd>
        </div>

        {result.vybehovyDil && (
          <div className="min-w-0">
            <dt className="field-label mb-0.5 !text-peach">Náhrada (výběhový díl)</dt>
            <dd className="flex items-center gap-1.5">
              <span
                className="font-mono text-[13px] text-peach font-semibold"
                dangerouslySetInnerHTML={{
                  __html: result.highlightedFields.vybehovyDil || result.vybehovyDil,
                }}
              />
              {copyButton('Kopírovat artikl náhrady')}
            </dd>
          </div>
        )}

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
      </dl>
    </article>
  );
}
