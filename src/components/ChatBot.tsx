import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Loader2, Copy, Check, ExternalLink, Settings } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import type { Article } from '../types';

interface Status {
  step: string;
  label: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  articles?: Article[];
  expandedTerms?: string[];
}

const BACKEND_URL = ((import.meta.env.VITE_BACKEND_URL as string | undefined) ?? '').trim().replace(/\/$/, '');

function ArticleCard({ article }: { article: Article }) {
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
    <div className="bg-surface0 border border-surface2 rounded-xl p-3 space-y-1 text-xs hover:bg-surface1 transition-colors">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-mauve font-semibold">{article.artikl}</span>
          <button onClick={copyArtkl} title="Kopírovat artikl"
            className="text-overlay1 hover:text-mauve transition-colors">
            {copied ? <Check size={11} /> : <Copy size={11} />}
          </button>
        </div>
        <span className="text-overlay1 shrink-0">{article.vyrobce}</span>
      </div>
      <div className="text-text font-medium leading-snug">{article.nazev}</div>
      {article.typoveOznaceni && (
        <div className="flex items-center gap-1.5">
          <span className="text-subtext0">{article.typoveOznaceni}</span>
          <button onClick={googleSearch} title="Hledat na Google"
            className="text-overlay1 hover:text-mauve transition-colors shrink-0">
            <ExternalLink size={11} />
          </button>
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: Status }) {
  return (
    <div className="flex justify-start">
      <div className="bg-surface0 rounded-2xl rounded-bl-sm px-3 py-2 flex items-center gap-2 text-xs text-subtext1 max-w-[88%]">
        <Loader2 size={12} className="animate-spin text-mauve shrink-0" />
        <span>{status.label}</span>
      </div>
    </div>
  );
}

const MD_COMPONENTS: Components = {
  p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-mauve">{children}</strong>,
  ul: ({ children }) => <ul className="list-disc list-inside space-y-0.5 mt-1">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal list-inside space-y-0.5 mt-1">{children}</ol>,
  li: ({ children }) => <li className="text-sm">{children}</li>,
  code: ({ children }) => <code className="bg-surface1 rounded px-1 font-mono text-xs">{children}</code>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-mauve underline hover:text-pink">{children}</a>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto my-1">
      <table className="text-xs border-collapse w-full">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-surface1">{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => <tr className="border-b border-surface2">{children}</tr>,
  th: ({ children }) => <th className="px-2 py-1 text-left font-semibold text-mauve">{children}</th>,
  td: ({ children }) => <td className="px-2 py-1">{children}</td>,
};

const MIN_W = 300;
const MAX_W = 900;
const MIN_H = 300;
const MAX_H = 850;
const DEFAULT_W = 384;
const DEFAULT_H = 544;

export function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [panelW, setPanelW] = useState(DEFAULT_W);
  const [panelH, setPanelH] = useState(DEFAULT_H);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resizeRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, status]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    resizeRef.current = { x: e.clientX, y: e.clientY, w: panelW, h: panelH };

    const onMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return;
      const dx = resizeRef.current.x - ev.clientX;
      const dy = resizeRef.current.y - ev.clientY;
      setPanelW(Math.min(MAX_W, Math.max(MIN_W, resizeRef.current.w + dx)));
      setPanelH(Math.min(MAX_H, Math.max(MIN_H, resizeRef.current.h + dy)));
    };

    const onUp = () => {
      resizeRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  async function sendMessage() {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: Message = { role: 'user', content: text };
    setInput('');
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);
    setStatus(null);

    const history = [...messages, userMsg]
      .slice(-8)
      .map(m => ({ role: m.role, content: m.content }));

    try {
      const response = await fetch(`${BACKEND_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history, webSearchEnabled }),
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
                setStatus(data as Status);
              } else if (eventType === 'result') {
                setMessages(prev => [...prev, {
                  role: 'assistant',
                  content: data.answer,
                  articles: data.articles,
                  expandedTerms: data.expandedTerms,
                }]);
                setStatus(null);
              } else if (eventType === 'error') {
                setMessages(prev => [...prev, {
                  role: 'assistant',
                  content: `Chyba: ${data.error}`,
                }]);
                setStatus(null);
              }
            } catch {
              // malformed JSON line, skip
            }
            eventType = '';
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Neznámá chyba';
      setMessages(prev => [...prev, { role: 'assistant', content: `Chyba: ${msg}` }]);
      setStatus(null);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      {/* Floating toggle button */}
      <button
        onClick={() => setIsOpen(o => !o)}
        className={`fixed bottom-6 right-6 z-[60] rounded-full p-4 transition-all duration-200
          ${isOpen
            ? 'bg-surface2 hover:bg-overlay0 text-text shadow-lg'
            : 'bg-mauve hover:bg-pink text-crust shadow-[0_0_20px_4px_rgba(203,166,247,0.5)] hover:shadow-[0_0_28px_6px_rgba(245,194,231,0.6)] hover:scale-105'
          }`}
        aria-label={isOpen ? 'Zavřít Karla' : 'Otevřít Karel Bot'}
        title={isOpen ? 'Zavřít Karla' : 'Karel Bot — AI asistent artiklů'}
      >
        {isOpen ? <X size={22} /> : <MessageCircle size={22} />}
      </button>

      {/* Chat panel */}
      {isOpen && (
        <div
          className="fixed bottom-24 right-6 z-[60] bg-base border border-surface1 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          style={{ width: panelW, height: panelH }}
        >
          {/* Resize handle — top-left corner */}
          <div
            onMouseDown={startResize}
            className="absolute top-0 left-0 w-4 h-4 cursor-nw-resize z-10 rounded-tl-2xl"
            title="Přetáhni pro změnu velikosti"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" className="absolute top-1 left-1 text-overlay0 opacity-50">
              <line x1="2" y1="10" x2="10" y2="2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="6" y1="10" x2="10" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>

          {/* Header */}
          <div className="bg-mantle border-b border-surface1 px-4 py-3 flex items-center gap-2 shrink-0">
            <MessageCircle size={16} className="text-mauve" />
            <span className="font-semibold text-sm text-text">Karel Bot</span>
            <span className="text-overlay0 text-xs ml-1">AI asistent vyhledávání artiklů</span>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
            {messages.length === 0 && (
              <div className="mt-6 space-y-4">
                <div className="space-y-2">
                  <p className="text-subtext0 text-xs uppercase tracking-wide font-medium px-1">Hledání artiklů</p>
                  {['záslepka M20', 'ABB pojistka 16A', 'kabelová průchodka IP68'].map(ex => (
                    <button
                      key={ex}
                      onClick={() => { setInput(ex); inputRef.current?.focus(); }}
                      className="block w-full text-left px-3 py-2 rounded-xl bg-surface0 hover:bg-surface1 text-subtext1 text-sm transition-colors"
                    >
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
                  ].map(ex => (
                    <button
                      key={ex}
                      onClick={() => { setInput(ex); inputRef.current?.focus(); }}
                      className="block w-full text-left px-3 py-2 rounded-xl bg-surface0 hover:bg-surface1 text-subtext1 text-sm transition-colors"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className="max-w-[88%] space-y-2">
                  <div className={`rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-mauve text-crust rounded-br-sm'
                      : 'bg-surface0 text-text rounded-bl-sm'
                  }`}>
                    {msg.role === 'user' ? msg.content : (
                      <ReactMarkdown components={MD_COMPONENTS}>
                        {msg.content}
                      </ReactMarkdown>
                    )}
                  </div>

                  {msg.articles && msg.articles.length > 0 && (
                    <div className="space-y-1.5">
                      {msg.articles.map(a => (
                        <ArticleCard key={a.artikl} article={a} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {status && <StatusPill status={status} />}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-surface1 bg-mantle p-3 flex gap-2 shrink-0 relative">
            {/* Settings popover */}
            {settingsOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-1 mx-3 bg-mantle border border-surface1 rounded-xl shadow-lg p-3 z-10">
                <p className="text-xs text-subtext0 font-medium mb-2">Nastavení</p>
                <label className="flex items-center justify-between gap-3 cursor-pointer">
                  <span className="text-sm text-text">Webové vyhledávání</span>
                  <button
                    role="switch"
                    aria-checked={webSearchEnabled}
                    onClick={() => setWebSearchEnabled(v => !v)}
                    className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${
                      webSearchEnabled ? 'bg-mauve' : 'bg-surface2'
                    }`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-crust rounded-full shadow transition-transform ${
                      webSearchEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`} />
                  </button>
                </label>
              </div>
            )}
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder="Hledej artikl nebo se zeptej..."
              className="flex-1 text-sm bg-surface0 border border-surface1 rounded-xl px-3 py-2
                text-text placeholder:text-overlay0
                focus:outline-none focus:ring-2 focus:ring-mauve focus:border-transparent"
              disabled={isLoading}
            />
            <button
              onClick={() => setSettingsOpen(v => !v)}
              title="Nastavení"
              className={`rounded-xl px-2 py-2 transition-colors ${
                settingsOpen || webSearchEnabled
                  ? 'text-mauve bg-surface1 hover:bg-surface2'
                  : 'text-overlay0 hover:text-subtext1 hover:bg-surface0'
              }`}
              aria-label="Nastavení"
            >
              <Settings size={15} />
            </button>
            <button
              onClick={sendMessage}
              disabled={isLoading || !input.trim()}
              className="bg-mauve hover:bg-pink disabled:opacity-40 text-crust rounded-xl px-3 py-2 transition-colors"
              aria-label="Odeslat"
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
