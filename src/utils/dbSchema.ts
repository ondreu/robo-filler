// Typy a pomocné funkce pro schéma admin databází (wires / cables / kanban).

export type DbName = 'wires' | 'cables' | 'kanban';
export type ColumnType = 'text' | 'number' | 'boolean';

export interface DbColumn {
  key: string;
  label: string;
  type: ColumnType;
  filterable: boolean;
}

export interface DbSchema {
  columns: DbColumn[];
}

export type DbRow = Record<string, unknown>;

export interface DbInfo {
  name: DbName;
  label: string;
  idKey: string;
}

// ─── Inference (klientský fallback, když backend není dostupný) ────────────────

const BOOL_VALUES = new Set(['ANO', 'NE', 'ano', 'ne', 'true', 'false']);

function inferType(values: unknown[]): ColumnType {
  const nonNull = values.filter(v => v !== null && v !== undefined && v !== '');
  if (nonNull.length === 0) return 'text';
  if (nonNull.every(v => typeof v === 'boolean' || (typeof v === 'string' && BOOL_VALUES.has(v)))) return 'boolean';
  if (nonNull.every(v => typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v.replace(',', '.')))))) {
    return 'number';
  }
  return 'text';
}

export function inferSchema(rows: DbRow[]): DbSchema {
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (row && typeof row === 'object') {
      for (const k of Object.keys(row)) {
        if (!seen.has(k)) { seen.add(k); keys.push(k); }
      }
    }
  }
  return {
    columns: keys.map(key => ({
      key,
      label: key,
      type: inferType(rows.map(r => r?.[key])),
      filterable: false,
    })),
  };
}

// ─── Coerce (při editaci buňky) ────────────────────────────────────────────────

export function coerceCell(value: string, type: ColumnType): unknown {
  if (value === '') return null;
  if (type === 'number') {
    const n = Number(value.replace(',', '.'));
    return isNaN(n) ? value : n;
  }
  return value;
}

// ─── Filtry řízené schématem ────────────────────────────────────────────────────

// Převede hodnotu buňky na zobrazitelný/porovnatelný řetězec pro filtr.
export function cellToFilterString(v: unknown, type: ColumnType): string | null {
  if (v === null || v === undefined || v === '') return null;
  if (type === 'boolean') {
    if (v === true || v === 'ANO' || v === 'ano' || v === 'true') return 'Ano';
    if (v === false || v === 'NE' || v === 'ne' || v === 'false') return 'Ne';
  }
  return String(v);
}

// Distinktní hodnoty sloupce pro nabídku ve filtru.
export function distinctFilterValues(items: DbRow[], col: DbColumn): string[] {
  const set = new Set<string>();
  for (const it of items) {
    const s = cellToFilterString(it?.[col.key], col.type);
    if (s !== null) set.add(s);
  }
  const arr = [...set];
  if (col.type === 'number') {
    arr.sort((a, b) => Number(a.replace(',', '.')) - Number(b.replace(',', '.')));
  } else {
    arr.sort((a, b) => a.localeCompare(b, 'cs'));
  }
  return arr;
}

export type DynamicFilterState = Record<string, string[]>;

// Aplikuje dynamické filtry (AND mezi sloupci, OR uvnitř sloupce).
export function applyDynamicFilters<T extends DbRow>(
  items: T[],
  schema: DbSchema | null,
  state: DynamicFilterState,
): T[] {
  if (!schema) return items;
  const active = schema.columns.filter(c => c.filterable && (state[c.key]?.length ?? 0) > 0);
  if (active.length === 0) return items;
  return items.filter(it =>
    active.every(col => {
      const s = cellToFilterString(it?.[col.key], col.type);
      return s !== null && state[col.key].includes(s);
    }),
  );
}
