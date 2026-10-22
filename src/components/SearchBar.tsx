import { useState, useEffect } from 'react';
import { Search, X, SlidersHorizontal, TextCursorInput, History } from 'lucide-react';
import type { SearchMode, SearchField, AdvancedQuery, AdvancedField } from '../types';
import { ADVANCED_FIELD_LABELS } from '../types';
import { Tooltip } from './Tooltip';
import { Segmented } from './ui/Segmented';

const HISTORY_KEY = 'robo-filler-search-history';
const MAX_HISTORY = 15;

const ADVANCED_PLACEHOLDERS: Record<AdvancedField, string> = {
  typoveOznaceni: 'např. 3RV2011-1CA10',
  vyrobce: 'např. Siemens',
  nazev: 'např. motorový spouštěč',
  artikl: 'např. 1000123',
};

const ADVANCED_INPUTS: Array<{ key: AdvancedField; label: string; placeholder: string }> =
  (['typoveOznaceni', 'vyrobce', 'nazev', 'artikl'] as const).map(key => ({
    key,
    label: ADVANCED_FIELD_LABELS[key],
    placeholder: ADVANCED_PLACEHOLDERS[key],
  }));

interface SearchBarProps {
  query: string;
  onQueryChange: (query: string) => void;
  mode: SearchMode;
  onModeChange: (mode: SearchMode) => void;
  field: SearchField;
  onFieldChange: (field: SearchField) => void;
  maxResults: number;
  onMaxResultsChange: (max: number) => void;
  advanced: boolean;
  onAdvancedChange: (advanced: boolean) => void;
  advancedQuery: AdvancedQuery;
  onAdvancedQueryChange: (query: AdvancedQuery) => void;
}

export function SearchBar({
  query,
  onQueryChange,
  mode,
  onModeChange,
  field,
  onFieldChange,
  maxResults,
  onMaxResultsChange,
  advanced,
  onAdvancedChange,
  advancedQuery,
  onAdvancedQueryChange,
}: SearchBarProps) {
  const [history, setHistory] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]'); }
    catch { return []; }
  });

  const saveToHistory = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed || trimmed.length < 2) return;
    setHistory(prev => {
      const next = [trimmed, ...prev.filter(h => h !== trimmed)].slice(0, MAX_HISTORY);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      return next;
    });
  };

  const removeFromHistory = (item: string) => {
    setHistory(prev => {
      const next = prev.filter(h => h !== item);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      return next;
    });
  };

  // Save to history after 7 s of stable query (user is clearly looking at results)
  useEffect(() => {
    if (advanced) return;
    if (!query.trim() || query.trim().length < 2) return;
    const timer = setTimeout(() => saveToHistory(query), 7000);
    return () => clearTimeout(timer);
  }, [query, advanced]);

  const filledCount = ADVANCED_INPUTS.filter(f => (advancedQuery[f.key] ?? '').trim()).length;

  return (
    <div className="space-y-4">
      {/* Search input(s) + simple / advanced toggle */}
      <div className="flex flex-col lg:flex-row lg:items-start gap-3">
        <div className="flex-1 min-w-0">
          {advanced ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {ADVANCED_INPUTS.map(({ key, label, placeholder }) => (
                <div key={key} className="space-y-1">
                  <label htmlFor={`adv-${key}`} className="flex items-center gap-1.5 field-label">
                    {label}
                    {key === 'typoveOznaceni' && (
                      <Tooltip content="Zahrnuje i číslo dílu výrobce — jsou to jedno pole" />
                    )}
                  </label>
                  <div className="relative">
                    <input
                      id={`adv-${key}`}
                      type="text"
                      value={advancedQuery[key] ?? ''}
                      onChange={(e) => onAdvancedQueryChange({ ...advancedQuery, [key]: e.target.value })}
                      placeholder={placeholder}
                      className="input pr-9"
                    />
                    {(advancedQuery[key] ?? '') !== '' && (
                      <button
                        onClick={() => onAdvancedQueryChange({ ...advancedQuery, [key]: '' })}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-overlay0 hover:text-text transition-colors"
                        aria-label={`Vymazat ${label}`}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-overlay1 pointer-events-none" size={18} />
              <input
                type="text"
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                placeholder="Typové označení, název, výrobce nebo artikl…"
                autoFocus
                className="input h-11 pl-11 pr-10 text-[15px]"
              />
              {query !== '' && (
                <button
                  onClick={() => onQueryChange('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-overlay0 hover:text-text transition-colors"
                  aria-label="Vymazat dotaz"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 lg:h-11">
          <Segmented
            ariaLabel="Zadání dotazu"
            value={advanced ? 'advanced' : 'simple'}
            onChange={v => onAdvancedChange(v === 'advanced')}
            options={[
              { value: 'simple', label: 'Jedno pole', icon: <TextCursorInput size={14} /> },
              { value: 'advanced', label: 'Více polí', icon: <SlidersHorizontal size={14} /> },
            ]}
          />
          <Tooltip content="Více polí umožní vyplnit několik údajů zároveň (např. výrobce + typové označení) — musí platit všechny" />
        </div>
      </div>

      {advanced && (
        <div className="flex items-center gap-3 text-xs">
          <p className="text-overlay1">
            Vyplňte libovolnou kombinaci polí — prázdná se ignorují, vyplněná musí platit všechna zároveň.
            {filledCount > 1 && <span className="ml-2 text-teal font-medium">Kombinuji {filledCount} pole (AND)</span>}
          </p>
          {filledCount > 0 && (
            <button
              onClick={() => onAdvancedQueryChange({})}
              className="ml-auto shrink-0 text-subtext1 hover:text-text transition-colors"
            >
              Vymazat vše
            </button>
          )}
        </div>
      )}

      {/* Search history chips */}
      {!advanced && history.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="flex items-center gap-1 text-overlay1 text-xs mr-1">
            <History size={13} /> Nedávné
          </span>
          {history.map(item => (
            <span key={item} className="flex items-center gap-1 bg-surface0 border border-surface1 rounded-md pl-2 pr-1 py-0.5 text-xs group">
              <button
                onClick={() => onQueryChange(item)}
                className="text-subtext1 hover:text-text transition-colors"
              >
                {item}
              </button>
              <button
                onClick={() => removeFromHistory(item)}
                className="text-overlay0 hover:text-text transition-colors opacity-0 group-hover:opacity-100"
                aria-label="Odstranit"
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Options */}
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3 pt-3 border-t border-surface1">
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <span className="field-label">Režim vyhledávání</span>
            <Tooltip content="Fuzzy toleruje překlepy, Wild Card hledá výraz kdekoli v textu (*výraz*), Kombinovaný nejdříve zkusí Wild Card a pak Fuzzy." />
          </div>
          <Segmented
            ariaLabel="Režim vyhledávání"
            value={mode}
            onChange={onModeChange}
            options={[
              { value: 'combined', label: 'Kombinovaný' },
              { value: 'wildcard', label: 'Wild Card' },
              { value: 'fuzzy', label: 'Fuzzy' },
            ]}
          />
        </div>

        {/* Search field — in advanced mode each field has its own input instead */}
        {!advanced && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <span className="field-label">Hledat v</span>
              <Tooltip content="Vyhledávání v typovém označení zahrnuje i číslo dílu výrobce" />
            </div>
            <Segmented
              ariaLabel="Hledat v"
              value={field}
              onChange={onFieldChange}
              options={[
                { value: 'all', label: 'Všechna pole' },
                { value: 'nazev', label: 'Název' },
                { value: 'typoveOznaceni', label: 'Typové označení' },
                { value: 'vyrobce', label: 'Výrobce' },
                { value: 'artikl', label: 'Artikl' },
              ]}
            />
          </div>
        )}

        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <label htmlFor="maxResults" className="field-label">Max. výsledků</label>
            <Tooltip content="Kolik výsledků se nejvýš vyhledá. Zobrazuje se postupně — další odkryje tlačítko pod seznamem." />
          </div>
          <select
            id="maxResults"
            value={maxResults}
            onChange={(e) => onMaxResultsChange(Number(e.target.value))}
            className="input h-9 w-24 pr-2"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
          </select>
        </div>
      </div>
    </div>
  );
}
