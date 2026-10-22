import { Search } from 'lucide-react';

/** Značka aplikace Schoogle — znak + slovní značka, pro tmavou horní lištu. */
export function BrandMark() {
  return (
    <div className="flex items-center gap-2.5 shrink-0 select-none">
      <span className="flex items-center justify-center w-7 h-7 rounded-md bg-[#d32029] text-white">
        <Search size={16} strokeWidth={2.5} />
      </span>
      <span className="leading-tight text-left">
        <span className="block text-[15px] font-semibold tracking-tight text-nav-text">Schoogle</span>
        <span className="hidden sm:block text-[10px] uppercase tracking-[0.12em] text-nav-muted">Vyhledávač artiklů</span>
      </span>
    </div>
  );
}
