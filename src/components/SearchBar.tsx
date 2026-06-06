import { useState } from 'react';
import { Search, X } from 'lucide-react';
import type { SearchMode, SearchField } from '../types';
import { Tooltip } from './Tooltip';

const HISTORY_KEY = 'robo-filler-search-history';
const MAX_HISTORY = 15;

interface SearchBarProps {
  query: string;
  onQueryChange: (query: string) => void;
  mode: SearchMode;
  onModeChange: (mode: SearchMode) => void;
  field: SearchField;
  onFieldChange: (field: SearchField) => void;
  maxResults: number;
  onMaxResultsChange: (max: number) => void;
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

  return (
    <div className="space-y-4">
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-overlay1" size={20} />
        <input
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && query.trim()) saveToHistory(query); }}
          placeholder="Zadejte hledaný výraz..."
          className="w-full pl-12 pr-4 py-3 bg-surface0 text-text rounded-2xl border-2 border-surface2
            focus:border-mauve focus:outline-none transition-colors placeholder:text-overlay1"
        />
      </div>

      {/* Search history chips */}
      {history.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-overlay0 text-xs">Nedávné:</span>
          {history.map(item => (
            <span key={item} className="flex items-center gap-1 bg-surface0 rounded-lg pl-2.5 pr-1 py-1 text-xs group">
              <button
                onClick={() => onQueryChange(item)}
                className="text-subtext1 hover:text-text transition-colors"
              >
                {item}
              </button>
              <button
                onClick={() => removeFromHistory(item)}
                className="text-overlay0 hover:text-red transition-colors opacity-0 group-hover:opacity-100"
                aria-label="Odstranit"
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search mode */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-subtext1 text-sm font-medium">Režim vyhledávání:</span>
        <Tooltip content="Fuzzy hledá podobné shody s tolerancí překlépnutí" />
        {(['fuzzy', 'wildcard', 'combined'] as const).map((m) => (
          <button
            key={m}
            onClick={() => onModeChange(m)}
            className={`px-4 py-2 rounded-xl font-medium transition-all ${
              mode === m
                ? 'bg-mauve text-crust shadow-lg'
                : 'bg-surface0 text-subtext1 hover:bg-surface1'
            }`}
          >
            {m === 'fuzzy' && 'Fuzzy'}
            {m === 'wildcard' && 'Wild Card'}
            {m === 'combined' && 'Kombinovaný'}
          </button>
        ))}
        {mode === 'wildcard' && (
          <Tooltip content="Wild Card automaticky hledá výraz kdekoli v textu (*výraz*)" />
        )}
        {mode === 'combined' && (
          <Tooltip content="Kombinovaný nejdříve zkusí Wild Card, pak Fuzzy search" />
        )}
      </div>

      {/* Search field */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-subtext1 text-sm font-medium">Hledat v:</span>
        <Tooltip content="Vyberte pole, ve kterém chcete vyhledávat" />
        {(['all', 'nazev', 'typoveOznaceni', 'vyrobce', 'artikl'] as const).map((f) => (
          <button
            key={f}
            onClick={() => onFieldChange(f)}
            className={`px-4 py-2 rounded-xl font-medium transition-all ${
              field === f
                ? 'bg-mauve text-crust shadow-lg'
                : 'bg-surface0 text-subtext1 hover:bg-surface1'
            }`}
          >
            {f === 'all' && 'Všechna pole'}
            {f === 'nazev' && 'Název'}
            {f === 'typoveOznaceni' && 'Typové označení'}
            {f === 'vyrobce' && 'Výrobce'}
            {f === 'artikl' && 'Artikl'}
          </button>
        ))}
        {field === 'typoveOznaceni' && (
          <Tooltip content="Vyhledávání v typovém označení zahrnuje i číslo dílu výrobce" />
        )}
      </div>

      {/* Max results */}
      <div className="flex items-center gap-3">
        <label htmlFor="maxResults" className="text-subtext1 text-sm font-medium">
          Počet výsledků:
        </label>
        <Tooltip content="Maximální počet zobrazených výsledků (pro rychlejší vyhledávání)" />
        <select
          id="maxResults"
          value={maxResults}
          onChange={(e) => onMaxResultsChange(Number(e.target.value))}
          className="px-4 py-2 bg-surface0 text-text rounded-xl border-2 border-surface2
            focus:border-mauve focus:outline-none transition-colors"
        >
          <option value={10}>10</option>
          <option value={25}>25</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
          <option value={200}>200</option>
        </select>
      </div>
    </div>
  );
}
