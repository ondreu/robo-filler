import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Loader2 } from 'lucide-react';
import type { Article } from '../types';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  articles?: Article[];
}

interface ChatResponse {
  answer: string;
  articles: Article[];
}

const BACKEND_URL = ((import.meta.env.VITE_BACKEND_URL as string | undefined) ?? '').trim().replace(/\/$/, '');

export function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || isLoading) return;

    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setIsLoading(true);

    try {
      const response = await fetch(`${BACKEND_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? 'Server error');
      }

      const data: ChatResponse = await response.json();
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.answer,
        articles: data.articles,
      }]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Neznámá chyba';
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Chyba: ${msg}`,
      }]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      {/* Floating toggle button */}
      <button
        onClick={() => setIsOpen(o => !o)}
        className={`fixed bottom-6 right-6 z-50 rounded-full p-4 shadow-lg transition-all
          ${isOpen
            ? 'bg-surface2 hover:bg-overlay0 text-text'
            : 'bg-mauve hover:bg-pink text-crust'
          }`}
        aria-label={isOpen ? 'Zavřít asistenta' : 'Otevřít asistenta'}
        title={isOpen ? 'Zavřít asistenta' : 'Hledat pomocí AI asistenta'}
      >
        {isOpen ? <X size={22} /> : <MessageCircle size={22} />}
      </button>

      {/* Chat panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-96 h-[34rem] bg-base border border-surface1 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-mantle border-b border-surface1 px-4 py-3 flex items-center gap-2">
            <MessageCircle size={16} className="text-mauve" />
            <span className="font-semibold text-sm text-text">AI Asistent artiklů</span>
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
                <div className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-mauve text-crust rounded-br-sm'
                    : 'bg-surface0 text-text rounded-bl-sm'
                }`}>
                  {msg.content}
                  {msg.articles && msg.articles.length > 0 && (
                    <div className="mt-2 space-y-1 border-t border-surface1 pt-2">
                      {msg.articles.slice(0, 5).map(a => (
                        <div key={a.artikl} className="text-xs text-subtext1 bg-surface1 rounded-lg px-2 py-1">
                          <span className="font-mono text-mauve">{a.artikl}</span>
                          {' · '}
                          <span>{a.nazev}</span>
                          {' · '}
                          <span className="text-overlay1">{a.vyrobce}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-surface0 rounded-2xl rounded-bl-sm px-4 py-3">
                  <Loader2 size={14} className="animate-spin text-mauve" />
                </div>
              </div>
            )}

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
              placeholder="Hledej artikl..."
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
