import { useState, useRef, useEffect } from 'react';
import {
  Send, Loader2, Copy, Check, ExternalLink, Settings,
  PenLine, Download, ChevronDown, ChevronUp, MessageCircle, Globe,
  Search, Sparkles, BookOpen,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import type { Article } from '../types';

const BACKEND_URL = ((import.meta.env.VITE_BACKEND_URL as string | undefined) ?? '').trim().replace(/\/$/, '');
const AI_CHAT_KEY = 'robo-filler-ai-chat';
const AI_CHAT_LAST_KEY = 'robo-filler-ai-chat-last';
const SYNTH_MODEL_KEY = 'karel_bot_synth_model';
const USAGE_KEY = 'robo-filler-chat-usage';

// Track query timestamps and check thresholds: 20+ in 2h or 40+ in 24h
function recordQuery(): boolean {
  const now = Date.now();
  const stored: number[] = JSON.parse(localStorage.getItem(USAGE_KEY) ?? '[]');
  const pruned = stored.filter(t => now - t < 24 * 60 * 60 * 1000);
  pruned.push(now);
  localStorage.setItem(USAGE_KEY, JSON.stringify(pruned));
  const last2h = pruned.filter(t => now - t < 2 * 60 * 60 * 1000).length;
  return last2h > 20 || pruned.length > 40;
}

const SYNTH_MODELS = [
  { value: 'mistral-small-latest', label: 'Mistral Small 4' },
  { value: 'mistral-medium-latest', label: 'Mistral Medium 3.5' },
];

interface Status {
  step: string;
  label: string;
  terms?: string[];
  webQuery?: boolean;
  refinement?: boolean;
  mfr?: string[];
}

interface AiMessage {
  role: 'user' | 'assistant';
  content: string;
  articles?: Article[];
  allCandidates?: Article[];
  expandedTerms?: string[];
  statusLog?: Status[];
}

const GREETINGS = [
  'Ahoj! Hledáš konkrétní artikl, nebo potřebuješ poradit s aplikací?',
  'Dobrý den! Napiš název, artikl nebo výrobce — najdu co potřebuješ.',
  'Zdravím! Jsem Karel Bot. Pomohu ti najít průmyslový artikl nebo odpovím na otázky k aplikaci.',
  'Ahoj! S čím mohu dnes pomoci? Stačí napsat co hledáš.',
  'Dobrý den! Zadej co hledáš — artikl, komponent nebo dotaz na aplikaci — a já se postarám.',
];

function AiArticleCard({ article, dim = false }: { article: Article; dim?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copyArtkl = () => {
    navigator.clipboard.writeText(article.artikl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const googleSearch = () => {
    const q = encodeURIComponent(article.typoveOznaceni || article.nazev);
    window.open(`https://www.google.com/search?q=${q}`, '_blank', 'noopener');
  };
  return (
    <div className={`border rounded-xl p-3.5 space-y-1.5 transition-colors ${
      dim
        ? 'bg-mantle border-surface1 hover:bg-surface0'
        : 'bg-surface0 border-surface2 hover:bg-surface1'
    }`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-mauve font-semibold text-sm">{article.artikl}</span>
          <button onClick={copyArtkl} title="Kopírovat artikl" className="text-overlay1 hover:text-mauve transition-colors">
            {copied ? <Check size={13} /> : <Copy size={13} />}
          </button>
        </div>
        <span className="text-subtext0 text-xs shrink-0">{article.vyrobce}</span>
      </div>
      <div className="text-text text-sm font-medium leading-snug">{article.nazev}</div>
      {article.typoveOznaceni && (
        <div className="flex items-center gap-1.5">
          <span className="text-subtext0 text-xs">{article.typoveOznaceni}</span>
          <button onClick={googleSearch} title="Hledat na Google" className="text-overlay1 hover:text-mauve transition-colors shrink-0">
            <ExternalLink size={11} />
          </button>
        </div>
      )}
      {article.vybehovyDil === 'U' && (
        <span className="text-xs text-red font-medium">⚠ Výběhový díl</span>
      )}
    </div>
  );
}

const MD_COMPONENTS: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-mauve">{children}</strong>,
  ul: ({ children }) => <ul className="list-disc list-outside ml-4 space-y-1.5 mt-1.5 [&_ul]:list-none [&_ul]:ml-2 [&_ul]:space-y-0.5 [&_ul]:mt-0.5 [&_ul]:text-subtext1">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal list-outside ml-4 space-y-1 mt-1.5">{children}</ol>,
  li: ({ children }) => <li className="pl-0.5">{children}</li>,
  code: ({ children }) => <code className="bg-surface1 rounded px-1.5 py-0.5 font-mono text-sm">{children}</code>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-mauve underline hover:text-pink">{children}</a>
  ),
  h2: ({ children }) => <h2 className="text-base font-bold text-text mt-3 mb-1">{children}</h2>,
  h3: ({ children }) => <h3 className="text-sm font-bold text-subtext1 mt-2 mb-0.5">{children}</h3>,
  table: ({ children }) => (
    <div className="overflow-x-auto my-2">
      <table className="text-sm border-collapse w-full">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-surface1">{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => <tr className="border-b border-surface2">{children}</tr>,
  th: ({ children }) => <th className="px-3 py-1.5 text-left font-semibold text-mauve">{children}</th>,
  td: ({ children }) => <td className="px-3 py-1.5">{children}</td>,
};

function StatusTrace({ log, isLoading = false }: { log: Status[]; isLoading?: boolean }) {
  if (log.length === 0) return null;
  return (
    <div className="space-y-1">
      {log.map((s, i) => {
        const isLast = isLoading && i === log.length - 1;
        const hasPills = s.terms && s.terms.length > 0;
        return (
          <div key={i} className="flex items-start gap-1.5 text-xs">
            <span className={`shrink-0 mt-0.5 ${isLast ? 'text-mauve' : 'text-overlay0'}`}>
              {isLast
                ? <Loader2 size={10} className="animate-spin" />
                : s.step === 'searching'
                ? <Search size={10} />
                : s.step === 'generating'
                ? <Sparkles size={10} />
                : s.step === 'knowledge'
                ? <BookOpen size={10} />
                : <span className="inline-block w-2.5 text-center">·</span>
              }
            </span>
            {s.mfr && s.mfr.length > 0 ? (
              <div className="flex flex-wrap gap-1 items-baseline">
                <span className="text-overlay0 shrink-0">Získávám znalosti o:</span>
                {s.mfr.map((m, mi) => (
                  <span key={mi} className="bg-surface1 text-subtext0 rounded px-1.5 py-0.5 font-mono leading-none">
                    {m}
                  </span>
                ))}
              </div>
            ) : hasPills ? (
              <div className="flex flex-wrap gap-1 items-baseline">
                <span className="text-overlay0 shrink-0">
                  {s.refinement ? 'upřesnění:' : s.webQuery ? 'web:' : 'hledám:'}
                </span>
                {s.terms!.map((t, ti) => (
                  <span key={ti} className="bg-surface1 text-subtext0 rounded px-1.5 py-0.5 font-mono leading-none">
                    {t}
                  </span>
                ))}
              </div>
            ) : (
              <span className={isLast ? 'text-subtext1' : 'text-overlay0'}>{s.label}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function StatusTraceToggle({
  log,
  isLoading = false,
  expanded,
  onToggle,
}: {
  log: Status[];
  isLoading?: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  if (log.length === 0) return null;
  const allTerms = log
    .filter(s => s.step === 'searching' && s.terms?.length)
    .flatMap(s => s.terms!);
  return (
    <div className="rounded-xl border border-surface1 overflow-hidden text-xs">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-1.5 px-3 py-1.5 text-overlay0 hover:text-subtext0 transition-colors hover:bg-surface0/40"
      >
        {isLoading
          ? <Loader2 size={10} className="animate-spin text-mauve shrink-0" />
          : <Search size={10} className="shrink-0" />
        }
        {expanded ? (
          <span className="flex-1 text-left">postup hledání</span>
        ) : allTerms.length > 0 ? (
          <div className="flex flex-wrap gap-1 flex-1 min-w-0 items-center">
            {allTerms.slice(0, 8).map((t, i) => (
              <span key={i} className="bg-surface1 text-subtext0 rounded px-1.5 py-0.5 font-mono leading-none">{t}</span>
            ))}
            {allTerms.length > 8 && <span className="text-overlay0">+{allTerms.length - 8}</span>}
          </div>
        ) : (
          <span className="flex-1 text-left truncate">{log[log.length - 1]?.label}</span>
        )}
        <ChevronDown size={10} className={`shrink-0 transition-transform duration-150 ml-1 ${expanded ? 'rotate-180' : ''}`} />
      </button>
      {expanded && (
        <div className="px-3 pb-2.5 pt-1.5 border-t border-surface1/50">
          <StatusTrace log={log} isLoading={isLoading} />
        </div>
      )}
    </div>
  );
}

export function AiChat() {
  const [greeting] = useState(() => GREETINGS[Math.floor(Math.random() * GREETINGS.length)]);
  const [messages, setMessages] = useState<AiMessage[]>(() => {
    try { return JSON.parse(sessionStorage.getItem(AI_CHAT_KEY) ?? '[]'); }
    catch { return []; }
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentStatusLog, setCurrentStatusLog] = useState<Status[]>([]);
  const statusLogRef = useRef<Status[]>([]);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [synthModel, setSynthModelState] = useState<string>(() => {
    try {
      const { model, ts } = JSON.parse(localStorage.getItem(SYNTH_MODEL_KEY) ?? '{}');
      if (model && Date.now() - ts < 24 * 60 * 60 * 1000) return model;
    } catch {}
    return 'mistral-small-latest';
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [expandedMsgs, setExpandedMsgs] = useState<Set<number>>(new Set());
  const [expandedTraces, setExpandedTraces] = useState<Set<number>>(new Set());
  const [lastAllCandidates, setLastAllCandidates] = useState<Article[]>([]);
  const [showUsageWarning, setShowUsageWarning] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    sessionStorage.setItem(AI_CHAT_KEY, JSON.stringify(messages));
    if (messages.length > 0) localStorage.setItem(AI_CHAT_LAST_KEY, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentStatusLog]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!settingsOpen) return;
    const handler = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [settingsOpen]);

  const clearChat = () => {
    setMessages([]);
    setExpandedMsgs(new Set());
    setExpandedTraces(new Set());
    setLastAllCandidates([]);
    setCurrentStatusLog([]);
    statusLogRef.current = [];
    sessionStorage.removeItem(AI_CHAT_KEY);
  };

  const restoreLastChat = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(AI_CHAT_LAST_KEY) ?? '[]');
      if (saved.length > 0) { setMessages(saved); setSettingsOpen(false); }
    } catch {}
  };

  const exportConversation = () => {
    if (messages.length === 0) return;
    const lines: string[] = ['# Karel Bot — Export konverzace\n'];
    for (const msg of messages) {
      if (msg.role === 'user') {
        lines.push(`**Uživatel:** ${msg.content}\n`);
      } else {
        lines.push(`**Karel Bot:**\n\n${msg.content}\n`);
        if (msg.articles?.length) {
          lines.push('\n**Vybrané artikly:**\n');
          for (const a of msg.articles) {
            lines.push(`- ${a.artikl} | ${a.vyrobce} | ${a.nazev}${a.typoveOznaceni ? ` | ${a.typoveOznaceni}` : ''}`);
          }
          lines.push('');
        }
      }
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `karel-bot-konverzace-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCandidates = () => {
    if (lastAllCandidates.length === 0) return;
    const header = 'Typové označení;Artikl;Výrobce;Název;Číslo dílu výrobce;Výběhový díl';
    const rows = lastAllCandidates.map(a =>
      [a.typoveOznaceni, a.artikl, a.vyrobce, a.nazev, a.cisloDiluVyrobce, a.vybehovyDil]
        .map(v => `"${String(v ?? '').replace(/"/g, '""')}"`)
        .join(';')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `karel-bot-artikly-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleExpanded = (idx: number) => {
    setExpandedMsgs(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const toggleTrace = (idx: number) => {
    setExpandedTraces(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  async function sendMessage() {
    const text = input.trim();
    if (!text || isLoading) return;

    if (recordQuery()) setShowUsageWarning(true);

    const userMsg: AiMessage = { role: 'user', content: text };
    setInput('');
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);
    setCurrentStatusLog([]);
    statusLogRef.current = [];

    const history = [...messages, userMsg]
      .slice(-8)
      .map(m => ({ role: m.role, content: m.content }));

    try {
      const response = await fetch(`${BACKEND_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history, webSearchEnabled, synthModel }),
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
            try {
              const data = JSON.parse(line.slice(6));
              if (eventType === 'status') {
                const newLog = [...statusLogRef.current, data as Status];
                statusLogRef.current = newLog;
                setCurrentStatusLog(newLog);
              } else if (eventType === 'result') {
                if (data.allCandidates?.length > 0) setLastAllCandidates(data.allCandidates);
                const savedLog = statusLogRef.current;
                statusLogRef.current = [];
                setCurrentStatusLog([]);
                setMessages(prev => [...prev, {
                  role: 'assistant',
                  content: data.answer,
                  articles: data.articles,
                  allCandidates: data.allCandidates,
                  expandedTerms: data.expandedTerms,
                  statusLog: savedLog,
                }]);
              } else if (eventType === 'error') {
                const savedLog = statusLogRef.current;
                statusLogRef.current = [];
                setCurrentStatusLog([]);
                setMessages(prev => [...prev, {
                  role: 'assistant',
                  content: `Chyba: ${data.error}`,
                  statusLog: savedLog,
                }]);
              }
            } catch { /* malformed JSON */ }
            eventType = '';
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Neznámá chyba';
      const savedLog = statusLogRef.current;
      statusLogRef.current = [];
      setCurrentStatusLog([]);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Chyba: ${msg}`,
        statusLog: savedLog,
      }]);
    } finally {
      setIsLoading(false);
    }
  }

  const hasLastChat = !!localStorage.getItem(AI_CHAT_LAST_KEY);

  return (
    <div
      className="bg-mantle rounded-2xl flex flex-col overflow-hidden border border-surface1"
      style={{ height: 'calc(100vh - 190px)', minHeight: '560px', boxShadow: '0 0 32px 4px rgba(203,166,247,0.08), 0 0 8px 0px rgba(203,166,247,0.06)' }}
    >
      {/* Header */}
      <div className="bg-mantle border-b border-surface1 px-5 py-3 flex items-center gap-2.5 shrink-0">
        <MessageCircle size={18} className="text-mauve shrink-0" />
        <span className="font-semibold text-text">Karel Bot</span>
        <span className="text-overlay0 text-sm">AI mód — rozšířené vyhledávání artiklů</span>
        {webSearchEnabled && (
          <span className="ml-1 flex items-center gap-1 text-xs text-teal bg-teal/10 rounded-full px-2 py-0.5">
            <Globe size={11} /> Web
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={clearChat}
            title="Nový chat"
            disabled={messages.length === 0}
            className="text-overlay1 hover:text-mauve transition-colors disabled:opacity-30 disabled:cursor-not-allowed p-1"
          >
            <PenLine size={15} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4 min-h-0">
        {messages.length === 0 && (
          <div className="max-w-5xl mx-auto space-y-5 mt-2">
            <div className="flex justify-start">
              <div className="bg-surface0 text-text rounded-2xl rounded-bl-sm px-4 py-3 leading-relaxed max-w-xl">
                {greeting}
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-subtext0 text-xs uppercase tracking-wide font-medium px-1">Hledání artiklů</p>
                {['záslepka M20', 'ABB pojistka 16A', 'Jistič 16A', 'WAGO svorka 2.5mm²'].map(ex => (
                  <button key={ex} onClick={() => { setInput(ex); inputRef.current?.focus(); }}
                    className="block w-full text-left px-3 py-2.5 rounded-xl bg-surface0 hover:bg-surface1 text-subtext1 transition-colors">
                    <em>{ex}</em>
                  </button>
                ))}
              </div>
              <div className="space-y-2">
                <p className="text-subtext0 text-xs uppercase tracking-wide font-medium px-1">Pomoc s aplikací</p>
                {[
                  'jak funguje hromadné vyhledávání?',
                  'jak exportovat kusovník?',
                  'proč mi nic nenašlo?',
                  'co je výběhový díl?',
                ].map(ex => (
                  <button key={ex} onClick={() => { setInput(ex); inputRef.current?.focus(); }}
                    className="block w-full text-left px-3 py-2.5 rounded-xl bg-surface0 hover:bg-surface1 text-subtext1 transition-colors">
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'user' ? (
                <div className="bg-mauve text-crust rounded-2xl rounded-br-sm px-4 py-2.5 max-w-[75%] leading-relaxed">
                  {msg.content}
                </div>
              ) : (
                <div className="w-full space-y-2">
                  {/* Activity trace — collapsible */}
                  {msg.statusLog && msg.statusLog.length > 0 && (
                    <StatusTraceToggle
                      log={msg.statusLog}
                      expanded={!expandedTraces.has(i)}
                      onToggle={() => toggleTrace(i)}
                    />
                  )}

                  {/* Response bubble */}
                  <div className="bg-surface0 text-text rounded-2xl rounded-bl-sm px-4 py-3 leading-relaxed">
                    <ReactMarkdown components={MD_COMPONENTS}>{msg.content}</ReactMarkdown>
                  </div>

                  {/* AI-selected top articles */}
                  {msg.articles && msg.articles.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs text-subtext0 uppercase tracking-wide font-medium px-0.5">
                        Vybrané artikly ({msg.articles.length})
                      </p>
                      <div className="grid sm:grid-cols-2 gap-2">
                        {msg.articles.map(a => (
                          <AiArticleCard key={a.artikl} article={a} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Expandable all candidates */}
                  {msg.allCandidates && msg.allCandidates.length > 0 && (
                    <div>
                      <button
                        onClick={() => toggleExpanded(i)}
                        className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-surface0 hover:bg-surface1 text-subtext1 hover:text-text transition-colors"
                      >
                        {expandedMsgs.has(i) ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        {expandedMsgs.has(i)
                          ? 'Skrýt všechny nalezené'
                          : `Zobrazit všechny nalezené (${msg.allCandidates.length})`}
                      </button>
                      {expandedMsgs.has(i) && (
                        <div className="mt-3 grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {msg.allCandidates.map(a => (
                            <AiArticleCard key={a.artikl} article={a} dim />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Live activity trace while loading — always expanded */}
          {isLoading && currentStatusLog.length > 0 && (
            <div className="flex justify-start">
              <div className="w-full max-w-xl">
                <StatusTraceToggle
                  log={currentStatusLog}
                  isLoading={true}
                  expanded={true}
                  onToggle={() => {}}
                />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-surface1 bg-mantle p-3 shrink-0">
        <div className="flex gap-2 relative">
          {/* Settings panel */}
          {settingsOpen && (
            <div ref={settingsRef}
              className="absolute bottom-full left-0 mb-2 bg-mantle border border-surface1 rounded-xl shadow-xl p-4 z-20 w-72 space-y-3">
              <p className="text-xs text-subtext0 font-semibold uppercase tracking-wide">Nastavení</p>

              {/* Web search toggle */}
              <label className="flex items-center justify-between gap-3 cursor-pointer">
                <span className="text-sm text-text">Webové vyhledávání</span>
                <button
                  role="switch"
                  aria-checked={webSearchEnabled}
                  onClick={() => setWebSearchEnabled(v => !v)}
                  className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${webSearchEnabled ? 'bg-mauve' : 'bg-surface2'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-crust rounded-full shadow transition-transform ${webSearchEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </label>

              {/* SYNTH model picker */}
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-text">Model</span>
                <div className="flex rounded-lg overflow-hidden bg-surface1">
                  {SYNTH_MODELS.map(m => (
                    <button
                      key={m.value}
                      onClick={() => { setSynthModelState(m.value); localStorage.setItem(SYNTH_MODEL_KEY, JSON.stringify({ model: m.value, ts: Date.now() })); }}
                      className={`px-3 py-1 text-xs transition-colors ${synthModel === m.value ? 'bg-mauve text-crust font-semibold' : 'text-subtext1 hover:text-text'}`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-surface1 pt-3 space-y-2">
                <p className="text-xs text-subtext0 font-semibold uppercase tracking-wide">Export</p>
                <button
                  onClick={exportConversation}
                  disabled={messages.length === 0}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-subtext1 hover:bg-surface0 hover:text-text transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-left"
                >
                  <Download size={14} />
                  Konverzace (.md)
                </button>
                <button
                  onClick={exportCandidates}
                  disabled={lastAllCandidates.length === 0}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-subtext1 hover:bg-surface0 hover:text-text transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-left"
                >
                  <Download size={14} />
                  Nalezené artikly (.csv)
                  {lastAllCandidates.length > 0 && (
                    <span className="ml-auto text-xs text-overlay1">{lastAllCandidates.length}</span>
                  )}
                </button>
              </div>

              {hasLastChat && (
                <div className="border-t border-surface1 pt-3">
                  <button
                    onClick={restoreLastChat}
                    className="w-full text-left text-sm text-subtext1 hover:text-mauve transition-colors py-1"
                  >
                    ↩ Obnovit poslední chat
                  </button>
                </div>
              )}
            </div>
          )}

          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder="Hledej artikl nebo se zeptej..."
            className="flex-1 bg-surface0 border border-surface1 rounded-xl px-4 py-2.5 text-text placeholder:text-overlay0
              focus:outline-none focus:ring-2 focus:ring-mauve focus:border-transparent"
            disabled={isLoading}
          />
          <button
            onClick={() => setSettingsOpen(v => !v)}
            title="Nastavení a export"
            className={`rounded-xl px-3 py-2.5 transition-colors ${
              settingsOpen || webSearchEnabled
                ? 'text-mauve bg-surface1 hover:bg-surface2'
                : 'text-overlay0 hover:text-subtext1 hover:bg-surface0'
            }`}
          >
            <Settings size={16} />
          </button>
          <button
            onClick={sendMessage}
            disabled={isLoading || !input.trim()}
            className="bg-mauve hover:bg-pink disabled:opacity-40 text-crust rounded-xl px-4 py-2.5 transition-colors"
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      </div>

      {/* Usage warning popup */}
      {showUsageWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-crust/70 backdrop-blur-sm"
          onClick={() => setShowUsageWarning(false)}>
          <div className="bg-mantle border border-surface1 rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3 mb-4">
              <span className="text-yellow text-xl leading-none mt-0.5">⚠</span>
              <div>
                <h3 className="text-text font-semibold text-base mb-2">Používejte s rozvahou</h3>
                <p className="text-subtext1 text-sm leading-relaxed">
                  Prosím používejte AI s rozvahou — tento chat využívá výkonné placené modely, za které se platí. Zvažte zda by pro váš dotaz nestačil klasický vyhledávač.
                </p>
                <p className="text-overlay0 text-xs leading-relaxed mt-2">
                  Pokud je ale AI pro vaši práci skutečně užitečná, klidně pokračujte — jsem rád, že se osvědčila.
                </p>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setShowUsageWarning(false)}
                className="px-4 py-1.5 rounded-lg text-sm font-medium bg-mauve text-crust hover:bg-mauve/90 transition-colors"
              >
                Rozumím
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
