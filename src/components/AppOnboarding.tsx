import { useState, useLayoutEffect, useMemo, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, ArrowLeft, X, Search, Layers, Sparkles, Table2, Cable, Package } from 'lucide-react';

export const APP_ONBOARDING_KEY = 'app-onboarding-v1';
const CARD_W = 360;
const MANTLE_HEX = '#181825';

interface StepDef {
  targetId: string | null;
  iconClass: string;
  icon: ReactNode;
  title: string;
  body: string;
  ringHex: string;
  nextClass: string;
}

const STEPS: StepDef[] = [
  {
    targetId: null,
    iconClass: 'text-mauve',
    icon: <Sparkles size={20} />,
    title: 'Vítej v Robo Filleru!',
    body: 'Průmyslová databáze s AI vyhledáváním — přes 90 000 artiklů ze dvou závodů. Pojďme si rychle projít hlavní funkce.',
    ringHex: '#cba6f7',
    nextClass: 'bg-mauve text-crust hover:bg-mauve/90',
  },
  {
    targetId: 'onb-single',
    iconClass: 'text-mauve',
    icon: <Search size={20} />,
    title: 'Jednotlivé vyhledávání',
    body: 'Zadej typové označení, název nebo výrobce. Kombinovaný mód (výchozí) zkusí wildcard i fuzzy hledání a sloučí výsledky.',
    ringHex: '#cba6f7',
    nextClass: 'bg-mauve text-crust hover:bg-mauve/90',
  },
  {
    targetId: 'onb-bulk',
    iconClass: 'text-mauve',
    icon: <Layers size={20} />,
    title: 'Hromadné vyhledávání',
    body: 'Vložte seznam typových označení (každé na řádek — např. zkopíruj sloupec z Excelu). Výsledky lze exportovat do CSV nebo otevřít v Tabulkovém zpracování.',
    ringHex: '#cba6f7',
    nextClass: 'bg-mauve text-crust hover:bg-mauve/90',
  },
  {
    targetId: 'onb-wirecable',
    iconClass: 'text-teal',
    icon: <Cable size={20} />,
    title: '🔌 Vodiče & Kabely',
    body: 'Samostatná databáze vodičů a kabelů (přes 600 artiklů). Hledej podle průřezu, barvy nebo skupiny. Výrobci: LAPP, Helukabel, HUBER+SUHNER, Nexans.',
    ringHex: '#94e2d5',
    nextClass: 'bg-teal text-crust hover:bg-teal/90',
  },
  {
    targetId: 'onb-kanban',
    iconClass: 'text-peach',
    icon: <Package size={20} />,
    title: '📦 Sypký materiál',
    body: 'Kanban databáze sypkého materiálu — šrouby, matice, kabelbindy a další drobné položky (přes 500 artiklů). Filtry podle kategorie, provedení a barvy dle DIN.',
    ringHex: '#fab387',
    nextClass: 'bg-peach text-crust hover:bg-peach/90',
  },
  {
    targetId: null,
    iconClass: 'text-teal',
    icon: <Table2 size={20} />,
    title: 'Tabulkové zpracování (ZBOM)',
    body: 'Editor pro sestavení výstupního kusovníku ve formátu SAP ZBOM. Zadáš artikl, aplikace doplní popis z databáze. Více záložek, undo (Ctrl+Z), export do TXT a Excel.',
    ringHex: '#94e2d5',
    nextClass: 'bg-teal text-crust hover:bg-teal/90',
  },
];

function StepCard({
  s, stepIdx, onNext, onPrev, onSkip,
}: {
  s: StepDef; stepIdx: number; onNext: () => void; onPrev: () => void; onSkip: () => void;
}) {
  const isFirst = stepIdx === 0;
  const isLast = stepIdx === STEPS.length - 1;

  return (
    <div className="bg-mantle border border-surface1 rounded-2xl shadow-2xl overflow-hidden">
      <div className="flex items-start justify-between gap-2 px-5 pt-5">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`${s.iconClass} shrink-0`}>{s.icon}</span>
          <span className="text-text font-semibold text-sm leading-snug">{s.title}</span>
        </div>
        <button
          onClick={onSkip}
          className="text-overlay0 hover:text-subtext1 transition-colors shrink-0 mt-0.5"
          aria-label="Zavřít průvodce"
        >
          <X size={15} />
        </button>
      </div>

      <p className="px-5 pt-3 pb-4 text-sm text-subtext1 leading-relaxed whitespace-pre-line">{s.body}</p>

      <div className="flex items-center justify-between px-5 pb-4">
        <div className="flex gap-1.5 items-center">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`rounded-full transition-all duration-300 ${
                i === stepIdx ? 'w-4 h-2 bg-mauve' : 'w-2 h-2 bg-surface2'
              }`}
            />
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          {isFirst ? (
            <button
              onClick={onSkip}
              className="px-3 py-1.5 text-xs text-overlay1 hover:text-subtext1 transition-colors rounded-lg"
            >
              Přeskočit
            </button>
          ) : (
            <button
              onClick={onPrev}
              className="flex items-center gap-1 px-3 py-1.5 text-xs text-subtext1 hover:text-text transition-colors rounded-lg"
            >
              <ArrowLeft size={13} />
              Zpět
            </button>
          )}
          <button
            onClick={onNext}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${s.nextClass}`}
          >
            {isLast ? 'Hotovo' : 'Další'}
            {!isLast && <ArrowRight size={13} />}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AppOnboarding() {
  const [done, setDone] = useState(() => localStorage.getItem(APP_ONBOARDING_KEY) === '1');
  const [stepIdx, setStepIdx] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const s = STEPS[stepIdx];

  useLayoutEffect(() => {
    if (done || !s.targetId) { setTargetRect(null); return; }

    const el = document.getElementById(s.targetId) as HTMLElement | null;
    if (!el) { setTargetRect(null); return; }

    const prevPosition = el.style.position;
    const prevZIndex = el.style.zIndex;
    const prevPointerEvents = el.style.pointerEvents;

    el.style.position = 'relative';
    el.style.zIndex = '60';
    el.style.pointerEvents = 'none';
    setTargetRect(el.getBoundingClientRect());

    return () => {
      el.style.position = prevPosition;
      el.style.zIndex = prevZIndex;
      el.style.pointerEvents = prevPointerEvents;
    };
  }, [stepIdx, done, s.targetId]);

  const cardPos = useMemo(() => {
    if (!targetRect) return null;
    const gap = 14;
    const w = Math.min(CARD_W, window.innerWidth - 24);
    const idealLeft = targetRect.left + targetRect.width / 2 - w / 2;
    const left = Math.max(12, Math.min(idealLeft, window.innerWidth - w - 12));
    const below = targetRect.bottom + gap;
    const flip = below + 280 > window.innerHeight;
    const top = flip ? Math.max(12, targetRect.top - 280 - gap) : below;
    const arrowLeft = Math.max(12, Math.min(
      targetRect.left + targetRect.width / 2 - left - 8,
      w - 28,
    ));
    return { top, left, w, flip, arrowLeft };
  }, [targetRect]);

  const finish = () => {
    localStorage.setItem(APP_ONBOARDING_KEY, '1');
    setDone(true);
  };

  const next = () => {
    if (stepIdx < STEPS.length - 1) {
      setStepIdx(i => i + 1);
    } else {
      finish();
    }
  };

  const prev = () => setStepIdx(i => Math.max(0, i - 1));

  if (done) return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-crust/75 backdrop-blur-[2px]"
        style={{ zIndex: 40 }}
        onClick={finish}
      />

      {/* Centered card (no target) */}
      {!s.targetId && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{ zIndex: 50 }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ width: Math.min(CARD_W, window.innerWidth - 32) }}>
            <StepCard s={s} stepIdx={stepIdx} onNext={next} onPrev={prev} onSkip={finish} />
          </div>
        </div>
      )}

      {/* Spotlight steps */}
      {s.targetId && targetRect && (
        <>
          <div
            style={{
              position: 'fixed',
              top: targetRect.top - 6,
              left: targetRect.left - 6,
              width: targetRect.width + 12,
              height: targetRect.height + 12,
              borderRadius: 10,
              border: `2px solid ${s.ringHex}`,
              boxShadow: `0 0 0 4px ${s.ringHex}28, 0 0 20px ${s.ringHex}50`,
              zIndex: 59,
              pointerEvents: 'none',
            }}
          />
          {cardPos && (
            <div
              style={{
                position: 'fixed',
                top: cardPos.top,
                left: cardPos.left,
                width: cardPos.w,
                zIndex: 61,
              }}
              onClick={e => e.stopPropagation()}
            >
              {!cardPos.flip && (
                <div
                  style={{
                    position: 'absolute',
                    top: -8,
                    left: cardPos.arrowLeft,
                    width: 0,
                    height: 0,
                    borderLeft: '8px solid transparent',
                    borderRight: '8px solid transparent',
                    borderBottom: `8px solid ${MANTLE_HEX}`,
                  }}
                />
              )}
              {cardPos.flip && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: -8,
                    left: cardPos.arrowLeft,
                    width: 0,
                    height: 0,
                    borderLeft: '8px solid transparent',
                    borderRight: '8px solid transparent',
                    borderTop: `8px solid ${MANTLE_HEX}`,
                  }}
                />
              )}
              <StepCard s={s} stepIdx={stepIdx} onNext={next} onPrev={prev} onSkip={finish} />
            </div>
          )}
        </>
      )}
    </>,
    document.body,
  );
}
