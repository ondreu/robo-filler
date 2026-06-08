import { useState, useLayoutEffect, useMemo, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, ArrowLeft, X, Bot, ListOrdered, Sparkles, ClipboardList } from 'lucide-react';

const LS_KEY = 'ai-onboarding-v1';
const CARD_W = 340;
const MANTLE_HEX = '#181825';

interface StepDef {
  targetId: string | null;
  iconClass: string;
  icon: ReactNode;
  title: string;
  body: string;
  badge?: string;
  badgeClass?: string;
  ringHex: string;
  nextClass: string;
}

const STEPS: StepDef[] = [
  {
    targetId: null,
    iconClass: 'text-mauve',
    icon: <Sparkles size={20} />,
    title: 'Vítej v AI módu',
    body: 'Tato část aplikace kombinuje AI s databází artiklů. Jsou tu tři různé nástroje — pojďme si je krátce projít.',
    ringHex: '#cba6f7',
    nextClass: 'bg-mauve text-crust hover:bg-mauve/90',
  },
  {
    targetId: 'onb-chat',
    iconClass: 'text-mauve',
    icon: <Bot size={20} />,
    title: 'Běžný — Karel Bot',
    body: 'Poptávej přirozenou češtinou — „jistič 16A typ C" nebo „průchodka M25 nerez". AI prohledá databázi a odpoví s nejrelevantnějšími kandidáty.',
    ringHex: '#cba6f7',
    nextClass: 'bg-mauve text-crust hover:bg-mauve/90',
  },
  {
    targetId: 'onb-guided',
    iconClass: 'text-teal',
    icon: <ListOrdered size={20} />,
    title: 'Řízený mód',
    body: 'Průvodce krok za krokem pro 17 kategorií (jistič, stykač, svorka…). Odpovídáš na otázky o výrobci, proudu a pólech — AI vygeneruje desítky typových označení a najde shody.',
    badge: 'BETA',
    badgeClass: 'bg-teal/20 text-teal',
    ringHex: '#94e2d5',
    nextClass: 'bg-teal text-crust hover:bg-teal/90',
  },
  {
    targetId: 'onb-bom',
    iconClass: 'text-yellow',
    icon: <ClipboardList size={20} />,
    title: 'AI stavba kusovníku',
    body: 'Vlož tabulku typových označení z projektu — AI každé vyhledá v databázi a sestaví kusovník (ZBOM) i seznam artiklů k založení.',
    badge: 'BETA',
    badgeClass: 'bg-yellow/20 text-yellow',
    ringHex: '#f9e2af',
    nextClass: 'bg-yellow text-crust hover:bg-yellow/90',
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
          {s.badge && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${s.badgeClass ?? ''}`}>
              {s.badge}
            </span>
          )}
        </div>
        <button
          onClick={onSkip}
          className="text-overlay0 hover:text-subtext1 transition-colors shrink-0 mt-0.5"
          aria-label="Zavřít průvodce"
        >
          <X size={15} />
        </button>
      </div>

      <p className="px-5 pt-3 pb-4 text-sm text-subtext1 leading-relaxed">{s.body}</p>

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
            {isLast ? 'Dokončit' : 'Další'}
            {!isLast && <ArrowRight size={13} />}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AiOnboarding() {
  const [done, setDone] = useState(() => localStorage.getItem(LS_KEY) === '1');
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
    const flip = below + 260 > window.innerHeight;
    const top = flip ? Math.max(12, targetRect.top - 260 - gap) : below;
    const arrowLeft = Math.max(12, Math.min(
      targetRect.left + targetRect.width / 2 - left - 8,
      w - 28,
    ));
    return { top, left, w, flip, arrowLeft };
  }, [targetRect]);

  const finish = () => {
    localStorage.setItem(LS_KEY, '1');
    setDone(true);
  };

  const next = () => {
    if (stepIdx < STEPS.length - 1) setStepIdx(i => i + 1);
    else finish();
  };

  const prev = () => setStepIdx(i => Math.max(0, i - 1));

  if (done) return null;

  return createPortal(
    <>
      {/* Backdrop — click to skip */}
      <div
        className="fixed inset-0 bg-crust/75 backdrop-blur-[2px]"
        style={{ zIndex: 40 }}
        onClick={finish}
      />

      {/* Intro step: centered card */}
      {!s.targetId && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{ zIndex: 50 }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ width: Math.min(380, window.innerWidth - 32) }}>
            <StepCard s={s} stepIdx={stepIdx} onNext={next} onPrev={prev} onSkip={finish} />
          </div>
        </div>
      )}

      {/* Spotlight steps */}
      {s.targetId && targetRect && (
        <>
          {/* Glow ring around highlighted element */}
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

          {/* Tooltip card */}
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
              {/* Arrow caret pointing at the button */}
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
