// Sdílený datový sklad pro admin správu databází (wires / cables / kanban).
// Backend je zdroj pravdy: čte/zapisuje public/<name>.json a public/<name>.schema.json.
// Po zápisu volá registrované reload callbacky (vyhledávací indexy Karel Bota).

import { readFileSync, writeFileSync, existsSync, renameSync } from 'fs';
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
