// Sdílený datový sklad pro admin správu databází (wires / cables / kanban).
// Backend je zdroj pravdy: čte/zapisuje public/<name>.json a public/<name>.schema.json.
// Po zápisu volá registrované reload callbacky (vyhledávací indexy Karel Bota).

import { readFileSync, writeFileSync, existsSync, renameSync, readdirSync, unlinkSync, mkdirSync, appendFileSync, statSync } from 'fs';
import { join } from 'path';

export const DATA_DIR = process.env.DATA_DIR ?? join(import.meta.dirname, '../../public');

// Registr databází — klíč → soubor s daty
export const DATABASES = {
  wires:  { file: 'wires.json',  label: 'Vodiče (wires.json)',  idKey: 'artiklStroj' },
  cables: { file: 'cables.json', label: 'Kabely (cables.json)', idKey: 'artikl' },
  kanban: { file: 'kanban.json', label: 'Sypký materiál (kanban.json)', idKey: 'artikl' },
};

export function isValidDb(name) {
  return Object.prototype.hasOwnProperty.call(DATABASES, name);
}

function dataPath(name) {
  return join(DATA_DIR, DATABASES[name].file);
}

function schemaPath(name) {
  return join(DATA_DIR, DATABASES[name].file.replace(/\.json$/, '.schema.json'));
}

// ─── Čtení dat ──────────────────────────────────────────────────────────────

export function readRows(name) {
  try {
    const content = readFileSync(dataPath(name), 'utf-8');
    const data = JSON.parse(content);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// ─── Schéma ───────────────────────────────────────────────────────────────────
// Sloupec: { key, label, type: 'text'|'number'|'boolean', filterable: boolean }

const BOOL_VALUES = new Set(['ANO', 'NE', 'ano', 'ne', true, false]);

function inferType(values) {
  const nonNull = values.filter(v => v !== null && v !== undefined && v !== '');
  if (nonNull.length === 0) return 'text';
  if (nonNull.every(v => typeof v === 'boolean' || BOOL_VALUES.has(v))) return 'boolean';
  if (nonNull.every(v => typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v.replace(',', '.')))))) {
    return 'number';
  }
  return 'text';
}

export function inferSchema(rows) {
  // Zachová pořadí klíčů dle prvního výskytu
  const keys = [];
  const seen = new Set();
  for (const row of rows) {
    if (row && typeof row === 'object') {
      for (const k of Object.keys(row)) {
        // klíče s prefixem `_` jsou interní (např. _poznamka admina) — nejsou sloupce
        if (k.startsWith('_')) continue;
        if (!seen.has(k)) { seen.add(k); keys.push(k); }
      }
    }
  }
  const columns = keys.map(key => ({
    key,
    label: key,
    type: inferType(rows.map(r => (r ? r[key] : undefined))),
    filterable: false,
  }));
  return { columns };
}

export function readSchema(name) {
  if (existsSync(schemaPath(name))) {
    try {
      const parsed = JSON.parse(readFileSync(schemaPath(name), 'utf-8'));
      if (parsed && Array.isArray(parsed.columns)) {
        return reconcileSchema(parsed, readRows(name));
      }
    } catch {
      // spadne na inferenci
    }
  }
  return inferSchema(readRows(name));
}

// Sloučí uložené schéma s aktuálními daty — doplní nové klíče, zachová nastavení.
function reconcileSchema(schema, rows) {
  const cols = schema.columns.map(c => ({
    key: c.key,
    label: c.label ?? c.key,
    type: c.type ?? 'text',
    filterable: !!c.filterable,
  }));
  const known = new Set(cols.map(c => c.key));
  const inferred = inferSchema(rows);
  for (const c of inferred.columns) {
    if (!known.has(c.key)) cols.push(c);
  }
  return { columns: cols };
}

// ─── Zápis (atomicky) ──────────────────────────────────────────────────────────

function atomicWrite(path, content) {
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, content, 'utf-8');
  renameSync(tmp, path);
}

export function writeRows(name, rows) {
  if (!Array.isArray(rows)) throw new Error('rows musí být pole');
  atomicWrite(dataPath(name), JSON.stringify(rows, null, 0));
  notifyReload(name);
}

export function writeSchema(name, schema) {
  if (!schema || !Array.isArray(schema.columns)) throw new Error('schema.columns musí být pole');
  const clean = {
    columns: schema.columns.map(c => ({
      key: String(c.key),
      label: c.label != null ? String(c.label) : String(c.key),
      type: ['text', 'number', 'boolean'].includes(c.type) ? c.type : 'text',
      filterable: !!c.filterable,
    })),
  };
  atomicWrite(schemaPath(name), JSON.stringify(clean, null, 2));
}

export function getDb(name) {
  return { rows: readRows(name), schema: readSchema(name) };
}

// ─── Snapshoty (rollback) ──────────────────────────────────────────────────────
// Ukládají se do DATA_DIR/.snapshots/<name>/<ISO>.json jako { ts, rows, schema }.
// Nejsou veřejné ani v GitHub záloze. Retence: GFS (denně 5 dní, týdně 3 týdny,
// měsíčně 1 měsíc).

const SNAP_ROOT = join(DATA_DIR, '.snapshots');

function snapDir(name) { return join(SNAP_ROOT, name); }

function tsToId(d = new Date()) {
  return d.toISOString().replace(/[:.]/g, '-'); // bezpečný název souboru
}

// Vytvoří snapshot aktuálního stavu DB na disku.
export function snapshotDb(name) {
  const dir = snapDir(name);
  mkdirSync(dir, { recursive: true });
  const { rows, schema } = getDb(name);
  const id = tsToId();
  const file = join(dir, `${id}.json`);
  writeFileSync(file, JSON.stringify({ ts: new Date().toISOString(), rows, schema }), 'utf-8');
  pruneDir(dir);
  return id;
}

export function listSnapshots(name) {
  const dir = snapDir(name);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      const p = join(dir, f);
      const st = statSync(p);
      const id = f.replace(/\.json$/, '');
      let rows = null;
      try { rows = JSON.parse(readFileSync(p, 'utf-8')).rows?.length ?? null; } catch { /* ignore */ }
      return { id, ts: st.mtime.toISOString(), bytes: st.size, rows };
    })
    .sort((a, b) => (a.ts < b.ts ? 1 : -1)); // nejnovější první
}

export function readSnapshot(name, id) {
  const p = join(snapDir(name), `${id}.json`);
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, 'utf-8')); } catch { return null; }
}

// GFS prune: vše posledních 5 dní, týdně 3 týdny, měsíčně 1 měsíc; starší smaže.
// Vždy ponechá nejnovější. Funguje nad libovolným adresářem časově pojmenovaných souborů.
function pruneDir(dir) {
  if (!existsSync(dir)) return;
  const files = readdirSync(dir);
  const items = files.map(f => ({ f, d: new Date(statSync(join(dir, f)).mtime) }))
    .sort((a, b) => b.d - a.d);
  if (items.length === 0) return;

  const now = Date.now();
  const DAY = 86400000;
  const keep = new Set();
  const seen = { week: new Set(), month: new Set() };
  const isoWeek = d => {
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = (t.getUTCDay() + 6) % 7;
    t.setUTCDate(t.getUTCDate() - day + 3);
    const first = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
    return `${t.getUTCFullYear()}-${Math.round(((t - first) / DAY - 3 + ((first.getUTCDay() + 6) % 7)) / 7) + 1}`;
  };

  keep.add(items[0].f);
  for (const { f, d } of items) {
    const ageDays = (now - d.getTime()) / DAY;
    const weekKey = isoWeek(d);
    const monthKey = d.toISOString().slice(0, 7);
    if (ageDays <= 5) keep.add(f);
    else if (ageDays <= 26) { if (!seen.week.has(weekKey)) { seen.week.add(weekKey); keep.add(f); } }
    else if (ageDays <= 60) { if (!seen.month.has(monthKey)) { seen.month.add(monthKey); keep.add(f); } }
  }
  for (const { f } of items) {
    if (!keep.has(f)) { try { unlinkSync(join(dir, f)); } catch { /* ignore */ } }
  }
}

// ─── Snapshoty master CSV (hlavní DB) ──────────────────────────────────────────
const MASTER_SNAP = which => join(SNAP_ROOT, `master-${which}`);

export function snapshotMaster(which, srcPath) {
  if (!existsSync(srcPath)) return null;
  const dir = MASTER_SNAP(which);
  mkdirSync(dir, { recursive: true });
  const id = tsToId();
  writeFileSync(join(dir, `${id}.csv`), readFileSync(srcPath));
  pruneDir(dir);
  return id;
}

export function listMasterSnapshots(which) {
  const dir = MASTER_SNAP(which);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter(f => f.endsWith('.csv')).map(f => {
    const st = statSync(join(dir, f));
    return { id: f.replace(/\.csv$/, ''), ts: st.mtime.toISOString(), bytes: st.size };
  }).sort((a, b) => (a.ts < b.ts ? 1 : -1));
}

export function readMasterSnapshotPath(which, id) {
  const p = join(MASTER_SNAP(which), `${id}.csv`);
  return existsSync(p) ? p : null;
}

// ─── Diff řádků (git-style) pro audit ───────────────────────────────────────────
// Vrací { added, removed, modified } počty + ukázku změn (cap).
export function diffRows(oldRows, newRows, idKey) {
  const key = r => (r && r[idKey] != null ? String(r[idKey]) : null);
  const oldMap = new Map(); for (const r of oldRows) { const k = key(r); if (k != null) oldMap.set(k, r); }
  const newMap = new Map(); for (const r of newRows) { const k = key(r); if (k != null) newMap.set(k, r); }
  const added = [], removed = [], modified = [];
  const CAP = 200;
  for (const [k, r] of newMap) if (!oldMap.has(k)) added.push(k);
  for (const [k] of oldMap) if (!newMap.has(k)) removed.push(k);
  for (const [k, nr] of newMap) {
    const or = oldMap.get(k);
    if (!or) continue;
    const changes = [];
    const keys = new Set([...Object.keys(or), ...Object.keys(nr)]);
    for (const f of keys) {
      const a = or[f], b = nr[f];
      if ((a ?? '') !== (b ?? '') && String(a ?? '') !== String(b ?? '')) {
        changes.push({ key: f, from: a ?? null, to: b ?? null });
      }
    }
    if (changes.length) modified.push({ id: k, changes: changes.slice(0, 20) });
    if (modified.length >= CAP) break;
  }
  return {
    added: added.length, removed: removed.length, modified: modified.length,
    addedIds: added.slice(0, CAP), removedIds: removed.slice(0, CAP), changes: modified.slice(0, CAP),
  };
}

// ─── Audit log admin akcí ───────────────────────────────────────────────────────

const AUDIT_FILE = join(DATA_DIR, '.audit.jsonl');

export function appendAudit(entry) {
  try {
    appendFileSync(AUDIT_FILE, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n', 'utf-8');
  } catch (err) {
    console.error('[audit] zápis selhal:', err.message);
  }
}

export function readAudit(limit = 200) {
  if (!existsSync(AUDIT_FILE)) return [];
  const lines = readFileSync(AUDIT_FILE, 'utf-8').split('\n').filter(Boolean);
  const out = [];
  for (let i = lines.length - 1; i >= 0 && out.length < limit; i--) {
    try { out.push(JSON.parse(lines[i])); } catch { /* ignore */ }
  }
  return out;
}

// ─── Reload registry ───────────────────────────────────────────────────────────
// Vyhledávací moduly (wireSearch, cableSearch) sem registrují své reloadery,
// aby se in-memory indexy obnovily po editaci dat.

const reloaders = new Map();

export function registerReload(name, fn) {
  reloaders.set(name, fn);
}

function notifyReload(name) {
  const fn = reloaders.get(name);
  if (typeof fn === 'function') {
    try { fn(); } catch (err) { console.error(`[dataStore] reload ${name} selhal:`, err); }
  }
}
