import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Loader2, AlertCircle, Download, FolderOpen } from 'lucide-react';
import type { Article, SearchResult, SearchMode, SearchField, DataSource, AppMode } from './types';
import { parseBomTxt, type ImportResult } from './utils/bomExport';
import { BomWizard } from './components/BomWizard';
import { Changelog } from './components/Changelog';
import { HowItWorks } from './components/HowItWorks';
import { InstallPrompt } from './components/InstallPrompt';
import { loadCSV, loadCSVMeta } from './utils/csvParser';
import { search, getUniqueManufacturers, searchSuggestions } from './utils/searchEngine';
import { SearchBar } from './components/SearchBar';
import { ResultCard } from './components/ResultCard';
import { FilterPanel } from './components/FilterPanel';
import { DataSourceToggle } from './components/DataSourceToggle';
import { AdvancedSettings } from './components/AdvancedSettings';
import { BulkSearch } from './components/BulkSearch';
import { ChatBot } from './components/ChatBot';
import { AiChat } from './components/AiChat';
import { AiBomBuilder } from './components/AiBomBuilder';

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

const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL as string | undefined) ?? '';

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

  // App mode (single / bulk / ai)
  const [appMode, setAppMode] = useState<AppMode>('single');
  // AI sub-mode: chat = existing Karel Bot, bom = AI BOM builder
  const [aiSubMode, setAiSubMode] = useState<'chat' | 'bom'>('chat');
  const [showBomWarning, setShowBomWarning] = useState(false);

  // ZBOM tabs — persisted in localStorage so they survive page refresh
  type ZbomTab = { id: string; name: string; importData?: ImportResult };
  const ZBOM_TABS_KEY = 'robo-filler-zbom-tabs';
  const ZBOM_ACTIVE_KEY = 'robo-filler-zbom-active';

  const [zbomTabs, setZbomTabs] = useState<ZbomTab[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(ZBOM_TABS_KEY) ?? '[]');
      return Array.isArray(saved) ? saved.map((t: { id: string; name: string }) => ({ id: t.id, name: t.name })) : [];
    } catch { return []; }
  });
  const [activeZbomTabId, setActiveZbomTabId] = useState<string | null>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(ZBOM_TABS_KEY) ?? '[]');
      const tabs: { id: string }[] = Array.isArray(saved) ? saved : [];
      const active = localStorage.getItem(ZBOM_ACTIVE_KEY);
      if (active && tabs.some(t => t.id === active)) return active;
      return tabs.length > 0 ? tabs[tabs.length - 1].id : null;
    } catch { return null; }
  });
  const [zbomEditorOpen, setZbomEditorOpen] = useState(false);
  const zbomTabCtrRef = useRef((() => {
    try {
      const saved = JSON.parse(localStorage.getItem(ZBOM_TABS_KEY) ?? '[]');
      if (!Array.isArray(saved) || saved.length === 0) return 0;
      return Math.max(0, ...saved.map((t: { id?: string }) => {
        const n = parseInt((t.id ?? '').replace('zbom-', ''));
        return isNaN(n) ? 0 : n;
      }));
    } catch { return 0; }
  })());
  const [zbomDropdownOpen, setZbomDropdownOpen] = useState(false);
  const zbomInputRef = useRef<HTMLInputElement>(null);
  const zbomDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem(ZBOM_TABS_KEY, JSON.stringify(zbomTabs.map(t => ({ id: t.id, name: t.name }))));
  }, [zbomTabs]);

  useEffect(() => {
    if (activeZbomTabId) localStorage.setItem(ZBOM_ACTIVE_KEY, activeZbomTabId);
    else localStorage.removeItem(ZBOM_ACTIVE_KEY);
  }, [activeZbomTabId]);

  useEffect(() => {
    if (!zbomDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (zbomDropdownRef.current && !zbomDropdownRef.current.contains(e.target as Node)) {
        setZbomDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [zbomDropdownOpen]);

  const openNewZbomTab = useCallback((importData?: ImportResult) => {
    const id = `zbom-${++zbomTabCtrRef.current}`;
    setZbomTabs(prev => {
      const derived = importData?.header?.cisloVrcholu?.trim() || importData?.header?.popis?.trim();
      const name = derived || `ZBOM ${prev.length + 1}`;
      return [...prev, { id, name, importData }];
    });
    setActiveZbomTabId(id);
    setZbomEditorOpen(true);
  }, []);

  const closeZbomTab = useCallback((id: string) => {
    localStorage.removeItem(`robo-filler-zbom-${id}`);
    setZbomTabs(prev => {
      const next = prev.filter(t => t.id !== id);
      if (next.length === 0) setZbomEditorOpen(false);
      return next;
    });
    setActiveZbomTabId(cur => {
      if (cur !== id) return cur;
      const remaining = zbomTabs.filter(t => t.id !== id);
      return remaining.length > 0 ? remaining[remaining.length - 1].id : null;
    });
  }, [zbomTabs]);

  const handleOpenZbom = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const db = customArticles || articles;
    const reader = new FileReader();
    reader.onload = ev => {
      const result = parseBomTxt(ev.target?.result as string, db);
      if (result) openNewZbomTab(result);
      if (zbomInputRef.current) zbomInputRef.current.value = '';
    };
    reader.readAsText(file, 'utf-8');
  };

  // Debounced query for search
  const debouncedQuery = useDebounce(query, 1500);

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

    Promise.all([
      Promise.all(filenames.map(f => loadCSV(f))),
      loadCSVMeta('master-data-meta.json'),
    ])
      .then(([results, lastModified]) => {
        const merged = results.flatMap(r => r.articles);
        if (merged.length === 0) {
          setError(`Nepodařilo se načíst data`);
        } else {
          setArticles(merged);
          setDbLastModified(lastModified);
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

  const suggestions = useMemo(() => {
    if (results.length > 0 || !debouncedQuery.trim() || isSearching) return [];
    return searchSuggestions(activeArticles, debouncedQuery, field);
  }, [results, debouncedQuery, isSearching, activeArticles, field]);

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

    const header = 'Typové označení;Artikl;Výrobce;Název;Číslo dílu výrobce;Výběhový díl;Shoda %';
    const rows = results.map(r =>
      [r.typoveOznaceni, r.artikl, r.vyrobce, r.nazev, r.cisloDiluVyrobce, r.vybehovyDil, r.score.toFixed(0)]
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
          {BACKEND_URL && (
            <button
              onClick={() => setAppMode('ai')}
              className={`px-5 py-2 rounded-xl font-medium transition-all ${
                appMode === 'ai'
                  ? 'bg-mauve text-crust shadow-lg'
                  : 'text-subtext1 hover:text-text'
              }`}
            >
              AI mód
            </button>
          )}
        </div>

        {/* Data source toggle and advanced settings */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-mantle rounded-2xl p-4">
          <DataSourceToggle
            dataSource={dataSource}
            onDataSourceChange={setDataSource}
            isLoading={isLoading}
          />
          <div className="flex flex-wrap items-center gap-3">
            <div ref={zbomDropdownRef} className="relative">
              <button
                onClick={() => zbomTabs.length > 0 ? (setZbomEditorOpen(true), setZbomDropdownOpen(false)) : setZbomDropdownOpen(o => !o)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all bg-surface0 text-subtext1 hover:bg-surface1 hover:text-text"
              >
                <FolderOpen size={18} />
                Tabulkové zpracování
                {zbomTabs.length > 0 && (
                  <span className="bg-mauve text-crust text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0">
                    {zbomTabs.length}
                  </span>
                )}
                <svg
                  onClick={e => { e.stopPropagation(); setZbomDropdownOpen(o => !o); }}
                  className={`w-3 h-3 transition-transform ${zbomDropdownOpen ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                ><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </button>
              {zbomDropdownOpen && (
                <div className="absolute left-0 top-full mt-1 z-30 bg-mantle border border-surface1 rounded-xl shadow-xl overflow-hidden min-w-[180px]">
                  {zbomTabs.length > 0 && (
                    <>
                      <button
                        onClick={() => { setZbomEditorOpen(true); setZbomDropdownOpen(false); }}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-mauve hover:bg-surface0 transition-colors text-left font-medium"
                      >
                        <FolderOpen size={14} className="flex-shrink-0" />
                        Pokračovat v práci
                      </button>
                      <div className="border-t border-surface1" />
                    </>
                  )}
                  <button
                    onClick={() => { openNewZbomTab(); setZbomDropdownOpen(false); }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-subtext1 hover:bg-surface0 hover:text-text transition-colors text-left"
                  >
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                    Nový kusovník
                  </button>
                  <div className="border-t border-surface1" />
                  <button
                    onClick={() => { zbomInputRef.current?.click(); setZbomDropdownOpen(false); }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-subtext1 hover:bg-surface0 hover:text-text transition-colors text-left"
                  >
                    <FolderOpen size={16} className="flex-shrink-0" />
                    Z exportu
                  </button>
                </div>
              )}
            </div>
            <input ref={zbomInputRef} type="file" accept=".txt" className="hidden" onChange={handleOpenZbom} />
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
            {appMode === 'ai' && (
              <div className="space-y-4">
                {/* AI sub-mode toggle */}
                <div className="flex bg-surface0 rounded-xl p-1 gap-1 w-fit">
                  <button
                    onClick={() => setAiSubMode('chat')}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      aiSubMode === 'chat' ? 'bg-mauve text-crust shadow' : 'text-subtext1 hover:text-text'
                    }`}
                  >
                    Běžný
                  </button>
                  <button
                    onClick={() => aiSubMode === 'bom' ? undefined : setShowBomWarning(true)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      aiSubMode === 'bom' ? 'bg-mauve text-crust shadow' : 'text-subtext1 hover:text-text'
                    }`}
                  >
                    AI stavba kusovníku
                    <span className="ml-1.5 text-[10px] font-semibold bg-yellow/20 text-yellow rounded px-1 py-0.5 leading-none align-middle">BETA</span>
                  </button>
                </div>

                {aiSubMode === 'chat' && <AiChat />}
                {aiSubMode === 'bom' && (
                  <div className="bg-mantle rounded-2xl border border-surface1 p-6">
                    <div className="mb-5">
                      <h2 className="text-text font-semibold text-base">AI stavba kusovníku</h2>
                      <p className="text-overlay0 text-xs mt-0.5">
                        Zadej typová označení — AI agent každé vyhledá v databázi a sestaví kusovník a seznam k&nbsp;založení.
                      </p>
                    </div>
                    <AiBomBuilder
                      onOpenInZbom={(importData) => {
                        openNewZbomTab(importData);
                      }}
                    />
                  </div>
                )}

                {/* BOM builder cost warning modal */}
                {showBomWarning && (
                  <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-crust/70 backdrop-blur-sm"
                    onClick={() => setShowBomWarning(false)}
                  >
                    <div
                      className="bg-mantle border border-surface1 rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4"
                      onClick={e => e.stopPropagation()}
                    >
                      <div className="flex items-start gap-3 mb-4">
                        <span className="text-yellow text-xl leading-none mt-0.5">⚠</span>
                        <div>
                          <h3 className="text-text font-semibold text-base mb-1">Pozor — nákladný režim</h3>
                          <p className="text-subtext1 text-sm leading-relaxed">
                            Vyhledávání v tomto režimu jsou drahá. Používejte s rozvahou.
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => setShowBomWarning(false)}
                          className="px-4 py-1.5 rounded-lg text-sm font-medium text-subtext1 hover:text-text transition-colors"
                        >
                          Zrušit
                        </button>
                        <button
                          onClick={() => { setAiSubMode('bom'); setShowBomWarning(false); }}
                          className="px-4 py-1.5 rounded-lg text-sm font-medium bg-mauve text-crust hover:bg-mauve/90 transition-colors"
                        >
                          Rozumím, pokračovat
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

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
                        {suggestions.length > 0 && (
                          <div className="mt-6 text-left space-y-2">
                            <p className="text-subtext0 text-sm font-medium">Mysleli jste...?</p>
                            {suggestions.map((s, idx) => (
                              <ResultCard key={`${s.artikl}-${idx}`} result={s} />
                            ))}
                          </div>
                        )}
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
        <footer className="text-center text-overlay0 text-sm pt-8 space-y-1">
          <p>Article Search App • Robo Filler</p>
          <div className="flex items-center justify-center gap-2">
            <Changelog />
            <HowItWorks />
            <InstallPrompt />
          </div>
        </footer>
      </div>

      {BACKEND_URL && <ChatBot onTeleportToAi={() => setAppMode('ai')} />}

      {zbomEditorOpen && zbomTabs.length > 0 && activeZbomTabId && (() => {
        const activeTab = zbomTabs.find(t => t.id === activeZbomTabId);
        if (!activeTab) return null;
        return (
          <BomWizard
            key={activeZbomTabId}
            draftKey={activeZbomTabId}
            bulkResults={[]}
            selections={{}}
            articles={activeArticles}
            importData={activeTab.importData}
            onClose={() => setZbomEditorOpen(false)}
            tabs={zbomTabs.map(t => ({ id: t.id, name: t.name }))}
            activeTabId={activeZbomTabId}
            onTabSelect={setActiveZbomTabId}
            onAddTab={() => openNewZbomTab()}
            onCloseTab={closeZbomTab}
            onNameChange={(name) => setZbomTabs(prev => prev.map(t => t.id === activeZbomTabId ? { ...t, name } : t))}
          />
        );
      })()}
    </div>
  );
}

export default App;
