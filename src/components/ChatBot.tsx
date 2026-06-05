import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Loader2, Copy, Check, ExternalLink } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
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

export function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, status]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

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
        body: JSON.stringify({ message: text, history }),
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
        className={`fixed bottom-6 right-6 z-50 rounded-full p-4 transition-all duration-200
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
        <div className="fixed bottom-24 right-6 z-50 w-96 h-[34rem] bg-base border border-surface1 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-mantle border-b border-surface1 px-4 py-3 flex items-center gap-2">
            <MessageCircle size={16} className="text-mauve" />
            <span className="font-semibold text-sm text-text">Karel Bot</span>
            <span className="text-overlay0 text-xs ml-1">AI asistent artiklů</span>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-center mt-6 space-y-3">
                <p className="text-subtext0 text-sm">Zeptej se na artikl přirozenou češtinou:</p>
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
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[88%] space-y-2`}>
                  <div className={`rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-mauve text-crust rounded-br-sm'
                      : 'bg-surface0 text-text rounded-bl-sm'
                  }`}>
                    {msg.role === 'user' ? msg.content : (
                      <ReactMarkdown
                        components={{
                          p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
                          strong: ({ children }) => <strong className="font-semibold text-mauve">{children}</strong>,
                          ul: ({ children }) => <ul className="list-disc list-inside space-y-0.5 mt-1">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal list-inside space-y-0.5 mt-1">{children}</ol>,
                          li: ({ children }) => <li className="text-sm">{children}</li>,
                          code: ({ children }) => <code className="bg-surface1 rounded px-1 font-mono text-xs">{children}</code>,
                        }}
                      >
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
          <div className="border-t border-surface1 bg-mantle p-3 flex gap-2">
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
