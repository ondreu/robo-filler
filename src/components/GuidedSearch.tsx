import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send, Loader2, Copy, Check, ExternalLink, ChevronDown, ChevronUp,
  Sparkles, Search, PenLine, X, ArrowRight,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Article } from '../types';

const BACKEND_URL = ((import.meta.env.VITE_BACKEND_URL as string | undefined) ?? '').trim().replace(/\/$/, '');
const GUIDED_SESSIONS_KEY = 'robo-filler-guided-sessions';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Answer {
  key: string;
  question: string;
  answer: string;
}

type Phase = 'idle' | 'questioning' | 'searching' | 'results';

interface GuidedSession {
  id: string;
  label: string; // category + first answer
  categoryLabel: string;
  answers: Answer[];
  result: GuidedResult | null;
  updatedAt: number;
}

interface GuidedResult {
  answer: string;
  articles: Article[];
  allCandidates: Article[];
  expandedTerms: string[];
}

interface ParamFormQuestion {
  key: string;
  text: string;
  options: string[] | null;
}

interface ParamForm {
  questions: ParamFormQuestion[];
  answeredBefore: Answer[];
}

interface CurrentQuestion {
  text: string;
  options: string[] | null;
  hint: string | null;
  index: number;
  total: number;
}

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------

function loadSessions(): GuidedSession[] {
  try { return JSON.parse(localStorage.getItem(GUIDED_SESSIONS_KEY) ?? '[]'); }
  catch { return []; }
}

function saveSessions(sessions: GuidedSession[]) {
  localStorage.setItem(GUIDED_SESSIONS_KEY, JSON.stringify(sessions.slice(0, 20)));
}

function relativeDate(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'právě teď';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min`;
  if (diff < 86_400_000) return 'dnes';
  if (diff < 172_800_000) return 'včera';
  return new Date(ts).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' });
}

// ---------------------------------------------------------------------------
// Article card (reused from AiChat pattern)
// ---------------------------------------------------------------------------

function AiArticleCard({ article, dim = false }: { article: Article; dim?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(article.artikl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const googleSearch = () => {
    const q = encodeURIComponent(article.typoveOznaceni || article.nazev);
    window.open(`https://www.google.com/search?q=${q}`, '_blank', 'noopener');
  };
  return (
    <div className={`border rounded-xl p-2 space-y-1 transition-colors ${
      dim ? 'bg-mantle border-surface1 hover:bg-surface0' : 'bg-surface0 border-surface2 hover:bg-surface1'
    }`}>
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-mauve font-semibold text-xs">{article.artikl}</span>
          <button onClick={copy} title="Kopírovat artikl" className="text-overlay1 hover:text-mauve transition-colors">
            {copied ? <Check size={11} /> : <Copy size={11} />}
          </button>
        </div>
        <span className="text-subtext0 text-[10px] shrink-0">{article.vyrobce}</span>
      </div>
      <div className="text-text text-xs font-medium leading-snug">{article.nazev}</div>
      {article.typoveOznaceni && (
        <div className="flex items-center gap-1">
          <span className="text-subtext0 text-[10px]">{article.typoveOznaceni}</span>
          <button onClick={googleSearch} title="Hledat na Google" className="text-overlay1 hover:text-mauve transition-colors shrink-0">
            <ExternalLink size={10} />
          </button>
        </div>
      )}
      {article.vybehovyDil === 'U' && (
        <span className="text-[10px] text-red font-medium">⚠ Výběhový díl</span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Markdown components
// ---------------------------------------------------------------------------

const MD_COMPONENTS: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-mauve">{children}</strong>,
  em: ({ children }) => <em className="italic text-subtext1">{children}</em>,
  ul: ({ children }) => <ul className="list-disc list-outside ml-4 space-y-1 mt-1.5 mb-1.5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal list-outside ml-4 space-y-1 mt-1.5 mb-1.5">{children}</ol>,
  li: ({ children }) => <li className="pl-0.5">{children}</li>,
  code: ({ children, className }) => {
    if (className) return <code className="text-teal">{children}</code>;
    return <code className="bg-surface1 rounded px-1.5 py-0.5 font-mono text-sm text-teal">{children}</code>;
  },
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-mauve underline hover:text-pink">{children}</a>
  ),
  h1: ({ children }) => <h1 className="text-lg font-bold text-text mt-4 mb-1.5">{children}</h1>,
  h2: ({ children }) => <h2 className="text-base font-bold text-text mt-3 mb-1">{children}</h2>,
  h3: ({ children }) => <h3 className="text-sm font-bold text-subtext1 mt-2 mb-0.5">{children}</h3>,
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function GuidedSearch() {
  // Core state
  const [phase, setPhase] = useState<Phase>('idle');
  const [category, setCategory] = useState<string | null>(null);
  const [categoryLabel, setCategoryLabel] = useState<string | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<CurrentQuestion | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [result, setResult] = useState<GuidedResult | null>(null);
  const [paramForm, setParamForm] = useState<ParamForm | null>(null);
  const [paramFormValues, setParamFormValues] = useState<Record<string, string>>({});

  // UI state
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusLabel, setStatusLabel] = useState<string>('');
  const [searchTerms, setSearchTerms] = useState<string[]>([]);
  const [showAllCandidates, setShowAllCandidates] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  // Sessions
  const [sessions, setSessions] = useState<GuidedSession[]>(() => loadSessions());
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  // Category chips
  const [categories, setCategories] = useState<{ key: string; label: string }[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const requestCounterRef = useRef(0);
  // Always-current ref so sendRequest (stable identity, empty deps) never captures a stale handleEvent
  const handleEventRef = useRef<(et: string, d: Record<string, unknown>, ic: () => boolean) => void>(() => {});

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, [phase, currentQuestion]);

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/guided-categories`)
      .then(r => r.json())
      .then((data: { key: string; label: string }[]) => setCategories(data))
      .catch(() => {});
  }, []);


  // ---------------------------------------------------------------------------
  // Reset / new session
  // ---------------------------------------------------------------------------

  const resetState = useCallback(() => {
    setPhase('idle');
    setCategory(null);
    setCategoryLabel(null);
    setCurrentQuestion(null);
    setAnswers([]);
    setResult(null);
    setParamForm(null);
    setParamFormValues({});
    setInput('');
    setStatusLabel('');
    setSearchTerms([]);
    setShowAllCandidates(false);
    setShowTerms(false);
    setCurrentSessionId(null);
    requestCounterRef.current++;
  }, []);

  // ---------------------------------------------------------------------------
  // Save session
  // ---------------------------------------------------------------------------

  const saveSession = useCallback((
    _cat: string,
    catLabel: string,
    ans: Answer[],
    res: GuidedResult | null,
    existingId?: string | null,
  ) => {
    const id = existingId ?? `guided-${Date.now()}`;
    const label = catLabel + (ans.length > 0 ? ` — ${ans[0].answer}` : '');
    const entry: GuidedSession = {
      id,
      label,
      categoryLabel: catLabel,
      answers: ans,
      result: res,
      updatedAt: Date.now(),
    };
    const all = loadSessions();
    const idx = all.findIndex(s => s.id === id);
    if (idx >= 0) { all[idx] = entry; } else { all.unshift(entry); }
    saveSessions(all);
    setSessions(all.slice(0, 20));
    return id;
  }, []);

  // ---------------------------------------------------------------------------
  // Load session
  // ---------------------------------------------------------------------------

  const loadSession = useCallback((session: GuidedSession) => {
    resetState();
    setCurrentSessionId(session.id);
    setCategoryLabel(session.categoryLabel);
    setAnswers(session.answers);
    if (session.result) {
      setPhase('results');
      setResult(session.result);
      setSearchTerms(session.result.expandedTerms ?? []);
    }
    setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 50);
  }, [resetState]);

  // ---------------------------------------------------------------------------
  // SSE stream helper
  // ---------------------------------------------------------------------------

  const sendRequest = useCallback(async (body: object) => {
    const myCount = ++requestCounterRef.current;
    const isCurrent = () => requestCounterRef.current === myCount;

    setIsLoading(true);
    setStatusLabel('Zpracovávám…');

    try {
      const response = await fetch(`${BACKEND_URL}/api/guided-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok || !response.body) throw new Error('Server error');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let eventType = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            if (!isCurrent()) return;
            try {
              const data = JSON.parse(line.slice(6));
              handleEventRef.current(eventType, data, isCurrent);
            } catch { /* ignore parse errors */ }
            eventType = '';
          }
        }
      }
    } catch (err) {
      if (isCurrent()) {
        setStatusLabel('');
        setIsLoading(false);
      }
    } finally {
      if (isCurrent()) setIsLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------------------
  // Event handler — processes SSE events from backend
  // ---------------------------------------------------------------------------

  const handleEvent = useCallback((
    eventType: string,
    data: Record<string, unknown>,
    isCurrent: () => boolean,
  ) => {
    if (!isCurrent()) return;

    if (eventType === 'status') {
      setStatusLabel(String(data.label ?? ''));
      return;
    }

    if (eventType === 'category') {
      const cat = String(data.category ?? '');
      const catLabel = String(data.categoryLabel ?? '');
      setCategory(cat);
      setCategoryLabel(catLabel);
      setPhase('questioning');
      setCurrentQuestion({
        text: String(data.question ?? ''),
        options: Array.isArray(data.options) ? (data.options as string[]) : null,
        hint: data.hint ? String(data.hint) : null,
        index: Number(data.questionIndex ?? 0),
        total: Number(data.questionTotal ?? 1),
      });
      setStatusLabel('');
      setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 50);
      return;
    }

    if (eventType === 'parameter_form') {
      const questions = Array.isArray(data.formQuestions) ? (data.formQuestions as ParamFormQuestion[]) : [];
      const prevAnswers = Array.isArray(data.answers) ? (data.answers as Answer[]) : [];
      const defaults: Record<string, string> = {};
      for (const q of questions) {
        if (q.options && q.options.length > 0) defaults[q.key] = q.options[q.options.length - 1];
      }
      setParamForm({ questions, answeredBefore: prevAnswers });
      setParamFormValues(defaults);
      setAnswers(prevAnswers);
      setCurrentQuestion(null);
      setStatusLabel('');
      return;
    }

    if (eventType === 'question') {
      // Backend returns next question; also echoes back updated answers
      if (Array.isArray(data.answers)) {
        setAnswers(data.answers as Answer[]);
      }
      if (data.isAskCategory) {
        // Special case: couldn't detect category, asking user
        setCurrentQuestion({
          text: String(data.question ?? ''),
          options: Array.isArray(data.options) ? (data.options as string[]) : null,
          hint: null,
          index: 0,
          total: 1,
        });
      } else {
        setCurrentQuestion({
          text: String(data.question ?? ''),
          options: Array.isArray(data.options) ? (data.options as string[]) : null,
          hint: data.hint ? String(data.hint) : null,
          index: Number(data.questionIndex ?? 0),
          total: Number(data.questionTotal ?? 1),
        });
      }
      setStatusLabel('');
      setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 50);
      return;
    }

    if (eventType === 'searching') {
      setPhase('searching');
      setSearchTerms(Array.isArray(data.terms) ? (data.terms as string[]) : []);
      setStatusLabel('Vyhledávám v databázi…');
      return;
    }

    if (eventType === 'result') {
      const res: GuidedResult = {
        answer: String(data.answer ?? ''),
        articles: Array.isArray(data.articles) ? (data.articles as Article[]) : [],
        allCandidates: Array.isArray(data.allCandidates) ? (data.allCandidates as Article[]) : [],
        expandedTerms: Array.isArray(data.expandedTerms) ? (data.expandedTerms as string[]) : [],
      };
      const finalAnswers = Array.isArray(data.answers) ? (data.answers as Answer[]) : answers;

      setResult(res);
      setAnswers(finalAnswers);
      setPhase('results');
      setCurrentQuestion(null);
      setStatusLabel('');

      // Save session
      if (category && categoryLabel) {
        const sid = saveSession(category, categoryLabel, finalAnswers, res, currentSessionId);
        setCurrentSessionId(sid);
      }
      return;
    }

    if (eventType === 'error') {
      setStatusLabel('');
      setPhase(phase === 'searching' ? 'results' : phase);
      return;
    }
  }, [answers, category, categoryLabel, currentSessionId, phase, saveSession]);
  // Keep ref in sync so sendRequest always calls the latest version
  handleEventRef.current = handleEvent;

  // ---------------------------------------------------------------------------
  // Submit handler
  // ---------------------------------------------------------------------------

  const handleSubmit = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput('');

    if (phase === 'idle') {
      // First message — detect category
      await sendRequest({
        message: text,
        phase: 'initial',
        category: null,
        answers: [],
      });
      return;
    }

    if (phase === 'questioning' && currentQuestion) {
      // Record this answer locally for display while loading
      const newAnswers = [
        ...answers,
        { key: '', question: currentQuestion.text, answer: text },
      ];
      setAnswers(newAnswers);
      setCurrentQuestion(null);

      await sendRequest({
        message: text,
        phase: 'questioning',
        category,
        answers, // previous answers, current answer is in message
      });
      return;
    }
  }, [input, isLoading, phase, currentQuestion, answers, category, sendRequest]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleOptionClick = useCallback(async (option: string) => {
    if (isLoading) return;

    if (phase === 'idle') {
      await sendRequest({ message: option, phase: 'initial', category: null, answers: [] });
      return;
    }

    if (phase === 'questioning' && currentQuestion) {
      const newAnswers = [...answers, { key: '', question: currentQuestion.text, answer: option }];
      setAnswers(newAnswers);
      setCurrentQuestion(null);
      await sendRequest({ message: option, phase: 'questioning', category, answers });
    }
  }, [isLoading, phase, currentQuestion, answers, category, sendRequest]);

  const handleCategoryChipClick = useCallback(async (key: string) => {
    if (isLoading) return;
    await sendRequest({ message: '', phase: 'initial', categoryKey: key, answers: [] });
  }, [isLoading, sendRequest]);

  const handleParamFormSubmit = useCallback(async () => {
    if (!paramForm || isLoading) return;

    const formAnswers: Answer[] = paramForm.questions.map(q => ({
      key: q.key,
      question: q.text,
      answer: paramFormValues[q.key] ?? (q.options?.[q.options.length - 1] ?? 'Bez omezení'),
    }));

    const allDisplayAnswers = [...paramForm.answeredBefore, ...formAnswers];
    setAnswers(allDisplayAnswers);
    setParamForm(null);

    const prevForBackend = [...paramForm.answeredBefore, ...formAnswers.slice(0, -1)];
    const lastAns = formAnswers[formAnswers.length - 1];
    await sendRequest({
      message: lastAns.answer,
      phase: 'questioning',
      category,
      answers: prevForBackend,
    });
  }, [paramForm, paramFormValues, isLoading, category, sendRequest]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const progressPercent = currentQuestion
    ? Math.round(((currentQuestion.index) / currentQuestion.total) * 100)
    : paramForm ? 20
    : phase === 'searching' ? 90
    : phase === 'results' ? 100
    : 0;

  return (
    <div
      className="flex rounded-2xl overflow-hidden border border-surface1"
      style={{ height: 'calc(100vh - 130px)', minHeight: '600px', boxShadow: '0 0 32px 4px rgba(203,166,247,0.08)' }}
    >
      {/* ------------------------------------------------------------------ */}
      {/* Left sidebar — session history                                       */}
      {/* ------------------------------------------------------------------ */}
      <div className="w-52 shrink-0 bg-crust border-r border-surface1 flex flex-col overflow-hidden">
        <div className="px-2 py-2.5 border-b border-surface1 shrink-0">
          <button
            onClick={resetState}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm text-subtext1 hover:bg-surface0 hover:text-text transition-colors"
          >
            <PenLine size={13} />
            Nové hledání
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-1.5 space-y-px px-1.5 min-h-0">
          {sessions.length === 0 && (
            <p className="text-xs text-overlay0 px-2 py-3 text-center">Žádná předchozí hledání</p>
          )}
          {sessions.map(s => (
            <div
              key={s.id}
              className={`group flex items-start gap-1 rounded-lg px-2 py-1.5 transition-colors ${
                s.id === currentSessionId
                  ? 'bg-surface1 text-text'
                  : 'hover:bg-surface0 text-subtext1 hover:text-text cursor-pointer'
              }`}
            >
              <button onClick={() => loadSession(s)} className="flex-1 min-w-0 text-left">
                <div className="text-xs font-medium truncate leading-snug">{s.label}</div>
                <div className="text-[10px] text-overlay0 mt-0.5">{relativeDate(s.updatedAt)}</div>
              </button>
              <button
                onClick={e => {
                  e.stopPropagation();
                  const updated = sessions.filter(x => x.id !== s.id);
                  saveSessions(updated);
                  setSessions(updated);
                  if (currentSessionId === s.id) resetState();
                }}
                className="shrink-0 text-overlay0 hover:text-red opacity-0 group-hover:opacity-100 transition-all p-0.5 rounded mt-0.5"
                title="Smazat"
              >
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Main area                                                            */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex-1 bg-mantle flex flex-col overflow-hidden min-w-0">

        {/* Header */}
        <div className="bg-mantle border-b border-surface1 px-5 py-3 flex items-center gap-2.5 shrink-0">
          <Sparkles size={18} className="text-teal shrink-0" />
          <span className="font-semibold text-text">Řízené vyhledávání</span>
          {categoryLabel && (
            <span className="text-overlay0 text-sm">— {categoryLabel}</span>
          )}
          <div className="ml-auto flex items-center gap-2">
            {phase !== 'idle' && (
              <div className="flex items-center gap-1.5 text-xs text-overlay0">
                <div className="w-20 h-1.5 bg-surface1 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-teal rounded-full transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <span>{progressPercent}%</span>
              </div>
            )}
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto min-h-0">

          {/* ---------------------------------------------------------------- */}
          {/* IDLE — welcome screen                                             */}
          {/* ---------------------------------------------------------------- */}
          {phase === 'idle' && (
            <div className="flex flex-col items-center justify-center h-full px-8 py-6 text-center space-y-5">
              <div>
                <h2 className="text-2xl font-bold text-text mb-2">Řízené vyhledávání</h2>
                <p className="text-subtext1 text-sm max-w-md leading-relaxed">
                  Průvodce ti postupnými otázkami pomůže přesně specifikovat hledaný díl.
                  AI na základě odpovědí vygeneruje desítky vyhledávacích termínů a najde nejlepší shody.
                </p>
              </div>

              {categories.length > 0 && (
                <div className="w-full max-w-2xl space-y-4 text-left">
                  {/* Komponenty group */}
                  {categories.filter(c => !c.key.includes('prislusenstvi')).length > 0 && (
                    <div>
                      <p className="text-[11px] text-overlay0 uppercase tracking-wider mb-2 px-1">Komponenty</p>
                      <div className="flex flex-wrap gap-2">
                        {categories.filter(c => !c.key.includes('prislusenstvi')).map(cat => (
                          <button
                            key={cat.key}
                            onClick={() => handleCategoryChipClick(cat.key)}
                            disabled={isLoading}
                            className="px-3 py-1.5 rounded-xl bg-surface0 hover:bg-teal/20 hover:text-teal border border-surface1 hover:border-teal/40 text-subtext1 text-xs transition-colors disabled:opacity-40"
                          >
                            {cat.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Příslušenství group */}
                  {categories.filter(c => c.key.includes('prislusenstvi')).length > 0 && (
                    <div>
                      <p className="text-[11px] text-overlay0 uppercase tracking-wider mb-2 px-1">Příslušenství</p>
                      <div className="flex flex-wrap gap-2">
                        {categories.filter(c => c.key.includes('prislusenstvi')).map(cat => (
                          <button
                            key={cat.key}
                            onClick={() => handleCategoryChipClick(cat.key)}
                            disabled={isLoading}
                            className="px-3 py-1.5 rounded-xl bg-surface0 hover:bg-mauve/20 hover:text-mauve border border-surface1 hover:border-mauve/40 text-subtext1 text-xs transition-colors disabled:opacity-40"
                          >
                            {cat.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <p className="text-xs text-overlay0">nebo napiš název komponenty do pole níže</p>
            </div>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* QUESTIONING / SEARCHING / RESULTS — main flow                   */}
          {/* ---------------------------------------------------------------- */}
          {phase !== 'idle' && (
            <div className="px-6 py-5 space-y-6 max-w-3xl mx-auto">

              {/* Answered questions — history */}
              {answers.length > 0 && (
                <div className="space-y-2">
                  {answers.map((a, i) => (
                    <div key={i} className="flex gap-3 items-start">
                      <div className="text-xs text-overlay0 w-4 mt-0.5 shrink-0 font-mono">{i + 1}.</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-overlay0 mb-0.5">{a.question}</p>
                        <p className="text-sm font-medium text-teal">{a.answer}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Parameter form — vodic_kabel shows all params at once */}
              {phase === 'questioning' && paramForm && !isLoading && (
                <div className="space-y-4">
                  <p className="text-sm font-semibold text-text">Upřesni parametry</p>
                  <div className="space-y-2.5">
                    {paramForm.questions.map(q => {
                      const selected = paramFormValues[q.key];
                      const shortLabel = q.text
                        .replace('Použití v energetickém řetězu (e-chain)', 'E-chain')
                        .replace('(volitelně)', '')
                        .replace('?', '')
                        .trim();
                      return (
                        <div key={q.key} className="flex items-start gap-3">
                          <div className="w-32 shrink-0 text-xs text-subtext0 pt-1 leading-snug">{shortLabel}</div>
                          {q.options && (
                            <div className="flex flex-wrap gap-1.5">
                              {q.options.map(opt => {
                                const isNone = opt === 'Bez omezení' || opt === 'Bez preference';
                                const isSelected = selected === opt;
                                return (
                                  <button
                                    key={opt}
                                    onClick={() => setParamFormValues(prev => ({ ...prev, [q.key]: opt }))}
                                    className={`px-2.5 py-0.5 text-xs rounded-lg border transition-colors ${
                                      isSelected
                                        ? isNone
                                          ? 'bg-surface1 border-surface2 text-overlay1'
                                          : 'bg-teal/20 border-teal/60 text-teal font-medium'
                                        : 'bg-surface0 border-surface1 text-subtext0 hover:border-teal/40 hover:text-teal'
                                    }`}
                                  >
                                    {opt}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <button
                    onClick={handleParamFormSubmit}
                    disabled={isLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-teal hover:bg-teal/80 text-crust rounded-xl text-sm font-medium transition-colors disabled:opacity-40"
                  >
                    <Search size={14} />
                    Hledat
                  </button>
                </div>
              )}

              {/* Current question (large) — single-answer categories */}
              {(phase === 'questioning' && currentQuestion && !paramForm) && (
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <div className="text-xs text-overlay0 w-4 mt-0.5 shrink-0 font-mono">
                      {currentQuestion.index + 1}.
                    </div>
                    <div className="flex-1">
                      <p className="text-lg font-semibold text-text leading-snug">
                        {currentQuestion.text}
                      </p>
                      {currentQuestion.hint && (
                        <p className="text-xs text-overlay0 mt-1">{currentQuestion.hint}</p>
                      )}
                    </div>
                    <span className="text-xs text-overlay0 shrink-0 mt-1">
                      {currentQuestion.index + 1}/{currentQuestion.total}
                    </span>
                  </div>

                  {/* Option chips */}
                  {currentQuestion.options && (
                    <div className="flex flex-wrap gap-2 pl-6">
                      {currentQuestion.options.map((opt, i) => (
                        <button
                          key={i}
                          onClick={() => handleOptionClick(opt)}
                          disabled={isLoading}
                          className="px-3 py-1.5 rounded-xl text-sm bg-surface0 hover:bg-teal/20 hover:text-teal border border-surface1 hover:border-teal/40 text-subtext1 transition-colors disabled:opacity-40 flex items-center gap-1.5"
                        >
                          <ArrowRight size={12} className="text-overlay0" />
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Loading / searching status */}
              {isLoading && (
                <div className="flex items-center gap-2 text-sm text-subtext0">
                  <Loader2 size={14} className="animate-spin text-teal" />
                  <span>{statusLabel || 'Zpracovávám…'}</span>
                </div>
              )}

              {/* Search terms display */}
              {phase === 'searching' && searchTerms.length > 0 && (
                <div className="space-y-2">
                  <button
                    onClick={() => setShowTerms(v => !v)}
                    className="flex items-center gap-1.5 text-xs text-overlay0 hover:text-subtext0 transition-colors"
                  >
                    <Search size={10} />
                    {showTerms ? 'Skrýt' : 'Zobrazit'} vyhledávané termíny ({searchTerms.length})
                    {showTerms ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                  </button>
                  {showTerms && (
                    <div className="flex flex-wrap gap-1.5 pl-4">
                      {searchTerms.map((t, i) => (
                        <span key={i} className="text-[11px] bg-surface1 text-subtext0 rounded-md px-2 py-0.5 font-mono">{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Results */}
              {phase === 'results' && result && (
                <div className="space-y-4">
                  {/* Search terms toggle */}
                  {result.expandedTerms.length > 0 && (
                    <div className="space-y-1.5">
                      <button
                        onClick={() => setShowTerms(v => !v)}
                        className="flex items-center gap-1.5 text-xs text-overlay0 hover:text-subtext0 transition-colors"
                      >
                        <Search size={10} />
                        {showTerms ? 'Skrýt' : 'Zobrazit'} použité termíny ({result.expandedTerms.length})
                        {showTerms ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                      </button>
                      {showTerms && (
                        <div className="flex flex-wrap gap-1.5">
                          {result.expandedTerms.map((t, i) => (
                            <span key={i} className="text-[11px] bg-surface1 text-subtext0 rounded-md px-2 py-0.5 font-mono">{t}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* AI answer bubble */}
                  <div className="bg-surface0 text-text text-sm rounded-2xl px-5 py-4 leading-relaxed">
                    <ReactMarkdown components={MD_COMPONENTS} remarkPlugins={[remarkGfm]}>
                      {result.answer}
                    </ReactMarkdown>
                  </div>

                  {/* Top articles */}
                  {result.articles.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs text-subtext0 uppercase tracking-wide font-medium">
                        Vybrané artikly ({result.articles.length})
                      </p>
                      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                        {result.articles.map(a => (
                          <AiArticleCard key={a.artikl} article={a} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* All candidates */}
                  {result.allCandidates.length > 0 && (
                    <div>
                      <button
                        onClick={() => setShowAllCandidates(v => !v)}
                        className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-surface0 hover:bg-surface1 text-subtext1 hover:text-text transition-colors"
                      >
                        {showAllCandidates ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        {showAllCandidates
                          ? 'Skrýt všechny nalezené'
                          : `Zobrazit všechny nalezené (${result.allCandidates.length})`}
                      </button>
                      {showAllCandidates && (
                        <div className="mt-3 grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-1.5">
                          {result.allCandidates.map(a => (
                            <AiArticleCard key={a.artikl} article={a} dim />
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* New search prompt */}
                  <div className="border-t border-surface1 pt-4">
                    <button
                      onClick={resetState}
                      className="flex items-center gap-2 text-sm text-subtext1 hover:text-mauve transition-colors"
                    >
                      <PenLine size={14} />
                      Začít nové hledání
                    </button>
                  </div>
                </div>
              )}

            </div>
          )}
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Input bar — shown during questioning phase and idle               */}
        {/* ---------------------------------------------------------------- */}
        {(phase === 'idle' || (phase === 'questioning' && !paramForm)) && (
          <div className="border-t border-surface1 bg-mantle p-3 shrink-0">
            <div className="flex gap-2 max-w-3xl mx-auto">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  phase === 'idle'
                    ? 'Napiš název dílu (např. jistič, stykač, průchodka…)'
                    : currentQuestion?.options
                    ? 'Zvol možnost nebo napiš vlastní odpověď…'
                    : 'Napiš odpověď…'
                }
                disabled={isLoading}
                className="flex-1 bg-surface0 border border-surface1 rounded-xl px-4 py-2.5 text-text placeholder:text-overlay0
                  focus:outline-none focus:ring-2 focus:ring-teal focus:border-transparent"
              />
              <button
                onClick={handleSubmit}
                disabled={isLoading || !input.trim()}
                className="bg-teal hover:bg-teal/80 disabled:opacity-40 text-crust rounded-xl px-4 py-2.5 transition-colors"
              >
                {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>
          </div>
        )}

      </div>{/* end main area */}
    </div>
  );
}
