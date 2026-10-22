import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Loader2, AlertCircle, AlertTriangle, Download, FolderOpen, FilePlus2, FileUp, Settings, Calculator, Cable,
  SplitSquareHorizontal, Search, SearchX, ListChecks, Package, BookOpen, Table2, ChevronDown, Plus, Database,
  Combine, Asterisk, ScanSearch, Compass,
} from 'lucide-react';
import type { Article, SearchResult, SearchMode, SearchField, DataSource, AppMode, AdvancedQuery, AdvancedField } from './types';
import { ADVANCED_FIELD_LABELS } from './types';
import { parseBomTxt, type ImportResult } from './utils/bomExport';
import { BomWizard } from './components/BomWizard';
import { Changelog } from './components/Changelog';
import { HowItWorks } from './components/HowItWorks';
import { InstallPrompt } from './components/InstallPrompt';
import { loadCSV, loadCSVMeta, loadWires } from './utils/csvParser';
import { search, searchAdvanced, activeCriteria, getUniqueManufacturers, searchSuggestions } from './utils/searchEngine';
import { SearchBar } from './components/SearchBar';
import { ResultCard } from './components/ResultCard';
import { FilterPanel } from './components/FilterPanel';
import { DataSourceToggle } from './components/DataSourceToggle';
import { AdvancedSettings } from './components/AdvancedSettings';
import { BulkSearch } from './components/BulkSearch';
import { AiChat } from './components/AiChat';
import { AiBomBuilder } from './components/AiBomBuilder';
import { AiOnboarding } from './components/AiOnboarding';
import { AppOnboarding } from './components/AppOnboarding';
import { WireCableSearch } from './components/WireCableSearch';
import { KanbanSearch } from './components/KanbanSearch';
import { AdminPanel } from './components/AdminPanel';
import { VersionChecker } from './components/VersionChecker';
import { BrandMark } from './components/BrandMark';
import { ThemeToggle } from './components/ThemeToggle';
import { Segmented } from './components/ui/Segmented';
import { ADMIN_AVAILABLE } from './utils/adminApi';

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
  const [maxResults, setMaxResults] = useState(200);
  // Advanced (multi-field) search — arbitrary combination of field criteria, AND-ed
  const [advanced, setAdvanced] = useState(false);
  const [advancedQuery, setAdvancedQuery] = useState<AdvancedQuery>({});

  // Filter state
  const [selectedManufacturers, setSelectedManufacturers] = useState<string[]>([]);

  // Results state
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [displayedCount, setDisplayedCount] = useState(10);

  // App mode (single / bulk / ai)
  const [appMode, setAppMode] = useState<AppMode>('single');
  // AI sub-mode: chat = Karel Bot (includes guided search), bom = AI BOM builder
  const [aiSubMode, setAiSubMode] = useState<'chat' | 'bom'>('chat');
  const [showBomWarning, setShowBomWarning] = useState(false);

  // ZBOM tabs — persisted in localStorage so they survive page refresh
  type ZbomTab = { id: string; name: string; importData?: ImportResult; bulkResults?: import('./types').BulkQueryResult[]; bulkSelections?: Record<number, SearchResult | null> };
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

  const openNewZbomTab = useCallback((importData?: ImportResult, bulkResults?: import('./types').BulkQueryResult[], bulkSelections?: Record<number, SearchResult | null>) => {
    const id = `zbom-${++zbomTabCtrRef.current}`;
    setZbomTabs(prev => {
      const derived = importData?.header?.cisloVrcholu?.trim() || importData?.header?.popis?.trim();
      const name = derived || `ZBOM ${prev.length + 1}`;
      return [...prev, { id, name, importData, bulkResults, bulkSelections }];
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
      const buf = ev.target?.result as ArrayBuffer;
      const text = new TextDecoder('windows-1250').decode(buf);
      const result = parseBomTxt(text, db);
      if (result) openNewZbomTab(result);
      if (zbomInputRef.current) zbomInputRef.current.value = '';
    };
    reader.readAsArrayBuffer(file);
  };

  // Debounced query for search
  const debouncedQuery = useDebounce(query, 1500);
  const debouncedAdvancedQuery = useDebounce(advancedQuery, 1500);

  // Is there anything to search for in the currently active input style?
  const hasQuery = advanced
    ? activeCriteria(advancedQuery).length > 0
    : query.trim().length > 0;

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
      loadWires(),
    ])
      .then(([results, lastModified, wires]) => {
        const merged = results.flatMap(r => r.articles);
        if (merged.length === 0) {
          setError(`Nepodařilo se načíst data`);
        } else {
          // Merge wires DB (wires come last so main DB takes precedence on duplicates)
          const mainArtikls = new Set(merged.map(a => a.artikl));
          const newWires = wires.filter(w => !mainArtikls.has(w.artikl));
          setArticles([...merged, ...newWires]);
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
  }, [debouncedQuery, debouncedAdvancedQuery, advanced]);

  // Perform search when query or parameters change
  useEffect(() => {
    const criteria = activeCriteria(debouncedAdvancedQuery);
    const hasDebouncedQuery = advanced ? criteria.length > 0 : debouncedQuery.trim().length > 0;

    if (!hasDebouncedQuery || activeArticles.length === 0) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    // Use setTimeout to make search async and show loading state
    const timer = setTimeout(() => {
      const manufacturers = selectedManufacturers.length > 0 ? selectedManufacturers : undefined;

      const searchResults = advanced
        ? searchAdvanced(activeArticles, {
            mode,
            criteria: debouncedAdvancedQuery,
            maxResults,
            manufacturers,
          })
        : search(activeArticles, {
            mode,
            field,
            query: debouncedQuery,
            maxResults,
            manufacturers,
          });

      setResults(searchResults);
      setIsSearching(false);
    }, 0);

    return () => clearTimeout(timer);
  }, [debouncedQuery, debouncedAdvancedQuery, advanced, mode, field, maxResults, selectedManufacturers, activeArticles]);

  // When the query's words matched across several fields at once, offer to move
  // them into the advanced per-field inputs — that is what the user actually meant.
  // Only when the *best* match is a cross-field one: that means no single field
  // satisfied the query as typed, which is exactly the case worth a nudge.
  const crossFieldSplit = useMemo(() => {
    if (advanced || isSearching) return null;
    const top = results[0];
    if (!top?.crossField || Object.keys(top.crossField).length < 2) return null;
    return top.crossField;
  }, [advanced, isSearching, results]);

  const applyCrossFieldSplit = useCallback((split: AdvancedQuery) => {
    setAdvancedQuery(split);
    setAdvanced(true);
  }, []);

  const suggestions = useMemo(() => {
    // Suggestions ("Mysleli jste...?") only make sense for a single free-text query
    if (advanced || results.length > 0 || !debouncedQuery.trim() || isSearching) return [];
    return searchSuggestions(activeArticles, debouncedQuery, field);
  }, [advanced, results, debouncedQuery, isSearching, activeArticles, field]);

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

  const navTab = (id: string, target: AppMode, label: string, icon: React.ReactNode, deprecated = false) => {
    const active = appMode === target;
    return (
      <button
        id={id}
        onClick={() => setAppMode(target)}
        aria-current={active ? 'page' : undefined}
        className={`relative flex items-center gap-2 h-12 px-3 text-sm whitespace-nowrap transition-colors ${
          active ? 'text-nav-text font-medium' : 'text-nav-muted hover:text-nav-text'
        }`}
      >
        {icon}
        {label}
        {deprecated && (
          <span
            className="rounded px-1 py-px text-[9px] font-semibold uppercase tracking-wide leading-none
              text-amber-400 border border-amber-400/40 bg-amber-400/10"
            title="Tato sekce se už nerozvíjí — zůstává funkční, ale může být později odstraněna."
          >
            deprecated
          </span>
        )}
        {active && <span className="absolute left-2 right-2 bottom-0 h-0.5 rounded-t bg-[#e5484d]" />}
      </button>
    );
  };

  const navIconLink = (href: string, title: string, icon: React.ReactNode) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      aria-label={title}
      className="btn-icon text-nav-muted hover:text-nav-text hover:bg-nav-hover"
    >
      {icon}
    </a>
  );

  const deprecatedNotice = (
    <div className="flex items-start gap-2.5 px-4 py-2.5 rounded-lg border border-yellow/30 bg-yellow/10 text-sm">
      <span className="badge-deprecated mt-0.5">deprecated</span>
      <p className="text-subtext1">
        Tato sekce se už nerozvíjí. Zůstává funkční, ale může být v budoucnu odstraněna —
        artikly hledejte přednostně ve vyhledávání v hlavní databázi.
      </p>
    </div>
  );

  const dbLabel = customArticles
    ? `Vlastní databáze · ${activeArticles.length.toLocaleString('cs-CZ')} záznamů`
    : (() => {
        const wireCount = articles.filter(a => a.skupina).length;
        const mainCount = activeArticles.length - activeArticles.filter(a => a.skupina).length;
        const label = `${dataSource === 'usti' ? 'Ústí' : dataSource === 'effi' ? 'Effretikon' : 'Ústí + Effretikon'} · ${mainCount.toLocaleString('cs-CZ')} artiklů`;
        const wireLabel = wireCount > 0 ? ` + ${wireCount.toLocaleString('cs-CZ')} vodičů` : '';
        return label + wireLabel;
      })();

  return (
    <div className="min-h-screen bg-base text-text flex flex-col">
      {/* Horní lišta — tmavá v obou režimech, jako v DZL */}
      <header className="sticky top-0 z-40 bg-nav text-nav-text border-b border-black/30">
        <div className="max-w-[1600px] mx-auto px-4 md:px-6 h-12 flex items-center gap-6">
          <button onClick={() => setAppMode('single')} className="rounded-md" aria-label="Schoogle — úvod">
            <BrandMark />
          </button>
          <nav className="flex items-center gap-1 overflow-x-auto min-w-0" aria-label="Hlavní navigace">
            {navTab('onb-single', 'single', 'Vyhledávání', <Search size={16} />)}
            {navTab('onb-bulk', 'bulk', 'Hromadné', <ListChecks size={16} />)}
            <span className="w-px h-5 bg-white/10 mx-1 shrink-0" />
            {navTab('onb-wirecable', 'wirecable', 'Vodiče a kabely', <Cable size={16} />, true)}
            {navTab('onb-kanban', 'kanban', 'Sypký materiál', <Package size={16} />, true)}
          </nav>
          <div className="ml-auto flex items-center gap-1 shrink-0">
            {navIconLink('https://ondreju-sag.github.io/Electrical-engineering-calculator/', 'Elektro kalkulačka', <Calculator size={18} />)}
            {navIconLink('https://ondreu.github.io/IEC-60364-5-52-Installation-Methods/', 'IEC 60364-5-52 — způsoby uložení vedení', <BookOpen size={18} />)}
            {ADMIN_AVAILABLE && (
              <button
                onClick={() => setAppMode(appMode === 'admin' ? 'single' : 'admin')}
                title="Správa databází"
                aria-label="Správa databází"
                className={`btn-icon ${
                  appMode === 'admin'
                    ? 'bg-nav-hover text-nav-text'
                    : 'text-nav-muted hover:text-nav-text hover:bg-nav-hover'
                }`}
              >
                <Settings size={18} />
              </button>
            )}
            <span className="w-px h-5 bg-white/10 mx-1" />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-[1600px] mx-auto px-4 md:px-6 py-5 space-y-4">
        {/* Admin — správa databází (nezávislé na hlavní DB) */}
        {appMode === 'admin' && <AdminPanel />}

        {/* Data source toggle and tools */}
        {appMode !== 'admin' && (
        <div className="panel flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
          <DataSourceToggle
            dataSource={dataSource}
            onDataSourceChange={setDataSource}
            isLoading={isLoading}
          />
          <div className="flex flex-wrap items-center gap-2">
            <div ref={zbomDropdownRef} className="relative">
              <div className="flex">
                <button
                  onClick={() => zbomTabs.length > 0 ? (setZbomEditorOpen(true), setZbomDropdownOpen(false)) : setZbomDropdownOpen(o => !o)}
                  className="btn btn-secondary rounded-r-none"
                >
                  <Table2 size={16} />
                  Tabulkové zpracování
                  {zbomTabs.length > 0 && (
                    <span className="bg-mauve text-on-accent text-[11px] font-semibold rounded min-w-[18px] h-[18px] px-1 flex items-center justify-center">
                      {zbomTabs.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setZbomDropdownOpen(o => !o)}
                  className="btn btn-secondary rounded-l-none border-l-0 px-2"
                  aria-label="Možnosti tabulkového zpracování"
                >
                  <ChevronDown size={14} className={`transition-transform ${zbomDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
              </div>
              {zbomDropdownOpen && (
                <div className="absolute left-0 top-full mt-1 z-30 bg-mantle border border-surface1 rounded-lg shadow-xl overflow-hidden min-w-[200px] py-1">
                  {zbomTabs.length > 0 && (
                    <>
                      <button
                        onClick={() => { setZbomEditorOpen(true); setZbomDropdownOpen(false); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text hover:bg-surface0 transition-colors text-left font-medium"
                      >
                        <FolderOpen size={15} className="flex-shrink-0 text-overlay1" />
                        Pokračovat v práci
                      </button>
                      <div className="border-t border-surface1 my-1" />
                    </>
                  )}
                  <button
                    onClick={() => { openNewZbomTab(); setZbomDropdownOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-subtext1 hover:bg-surface0 hover:text-text transition-colors text-left"
                  >
                    <FilePlus2 size={15} className="flex-shrink-0 text-overlay1" />
                    Nový kusovník
                  </button>
                  <button
                    onClick={() => { zbomInputRef.current?.click(); setZbomDropdownOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-subtext1 hover:bg-surface0 hover:text-text transition-colors text-left"
                  >
                    <FileUp size={15} className="flex-shrink-0 text-overlay1" />
                    Otevřít z exportu…
                  </button>
                </div>
              )}
            </div>
            <input ref={zbomInputRef} type="file" accept=".txt" className="hidden" onChange={handleOpenZbom} />
            {results.length > 0 && (
              <button
                onClick={handleExportCSV}
                className="btn btn-secondary"
                title="Exportovat výsledky do CSV"
              >
                <Download size={16} />
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
        )}

        {/* Error state */}
        {error && (
          <div className="rounded-lg border border-red/30 bg-red/10 px-4 py-3 flex items-center gap-3">
            <AlertCircle className="text-red flex-shrink-0" size={20} />
            <p className="text-red text-sm">{error}</p>
          </div>
        )}

        {/* Loading state */}
        {isLoading && appMode !== 'admin' && (
          <div className="panel p-10 flex flex-col items-center justify-center gap-3">
            <Loader2 className="text-overlay1 animate-spin" size={28} />
            <p className="text-subtext1 text-sm">Načítám databázi…</p>
          </div>
        )}

        {/* Main content */}
        {!isLoading && !error && activeArticles.length > 0 && (
          <>
            {appMode === 'ai' && (
              <div className="space-y-4">
                {/* AI sub-mode toggle */}
                <Segmented
                  ariaLabel="AI režim"
                  value={aiSubMode}
                  onChange={v => v === 'chat' ? setAiSubMode('chat') : (aiSubMode === 'bom' ? undefined : setShowBomWarning(true))}
                  options={[
                    { value: 'chat', label: 'Chat bot' },
                    { value: 'bom', label: <>Stavba kusovníku <span className="ml-1 text-[10px] font-semibold bg-yellow/15 text-yellow rounded px-1 py-0.5 leading-none">BETA</span></> },
                  ]}
                />

                <p className="text-[11px] text-overlay1">Jedná se o umělou inteligenci, která může dělat chyby. Odpovědi si prosím pečlivě zkontrolujte.</p>

                <AiOnboarding />
                {aiSubMode === 'chat' && <AiChat />}
                {aiSubMode === 'bom' && (
                  <div className="panel p-6">
                    <div className="mb-5">
                      <h2 className="text-text font-semibold text-base">AI stavba kusovníku</h2>
                      <p className="text-overlay1 text-xs mt-0.5">
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
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
                    onClick={() => setShowBomWarning(false)}
                  >
                    <div
                      className="bg-mantle border border-surface1 rounded-xl shadow-xl p-6 max-w-sm w-full mx-4"
                      onClick={e => e.stopPropagation()}
                    >
                      <div className="flex items-start gap-3 mb-4">
                        <AlertTriangle size={20} className="text-yellow shrink-0 mt-0.5" />
                        <div>
                          <h3 className="text-text font-semibold text-base mb-1">Pozor — nákladný režim</h3>
                          <p className="text-subtext1 text-sm leading-relaxed">
                            Vyhledávání v tomto režimu jsou drahá. Používejte s rozvahou.
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => setShowBomWarning(false)} className="btn btn-secondary">
                          Zrušit
                        </button>
                        <button
                          onClick={() => { setAiSubMode('bom'); setShowBomWarning(false); }}
                          className="btn btn-primary"
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
              <BulkSearch
                articles={activeArticles}
                onOpenInZbom={(bulkResults, bulkSelections) => openNewZbomTab(undefined, bulkResults, bulkSelections)}
              />
            )}

            {appMode === 'wirecable' && <>{deprecatedNotice}<WireCableSearch /></>}

            {appMode === 'kanban' && <>{deprecatedNotice}<KanbanSearch /></>}

            {appMode === 'single' && (
              <>
                {/* Search bar */}
                <section className="panel p-4 md:p-5">
                  <SearchBar
                    query={query}
                    onQueryChange={setQuery}
                    mode={mode}
                    onModeChange={setMode}
                    field={field}
                    onFieldChange={setField}
                    maxResults={maxResults}
                    onMaxResultsChange={setMaxResults}
                    advanced={advanced}
                    onAdvancedChange={setAdvanced}
                    advancedQuery={advancedQuery}
                    onAdvancedQueryChange={setAdvancedQuery}
                  />
                </section>

                {/* Results info + filters */}
                <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-subtext1">
                  <div className="flex flex-wrap items-center gap-3">
                    {manufacturers.length > 0 && (
                      <FilterPanel
                        manufacturers={manufacturers}
                        selectedManufacturers={selectedManufacturers}
                        onSelectionChange={setSelectedManufacturers}
                      />
                    )}
                    {selectedManufacturers.length > 0 && (
                      <span className="text-xs text-subtext1">
                        Filtrováno: {selectedManufacturers.join(', ')}
                      </span>
                    )}
                    <span className="flex items-center gap-1.5 text-xs text-overlay1">
                      <Database size={13} />
                      {dbLabel}
                      {!customArticles && dbLastModified && (
                        <> · aktualizováno {dbLastModified.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' })}</>
                      )}
                    </span>
                  </div>
                  {hasQuery && (
                    <p className="text-xs">
                      {isSearching ? (
                        <span className="flex items-center gap-2 text-overlay1">
                          <Loader2 className="animate-spin" size={14} />
                          Vyhledávám…
                        </span>
                      ) : results.length > 0 ? (
                        <span className="tabular-nums">
                          Nalezeno <strong className="text-text font-semibold">{results.length}</strong> výsledků
                          {results.length > displayedCount && <> · zobrazeno {displayedCount}</>}
                        </span>
                      ) : null}
                    </p>
                  )}
                </div>

                {/* Cross-field query hint */}
                {crossFieldSplit && (
                  <div className="panel border-l-[3px] border-l-teal px-4 py-3 flex flex-col md:flex-row md:items-center gap-3">
                    <SplitSquareHorizontal className="text-teal shrink-0" size={18} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text">
                        Dotaz se našel <span className="text-teal font-medium">napříč více poli</span>
                        {' — '}
                        {(Object.keys(crossFieldSplit) as AdvancedField[])
                          .map(f => `${ADVANCED_FIELD_LABELS[f]}: „${crossFieldSplit[f]}"`)
                          .join(' + ')}
                        .
                      </p>
                      <p className="text-xs text-overlay1 mt-1">
                        <span className="text-subtext1 font-medium">Nevidíte tady, co hledáte?</span>{' '}
                        Zkuste vyhledávání ve více polích — jedno pole míchá do výsledků i artikly,
                        kde platí jen část slov, zatímco samostatná pole vrátí jen přesné kombinace.
                      </p>
                    </div>
                    <button
                      onClick={() => applyCrossFieldSplit(crossFieldSplit)}
                      className="btn btn-secondary shrink-0"
                    >
                      Rozdělit do polí
                    </button>
                  </div>
                )}

                {/* Results */}
                {hasQuery && !isSearching && (
                  <div className="space-y-2">
                    {results.length === 0 ? (
                      <div className="panel p-10 text-center">
                        <SearchX size={28} className="mx-auto text-overlay0" />
                        <p className="text-text font-medium mt-3">
                          Žádné výsledky
                        </p>
                        <p className="text-overlay1 text-sm mt-1">
                          Zkuste změnit režim vyhledávání nebo použít jiný výraz.
                        </p>
                        {suggestions.length > 0 && (
                          <div className="mt-6 text-left space-y-2">
                            <p className="field-label">Mysleli jste…?</p>
                            {suggestions.map((s, idx) => (
                              <ResultCard key={`${s.artikl}-${idx}`} result={s} />
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        {results.slice(0, displayedCount).map((result, index) => (
                          <ResultCard key={`${result.artikl}-${index}`} result={result} />
                        ))}
                        {displayedCount < results.length && (
                          <button
                            onClick={() => setDisplayedCount(c => c + 3)}
                            className="w-full flex items-center justify-center gap-2 h-10 rounded-xl border border-dashed
                              border-surface2 text-sm text-subtext1 hover:text-text hover:border-overlay0 hover:bg-mantle transition-colors"
                            title="Zobrazit další 3 výsledky"
                          >
                            <Plus size={16} />
                            Zobrazit další
                            <span className="text-overlay1 tabular-nums">({displayedCount} z {results.length})</span>
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Welcome message */}
                {!hasQuery && (
                  <div className="panel p-6 md:p-8">
                    <p className="text-text font-medium">Zadejte hledaný výraz</p>
                    <p className="text-sm text-overlay1 mt-1">
                      Hledá se v typovém označení, názvu, výrobci, artiklu i čísle dílu výrobce. Výsledky se seřadí podle shody.
                    </p>
                    <div className="grid md:grid-cols-3 gap-3 mt-5">
                      {[
                        { icon: <Combine size={18} />, title: 'Kombinovaný', text: 'Nejdříve zkusí Wild Card, pak Fuzzy. Výchozí a nejčastěji nejlepší volba.' },
                        { icon: <Asterisk size={18} />, title: 'Wild Card', text: 'Hledá výraz kdekoli v textu (*výraz*) — vhodné pro části typového označení.' },
                        { icon: <ScanSearch size={18} />, title: 'Fuzzy', text: 'Hledá podobné shody s tolerancí překlepů a rozdílného formátování.' },
                      ].map(c => (
                        <div key={c.title} className="rounded-lg border border-surface1 bg-surface0/50 p-4">
                          <div className="flex items-center gap-2 text-text font-medium text-sm">
                            <span className="text-overlay1">{c.icon}</span>
                            {c.title}
                          </div>
                          <p className="text-sm text-subtext0 mt-1.5 leading-relaxed">{c.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-surface1 bg-mantle">
        <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-3 flex flex-wrap items-center justify-between gap-2 text-xs text-overlay1">
          <p>Schoogle · interní vyhledávač artiklů Schaltag</p>
          <div className="flex items-center gap-3">
            <Changelog />
            <HowItWorks />
            <InstallPrompt />
            <button
              onClick={() => {
                localStorage.removeItem('ai-onboarding-v1');
                localStorage.removeItem('app-onboarding-v1');
                window.location.reload();
              }}
              className="flex items-center gap-1 text-overlay1 hover:text-text transition-colors"
              title="Znovu spustit průvodce aplikací"
            >
              <Compass size={13} />
              Průvodce
            </button>
          </div>
        </div>
      </footer>

      <AppOnboarding />
      <VersionChecker />

      {zbomEditorOpen && zbomTabs.length > 0 && activeZbomTabId && (() => {
        const activeTab = zbomTabs.find(t => t.id === activeZbomTabId);
        if (!activeTab) return null;
        return (
          <BomWizard
            key={activeZbomTabId}
            draftKey={activeZbomTabId}
            bulkResults={activeTab.bulkResults ?? []}
            selections={activeTab.bulkSelections ?? {}}
            articles={activeArticles}
            importData={activeTab.importData}
            startAtTable={!!(activeTab.bulkResults?.length)}
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
