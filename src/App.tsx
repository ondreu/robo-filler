import { useState, useEffect, useMemo } from 'react';
import { Loader2, AlertCircle, Download } from 'lucide-react';
import type { Article, SearchResult, SearchMode, SearchField, DataSource, AppMode } from './types';
import { loadCSV } from './utils/csvParser';
import { search, getUniqueManufacturers } from './utils/searchEngine';
import { SearchBar } from './components/SearchBar';
import { ResultCard } from './components/ResultCard';
import { FilterPanel } from './components/FilterPanel';
import { DataSourceToggle } from './components/DataSourceToggle';
import { ExcelImport } from './components/ExcelImport';
import { AdvancedSettings } from './components/AdvancedSettings';
import { BulkSearch } from './components/BulkSearch';

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

function App() {
  // Data state
  const [dataSource, setDataSource] = useState<DataSource>('usti');
  const [articles, setArticles] = useState<Article[]>([]);
  const [customArticles, setCustomArticles] = useState<Article[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dbLastModified, setDbLastModified] = useState<Date | null>(null);

  // Search state
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<SearchMode>('combined');
  const [field, setField] = useState<SearchField>('all');
  const [maxResults, setMaxResults] = useState(10);

  // Filter state
  const [selectedManufacturers, setSelectedManufacturers] = useState<string[]>([]);

  // Results state
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [displayedCount, setDisplayedCount] = useState(10);

  // App mode (single / bulk)
  const [appMode, setAppMode] = useState<AppMode>('single');

  // Debounced query for search
  const debouncedQuery = useDebounce(query, 300);

  // Active articles (custom or default)
  const activeArticles = customArticles || articles;

  // Get unique manufacturers from search results (top 200)
  const manufacturers = useMemo(
    () => {
      if (results.length === 0) return [];
      const topResults = results.slice(0, 200);
      return getUniqueManufacturers(topResults);
    },
    [results]
  );

  // Load data on mount or when dataSource changes
  useEffect(() => {
    if (customArticles) return;

    setIsLoading(true);
    setError(null);

    const filenames =
      dataSource === 'usti' ? ['master-data.csv'] :
      dataSource === 'effi' ? ['master-data-effi.csv'] :
      ['master-data.csv', 'master-data-effi.csv'];

    Promise.all(filenames.map(f => loadCSV(f)))
      .then((results) => {
        const merged = results.flatMap(r => r.articles);
        if (merged.length === 0) {
          setError(`Nepodařilo se načíst data`);
        } else {
          setArticles(merged);
          // Use lastModified from master-data.csv (usti source), which is always first
          setDbLastModified(results[0].lastModified);
        }
      })
      .catch((err) => {
        setError(`Chyba při načítání dat: ${err.message}`);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [dataSource, customArticles]);

  // Reset displayed count on new query
  useEffect(() => {
    setDisplayedCount(10);
  }, [debouncedQuery]);

  // Perform search when query or parameters change
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    if (activeArticles.length === 0) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    // Use setTimeout to make search async and show loading state
    const timer = setTimeout(() => {
      const searchResults = search(activeArticles, {
        mode,
        field,
        query: debouncedQuery,
        maxResults,
        manufacturers: selectedManufacturers.length > 0 ? selectedManufacturers : undefined,
      });

      setResults(searchResults);
      setIsSearching(false);
    }, 0);

    return () => clearTimeout(timer);
  }, [debouncedQuery, mode, field, maxResults, selectedManufacturers, activeArticles]);

  const handleCustomDataLoad = (data: Article[]) => {
    setCustomArticles(data);
    setSelectedManufacturers([]);
  };

  const handleClearCustomData = () => {
    setCustomArticles(null);
    setSelectedManufacturers([]);
  };

  const handleExportCSV = () => {
    if (results.length === 0) return;

    const header = 'Typové označení;Artikl;Výrobce;Název;Číslo dílu výrobce;Shoda %';
    const rows = results.map(r =>
      [r.typoveOznaceni, r.artikl, r.vyrobce, r.nazev, r.cisloDiluVyrobce, r.score.toFixed(0)]
        .map(v => `"${String(v).replace(/"/g, '""')}"`)
        .join(';')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vysledky-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-base text-text p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <header className="text-center space-y-3">
          <h1 className="text-4xl md:text-5xl font-bold text-mauve">
            Article Search
          </h1>
          <p className="text-subtext1 text-lg">
            Vyhledávání článků v databázi Robo Filler
          </p>
        </header>

        {/* Mode tabs */}
        <div className="flex bg-surface0 rounded-2xl p-1 gap-1 w-fit">
          <button
            onClick={() => setAppMode('single')}
            className={`px-5 py-2 rounded-xl font-medium transition-all ${
              appMode === 'single'
                ? 'bg-mauve text-crust shadow-lg'
                : 'text-subtext1 hover:text-text'
            }`}
          >
            Jednotlivé
          </button>
          <button
            onClick={() => setAppMode('bulk')}
            className={`px-5 py-2 rounded-xl font-medium transition-all ${
              appMode === 'bulk'
                ? 'bg-mauve text-crust shadow-lg'
                : 'text-subtext1 hover:text-text'
            }`}
          >
            Hromadné
          </button>
        </div>

        {/* Data source toggle and advanced settings */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-mantle rounded-2xl p-4">
          <DataSourceToggle
            dataSource={dataSource}
            onDataSourceChange={setDataSource}
            isLoading={isLoading}
          />
          <div className="flex flex-wrap items-center gap-3">
            <ExcelImport articles={activeArticles} />
            {results.length > 0 && (
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all bg-surface0 text-subtext1 hover:bg-surface1 hover:text-text"
                title="Exportovat výsledky do CSV"
              >
                <Download size={18} />
                Export CSV
              </button>
            )}
            <AdvancedSettings
              onCustomDataLoad={handleCustomDataLoad}
              onClearCustomData={handleClearCustomData}
              hasCustomData={customArticles !== null}
            />
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div className="bg-red/10 border border-red/30 rounded-2xl p-4 flex items-center gap-3">
            <AlertCircle className="text-red flex-shrink-0" size={24} />
            <p className="text-red">{error}</p>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="bg-mantle rounded-2xl p-8 flex flex-col items-center justify-center gap-4">
            <Loader2 className="text-mauve animate-spin" size={48} />
            <p className="text-subtext1">Načítám databázi...</p>
          </div>
        )}

        {/* Main content */}
        {!isLoading && !error && activeArticles.length > 0 && (
          <>
            {appMode === 'bulk' && (
              <BulkSearch articles={activeArticles} />
            )}

            {appMode === 'single' && (
              <>
                {/* Search bar */}
                <div className="bg-mantle rounded-2xl p-6">
                  <SearchBar
                    query={query}
                    onQueryChange={setQuery}
                    mode={mode}
                    onModeChange={setMode}
                    field={field}
                    onFieldChange={setField}
                    maxResults={maxResults}
                    onMaxResultsChange={setMaxResults}
                  />
                </div>

                {/* Filters */}
                {manufacturers.length > 0 && (
                  <div className="flex flex-wrap items-center gap-3">
                    <FilterPanel
                      manufacturers={manufacturers}
                      selectedManufacturers={selectedManufacturers}
                      onSelectionChange={setSelectedManufacturers}
                    />
                    {selectedManufacturers.length > 0 && (
                      <span className="text-sm text-subtext1">
                        Filtrováno: {selectedManufacturers.join(', ')}
                      </span>
                    )}
                  </div>
                )}

                {/* Results info */}
                <div className="flex items-center justify-between text-sm text-subtext1">
                  <p>
                    {customArticles
                      ? `Vlastní databáze: ${activeArticles.length.toLocaleString('cs-CZ')} záznamů`
                      : `Databáze ${dataSource === 'usti' ? 'Ústí' : dataSource === 'effi' ? 'Effretikon' : 'Ústí + Effretikon'}: ${activeArticles.length.toLocaleString('cs-CZ')} záznamů`}
                    {!customArticles && dbLastModified && (
                      <span className="ml-2 text-overlay1">
                        • aktualizováno {dbLastModified.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' })}
                      </span>
                    )}
                  </p>
                  {query && (
                    <p>
                      {isSearching ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="animate-spin" size={16} />
                          Vyhledávám...
                        </span>
                      ) : (
                        `Nalezeno ${results.length} výsledků`
                      )}
                    </p>
                  )}
                </div>

                {/* Results */}
                {query && !isSearching && (
                  <div className="space-y-4">
                    {results.length === 0 ? (
                      <div className="bg-mantle rounded-2xl p-8 text-center">
                        <p className="text-overlay1 text-lg">
                          Žádné výsledky nenalezeny
                        </p>
                        <p className="text-overlay0 text-sm mt-2">
                          Zkuste změnit režim vyhledávání nebo použít jiný výraz
                        </p>
                      </div>
                    ) : (() => {
                      const visible = results.slice(0, displayedCount);
                      const canShowMore = displayedCount < results.length;
                      return (
                        <>
                          {visible.slice(0, canShowMore ? -1 : undefined).map((result, index) => (
                            <ResultCard key={`${result.artikl}-${index}`} result={result} />
                          ))}
                          {canShowMore && (
                            <div className="flex flex-col md:flex-row gap-4 items-stretch">
                              <div className="flex-1">
                                <ResultCard
                                  result={visible[visible.length - 1]}
                                />
                              </div>
                              <button
                                onClick={() => setDisplayedCount(c => c + 3)}
                                className="flex items-center justify-center px-6 py-3 md:py-0 rounded-2xl
                                  bg-surface0 hover:bg-surface1 text-mauve font-bold text-2xl
                                  transition-all shadow border-2 border-surface2 hover:border-mauve
                                  min-w-[56px]"
                                title="Zobrazit další 3 výsledky"
                              >
                                +
                              </button>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}

                {/* Welcome message */}
                {!query && (
                  <div className="bg-mantle rounded-2xl p-8 text-center space-y-4">
                    <p className="text-subtext1 text-lg">
                      Zadejte hledaný výraz pro zahájení vyhledávání
                    </p>
                    <div className="grid md:grid-cols-3 gap-4 text-left">
                      <div className="bg-surface0 rounded-xl p-4">
                        <h3 className="text-mauve font-semibold mb-2">Fuzzy Search</h3>
                        <p className="text-sm text-subtext0">
                          Hledá podobné shody s tolerancí překlépnutí a formátování
                        </p>
                      </div>
                      <div className="bg-surface0 rounded-xl p-4">
                        <h3 className="text-mauve font-semibold mb-2">Wild Card</h3>
                        <p className="text-sm text-subtext0">
                          Automaticky hledá výraz kdekoli v textu (*výraz*)
                        </p>
                      </div>
                      <div className="bg-surface0 rounded-xl p-4">
                        <h3 className="text-mauve font-semibold mb-2">Kombinovaný</h3>
                        <p className="text-sm text-subtext0">
                          Nejdříve zkusí Wild Card, pak Fuzzy search
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* Footer */}
        <footer className="text-center text-overlay0 text-sm pt-8">
          <p>Article Search App • Robo Filler</p>
        </footer>
      </div>
    </div>
  );
}

export default App;
