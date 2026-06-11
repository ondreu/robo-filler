// Dynamické filtry řízené schématem databáze. Pro každý sloupec označený jako
// „filtrovatelný" vykreslí chip filtr s distinktními hodnotami. Použito ve
// vyhledávacích UI (Vodiče/Kabely, Sypký materiál).
import type { DbSchema, DbRow, DynamicFilterState } from '../utils/dbSchema';
import { distinctFilterValues } from '../utils/dbSchema';

const ACCENTS: Record<string, { active: string }> = {
  peach: { active: 'bg-peach/20 text-peach border-peach/40' },
  teal: { active: 'bg-teal/20 text-teal border-teal/40' },
  mauve: { active: 'bg-mauve/20 text-mauve border-mauve/40' },
};

export function DynamicFilters({
  schema, items, value, onChange, accent = 'mauve',
}: {
  schema: DbSchema | null;
  items: DbRow[];
  value: DynamicFilterState;
  onChange: (next: DynamicFilterState) => void;
  accent?: 'peach' | 'teal' | 'mauve';
}) {
  if (!schema) return null;
  const cols = schema.columns.filter(c => c.filterable);
  if (cols.length === 0) return null;

  const activeCls = ACCENTS[accent]?.active ?? ACCENTS.mauve.active;

  const toggle = (key: string, v: string) => {
    const cur = value[key] ?? [];
    const next = cur.includes(v) ? cur.filter(x => x !== v) : [...cur, v];
    onChange({ ...value, [key]: next });
  };

  return (
    <>
      {cols.map(col => {
        const values = distinctFilterValues(items, col);
        if (values.length === 0) return null;
        const selected = value[col.key] ?? [];
        return (
          <div key={col.key} className="space-y-1.5">
            <p className="text-[11px] text-overlay0 font-semibold uppercase tracking-wide">{col.label}</p>
            <div className="flex flex-wrap gap-1.5">
              {values.slice(0, 60).map(v => {
                const active = selected.includes(v);
                return (
                  <button
                    key={v}
                    onClick={() => toggle(col.key, v)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border ${
                      active ? activeCls : 'bg-surface0 text-subtext1 border-surface2 hover:bg-surface1 hover:text-text'
                    }`}
                  >
                    {v}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
}
