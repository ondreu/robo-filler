import { useState } from 'react';
import { Loader2, Download } from 'lucide-react';
import type { Article, SearchResult, BulkQueryResult } from '../types';
import { search } from '../utils/searchEngine';
import { exportBulkCSV } from '../utils/excelHandler';
import { SelectableCard } from './SelectableCard';

interface BulkSearchProps {
  articles: Article[];
}

function parseLines(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);
}

export function BulkSearch({ articles }: BulkSearchProps) {
  const [rawInput, setRawInput] = useState('');
  const [topN, setTopN] = useState<3 | 6 | 9>(3);
  const [bulkResults, setBulkResults] = useState<BulkQueryResult[]>([]);
  const [selections, setSelections] = useState<Record<number, SearchResult | null>>({});
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const queries = parseLines(rawInput);
  const selectionCount = Object.values(selections).filter(v => v != null).length;

  const handleSearch = () => {
    if (queries.length === 0 || articles.length === 0) return;
    setIsSearching(true);
    setSelections({});
    setHasSearched(false);

    setTimeout(() => {
      const results: BulkQueryResult[] = queries.map(query => ({
        query,
        results: search(articles, { mode: 'combined', field: 'all', query, maxResults: topN }),
      }));
      setBulkResults(results);
      setHasSearched(true);
      setIsSearching(false);
    }, 0);
  };

  const handleSelect = (rowIndex: number, result: SearchResult) => {
    setSelections(prev => {
      if (prev[rowIndex]?.artikl === result.artikl) {
        return { ...prev, [rowIndex]: null };
      }
      return { ...prev, [rowIndex]: result };
    });
  };

  const getGridCols = () => {
    if (topN === 3) return 'grid-cols-1 md:grid-cols-3';
    return 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3';
  };

  return (
    <div className="space-y-6">
      {/* Input panel */}
      <div className="bg-mantle rounded-2xl p-6 space-y-4">
        <div className="space-y-1">
          <label className="text-text font-medium text-sm">
            Vložte seznam výrazů k vyhledání
          </label>
          <p className="text-overlay1 text-xs">
            Každý výraz na nový řádek — například zkopírujte sloupec z Excelu
          </p>
        </div>

        <textarea
          value={rawInput}
          onChange={e => setRawInput(e.target.value)}
          placeholder={"Typové označení 1\nTypové označení 2\nTypové označení 3\n..."}
          className="w-full p-4 bg-surface0 text-text rounded-2xl border-2 border-surface2
            focus:border-mauve focus:outline-none transition-colors placeholder:text-overlay0
            font-mono text-sm resize-y min-h-[140px] max-h-[320px]"
        />

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-subtext1 text-sm">Počet shod na výraz:</span>
            <div className="flex bg-surface0 rounded-xl p-1 gap-1">
              {([3, 6, 9] as const).map(n => (
                <button
                  key={n}
                  onClick={() => setTopN(n)}
                  className={`px-4 py-1.5 rounded-lg font-medium text-sm transition-all ${
                    topN === n
                      ? 'bg-mauve text-crust shadow'
                      : 'text-subtext1 hover:text-text'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {queries.length > 0 && (
              <span className="text-overlay1 text-xs">
                {queries.length} {queries.length === 1 ? 'výraz' : queries.length < 5 ? 'výrazy' : 'výrazů'}
              </span>
            )}
            <button
              onClick={handleSearch}
              disabled={queries.length === 0 || isSearching}
              className="px-6 py-2 rounded-xl font-medium transition-all bg-mauve text-crust
                hover:bg-mauve/80 disabled:opacity-40 disabled:cursor-not-allowed shadow"
            >
              Vyhledat
            </button>
          </div>
        </div>
      </div>

      {/* Spinner */}
      {isSearching && (
        <div className="bg-mantle rounded-2xl p-8 flex flex-col items-center justify-center gap-4">
          <Loader2 className="text-mauve animate-spin" size={40} />
          <p className="text-subtext1">Vyhledávám {queries.length} výrazů...</p>
        </div>
      )}

      {/* Results */}
      {hasSearched && !isSearching && (
        <div className="space-y-4">
          {/* Summary + export */}
          <div className="flex items-center justify-between">
            <p className="text-subtext1 text-sm">
              {selectionCount > 0
                ? `${selectionCount} z ${bulkResults.length} označeno`
                : `${bulkResults.length} výsledků — klikněte na kartu pro označení`}
            </p>
            <button
              onClick={() => exportBulkCSV(bulkResults, selections)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all
                bg-surface0 text-subtext1 hover:bg-surface1 hover:text-text"
              title="Exportovat do CSV"
            >
              <Download size={16} />
              Export CSV
            </button>
          </div>

          {/* Row results */}
          {bulkResults.map((row, rowIndex) => {
            const isRowSelected = selections[rowIndex] != null;
            return (
              <div
                key={rowIndex}
                className={`rounded-2xl p-4 border-l-4 transition-colors ${
                  isRowSelected
                    ? 'bg-mauve/5 border-l-mauve border border-mauve/30'
                    : 'bg-mantle border-l-surface2'
                }`}
              >
                {/* Row header */}
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-overlay1 bg-surface0 rounded-lg px-2 py-0.5 font-mono">
                      #{rowIndex + 1}
                    </span>
                    <span className="text-mauve font-semibold">{row.query}</span>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-xl ${
                      isRowSelected
                        ? 'bg-mauve/20 text-mauve'
                        : 'bg-surface0 text-overlay1'
                    }`}
                  >
                    {isRowSelected
                      ? `✓ ${selections[rowIndex]!.artikl}`
                      : 'Nic nevybráno'}
                  </span>
                </div>

                {/* Candidate cards */}
                {row.results.length === 0 ? (
                  <div className="bg-surface0 rounded-xl p-4 text-center">
                    <p className="text-overlay1 text-sm">Žádné výsledky</p>
                  </div>
                ) : (
                  <div className={`grid gap-3 ${getGridCols()}`}>
                    {row.results.map((result, cardIndex) => (
                      <SelectableCard
                        key={`${result.artikl}-${cardIndex}`}
                        result={result}
                        selected={selections[rowIndex]?.artikl === result.artikl}
                        onSelect={() => handleSelect(rowIndex, result)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
