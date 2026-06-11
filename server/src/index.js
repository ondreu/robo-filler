import express from 'express';
import cors from 'cors';
import { handleChat } from './chat.js';
import { handleBomBuild, checkClarification, postCheckClarification } from './bomBuilder.js';
import { handleGuidedChat } from './guidedSearch.js';
import { COMPONENT_CATEGORIES } from './componentGuide.js';
import { logRecord } from './collector.js';
import { DATABASES, isValidDb, getDb, writeRows, writeSchema, readSchema, DATA_DIR,
  snapshotDb, listSnapshots, readSnapshot, appendAudit, readAudit } from './dataStore.js';
import { reloadMaster, getArticleCount, searchTerm } from './search.js';
import { readFileSync, writeFileSync, existsSync, statSync, renameSync } from 'fs';
import { join } from 'path';

const LOGS_DIR = join(import.meta.dirname, '..', 'logs');
const MASTER_FILES = { main: 'master-data.csv', effi: 'master-data-effi.csv' };

const app = express();
const PORT = process.env.PORT ?? 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? '*';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? '';

app.use(cors({ origin: CORS_ORIGIN }));
// JSON databáze mohou být velké (megabajty) — zvedneme limit pro admin zápisy.
app.use(express.json({ limit: '64mb' }));

// ─── Admin auth ─────────────────────────────────────────────────────────────
// Jednoduché sdílené heslo přes hlavičku x-admin-password (env ADMIN_PASSWORD).
function checkAdmin(req, res) {
  if (!ADMIN_PASSWORD) {
    res.status(503).json({ error: 'Admin není nakonfigurován (chybí ADMIN_PASSWORD na serveru).' });
    return false;
  }
  const pw = req.get('x-admin-password') ?? '';
  if (pw !== ADMIN_PASSWORD) {
    res.status(401).json({ error: 'Neplatné heslo.' });
    return false;
  }
  return true;
}

const APP_VERSION = process.env.APP_VERSION || 'V120626';

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/version', (_req, res) => {
  res.json({ version: APP_VERSION });
});

app.post('/api/chat', async (req, res) => {
  const { message, history = [], webSearchEnabled = true, synthModel } = req.body ?? {};

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'Chybí parametr message.' });
  }

  if (!process.env.MISTRAL_API_KEY) {
    return res.status(500).json({ error: 'MISTRAL_API_KEY není nastaven.' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  let chatResult = null;
  try {
    chatResult = await handleChat(
      message.trim(),
      history,
      (step, label, meta = {}) => send('status', { step, label, ...meta }),
      !!webSearchEnabled,
      synthModel,
      send,
    );
    if (chatResult !== null) send('result', chatResult);
  } catch (err) {
    console.error('[chat]', err);
    send('error', { error: 'Chyba při zpracování dotazu.' });
  } finally {
    logRecord({ type: 'chat', message: message.trim(), history, result: chatResult });
  }

  res.end();
});

app.post('/api/bom-check', async (req, res) => {
  const { rows = [], preferences = '' } = req.body ?? {};

  if (!process.env.MISTRAL_API_KEY) {
    return res.status(500).json({ error: 'MISTRAL_API_KEY není nastaven.' });
  }

  try {
    const result = await checkClarification(rows, preferences);
    res.json(result);
  } catch (err) {
    console.error('[bom-check]', err);
    res.json({ needsClarification: false, questions: [] });
  }
});

app.post('/api/bom-post-check', async (req, res) => {
  const { notFoundRows = [], preferences = '' } = req.body ?? {};

  if (!process.env.MISTRAL_API_KEY) {
    return res.status(500).json({ error: 'MISTRAL_API_KEY není nastaven.' });
  }

  try {
    const result = await postCheckClarification(notFoundRows, preferences);
    res.json(result);
  } catch (err) {
    console.error('[bom-post-check]', err);
    res.json({ needsClarification: false, questions: [] });
  }
});

app.post('/api/bom-build', async (req, res) => {
  const { rows = [], preferences = '', produktovaHierarchie = '', artiklVrcholu = '', answers = [] } = req.body ?? {};

  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: 'Chybí vstupní data.' });
  }

  if (!process.env.MISTRAL_API_KEY) {
    return res.status(500).json({ error: 'MISTRAL_API_KEY není nastaven.' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  let bomResult = null;
  try {
    bomResult = await handleBomBuild(
      rows,
      preferences,
      (rowIndex, total, typoveOznaceni, status, mfrName) =>
        send('progress', { rowIndex, total, typoveOznaceni, status, mfrName }),
      answers,
    );
    send('result', { ...bomResult, produktovaHierarchie, artiklVrcholu });
  } catch (err) {
    console.error('[bom-build]', err);
    send('error', { error: 'Chyba při zpracování kusovníku.' });
  } finally {
    logRecord({ type: 'bom', rows, preferences, produktovaHierarchie, artiklVrcholu, answers, result: bomResult });
  }

  res.end();
});

app.get('/api/guided-categories', (_req, res) => {
  res.json(COMPONENT_CATEGORIES.map(c => ({ key: c.key, label: c.label })));
});

app.post('/api/guided-chat', async (req, res) => {
  const { message = '', phase = 'initial', category = null, categoryKey = null, answers = [] } = req.body ?? {};

  if (!process.env.MISTRAL_API_KEY) {
    return res.status(500).json({ error: 'MISTRAL_API_KEY není nastaven.' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const guidedEvents = [];
  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    guidedEvents.push({ event, data });
  };

  try {
    await handleGuidedChat(
      typeof message === 'string' ? message.trim() : '',
      phase,
      categoryKey ?? category,
      Array.isArray(answers) ? answers : [],
      send,
    );
  } catch (err) {
    console.error('[guided-chat]', err);
    send('error', { error: 'Chyba při zpracování řízeného vyhledávání.' });
  } finally {
    logRecord({ type: 'guided', message, phase, categoryKey: categoryKey ?? category, answers, events: guidedEvents });
  }

  res.end();
});

// ─── Admin databáze ───────────────────────────────────────────────────────────

// Seznam databází (veřejné)
app.get('/api/db', (_req, res) => {
  res.json(Object.entries(DATABASES).map(([name, def]) => ({ name, label: def.label, idKey: def.idKey })));
});

// Odstraní interní klíče (prefix `_`, např. admin poznámky) — ty se nesmí
// dostat do veřejného API ani do GitHub zálohy.
function stripInternal(rows) {
  return rows.map(r => {
    const out = {};
    for (const k of Object.keys(r)) if (!k.startsWith('_')) out[k] = r[k];
    return out;
  });
}

// Veřejné čtení dat + schématu — používá frontend vyhledávání pro živá data a
// dynamické filtry. Nevyžaduje heslo. Interní klíče (`_`) se odstraní.
app.get('/api/db/:name', (req, res) => {
  const { name } = req.params;
  if (!isValidDb(name)) return res.status(404).json({ error: 'Neznámá databáze.' });
  try {
    const { rows, schema } = getDb(name);
    res.json({ rows: stripInternal(rows), schema });
  } catch (err) {
    console.error('[db:get]', err);
    res.status(500).json({ error: 'Chyba při čtení databáze.' });
  }
});

// Admin čtení — vrací plná data včetně interních klíčů (admin poznámky).
app.get('/api/admin/db/:name', (req, res) => {
  if (!checkAdmin(req, res)) return;
  const { name } = req.params;
  if (!isValidDb(name)) return res.status(404).json({ error: 'Neznámá databáze.' });
  try {
    res.json(getDb(name));
  } catch (err) {
    console.error('[admin:db:get]', err);
    res.status(500).json({ error: 'Chyba při čtení databáze.' });
  }
});

// Schéma zvlášť (lehčí dotaz pro vyhledávací UI)
app.get('/api/db/:name/schema', (req, res) => {
  const { name } = req.params;
  if (!isValidDb(name)) return res.status(404).json({ error: 'Neznámá databáze.' });
  try {
    res.json(readSchema(name));
  } catch (err) {
    console.error('[db:schema]', err);
    res.status(500).json({ error: 'Chyba při čtení schématu.' });
  }
});

// Ověření admin hesla
app.post('/api/admin/login', (req, res) => {
  if (!ADMIN_PASSWORD) return res.status(503).json({ error: 'Admin není nakonfigurován.' });
  const pw = (req.body ?? {}).password ?? '';
  if (pw !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Neplatné heslo.' });
  res.json({ ok: true });
});

// Uložení dat a/nebo schématu (vyžaduje heslo)
app.put('/api/admin/db/:name', (req, res) => {
  if (!checkAdmin(req, res)) return;
  const { name } = req.params;
  if (!isValidDb(name)) return res.status(404).json({ error: 'Neznámá databáze.' });

  const { rows, schema } = req.body ?? {};
  try {
    // Snapshot stavu PŘED zápisem — umožňuje rollback na předchozí verzi
    snapshotDb(name);

    // Diff: kolik řádků přibylo / ubylo (dle idKey)
    let diff = null;
    if (rows !== undefined && Array.isArray(rows)) {
      const oldRows = getDb(name).rows;
      const idKey = DATABASES[name]?.idKey;
      if (idKey) {
        const oldIds = new Set(oldRows.map(r => String(r[idKey] ?? '')).filter(Boolean));
        const newIds = new Set(rows.map(r => String(r[idKey] ?? '')).filter(Boolean));
        const added = rows.filter(r => { const id = String(r[idKey] ?? ''); return id && !oldIds.has(id); }).length;
        const removed = oldRows.filter(r => { const id = String(r[idKey] ?? ''); return id && !newIds.has(id); }).length;
        diff = { added, removed };
      }
    }

    if (schema !== undefined) writeSchema(name, schema);
    if (rows !== undefined) {
      if (!Array.isArray(rows)) return res.status(400).json({ error: 'rows musí být pole.' });
      writeRows(name, rows);
    }
    const saved = getDb(name);
    appendAudit({ action: 'save', db: name, rows: saved.rows.length, ...(diff ? { diff } : {}) });
    res.json({ ok: true, count: saved.rows.length, schema: saved.schema });
  } catch (err) {
    console.error('[db:put]', err);
    res.status(500).json({ error: 'Chyba při ukládání databáze.' });
  }
});

// ─── Admin: snapshoty / rollback ─────────────────────────────────────────────
app.get('/api/admin/snapshots/:name', (req, res) => {
  if (!checkAdmin(req, res)) return;
  const { name } = req.params;
  if (!isValidDb(name)) return res.status(404).json({ error: 'Neznámá databáze.' });
  res.json({ snapshots: listSnapshots(name) });
});

// Ruční snapshot „Zálohovat teď"
app.post('/api/admin/snapshots/:name', (req, res) => {
  if (!checkAdmin(req, res)) return;
  const { name } = req.params;
  if (!isValidDb(name)) return res.status(404).json({ error: 'Neznámá databáze.' });
  try {
    const id = snapshotDb(name);
    appendAudit({ action: 'snapshot', db: name });
    res.json({ ok: true, id, snapshots: listSnapshots(name) });
  } catch (err) {
    console.error('[snapshot]', err);
    res.status(500).json({ error: 'Chyba při vytváření snapshotu.' });
  }
});

// Obnovení z konkrétního snapshotu
app.post('/api/admin/snapshots/:name/restore/:id', (req, res) => {
  if (!checkAdmin(req, res)) return;
  const { name, id } = req.params;
  if (!isValidDb(name)) return res.status(404).json({ error: 'Neznámá databáze.' });
  const snap = readSnapshot(name, id);
  if (!snap) return res.status(404).json({ error: 'Snapshot nenalezen.' });
  try {
    snapshotDb(name); // záloha aktuálního stavu před obnovou (jde vrátit zpět)
    if (snap.schema) writeSchema(name, snap.schema);
    writeRows(name, snap.rows ?? []);
    const saved = getDb(name);
    appendAudit({ action: 'restore', db: name, from: id, rows: saved.rows.length });
    res.json({ ok: true, count: saved.rows.length, schema: saved.schema });
  } catch (err) {
    console.error('[restore]', err);
    res.status(500).json({ error: 'Chyba při obnově.' });
  }
});

// ─── Admin: audit log ─────────────────────────────────────────────────────────
app.get('/api/admin/audit', (req, res) => {
  if (!checkAdmin(req, res)) return;
  res.json({ records: readAudit(Math.min(Number(req.query.limit) || 200, 1000)) });
});

// ─── Admin: read-only hledání v hlavní DB (master CSV) ──────────────────────────
app.get('/api/admin/master-search', (req, res) => {
  if (!checkAdmin(req, res)) return;
  const q = (req.query.q ?? '').toString().trim();
  if (!q) return res.json({ results: [] });
  try {
    res.json({ results: searchTerm(q, 50) });
  } catch (err) {
    console.error('[master-search]', err);
    res.status(500).json({ error: 'Chyba při hledání.' });
  }
});

// ─── Admin: AI logy ─────────────────────────────────────────────────────────
// Čte server/logs/chats.jsonl (JSONL). Vrací posledních N záznamů (nejnovější první).
app.get('/api/admin/logs', (req, res) => {
  if (!checkAdmin(req, res)) return;
  const limit = Math.min(Number(req.query.limit) || 200, 1000);
  const typeFilter = req.query.type;
  try {
    const file = join(LOGS_DIR, 'chats.jsonl');
    if (!existsSync(file)) return res.json({ records: [], total: 0 });
    const lines = readFileSync(file, 'utf-8').split('\n').filter(Boolean);
    const records = [];
    for (let i = lines.length - 1; i >= 0 && records.length < limit; i--) {
      try {
        const rec = JSON.parse(lines[i]);
        if (typeFilter && typeFilter !== 'all' && rec.type !== typeFilter) continue;
        records.push(rec);
      } catch { /* poškozený řádek přeskoč */ }
    }
    res.json({ records, total: lines.length });
  } catch (err) {
    console.error('[admin:logs]', err);
    res.status(500).json({ error: 'Chyba při čtení logů.' });
  }
});

// ─── Admin: hlavní DB (master CSV) ─────────────────────────────────────────────
app.get('/api/admin/master-csv', (req, res) => {
  if (!checkAdmin(req, res)) return;
  const info = {};
  for (const [key, name] of Object.entries(MASTER_FILES)) {
    const p = join(DATA_DIR, name);
    info[key] = existsSync(p)
      ? { name, bytes: statSync(p).size, modified: statSync(p).mtime.toISOString() }
      : { name, bytes: 0, modified: null };
  }
  res.json({ files: info, articleCount: getArticleCount() });
});

// Stažení aktuálního master CSV ze serveru
app.get('/api/admin/master-csv/:which/download', (req, res) => {
  if (!checkAdmin(req, res)) return;
  const { which } = req.params;
  if (!MASTER_FILES[which]) return res.status(404).json({ error: 'Neznámý soubor (main|effi).' });
  const p = join(DATA_DIR, MASTER_FILES[which]);
  if (!existsSync(p)) return res.status(404).json({ error: 'Soubor neexistuje.' });
  res.download(p, MASTER_FILES[which]);
});

// Nahrání nové verze master CSV. Tělo: { dataBase64 } (zachová přesné byty / kódování).
app.put('/api/admin/master-csv/:which', (req, res) => {
  if (!checkAdmin(req, res)) return;
  const { which } = req.params;
  if (!MASTER_FILES[which]) return res.status(404).json({ error: 'Neznámý soubor (main|effi).' });
  const { dataBase64 } = req.body ?? {};
  if (typeof dataBase64 !== 'string' || !dataBase64) {
    return res.status(400).json({ error: 'Chybí dataBase64.' });
  }
  try {
    const buf = Buffer.from(dataBase64, 'base64');
    if (buf.length === 0) return res.status(400).json({ error: 'Prázdný soubor.' });
    const tmp = join(DATA_DIR, MASTER_FILES[which] + '.tmp');
    writeFileSync(tmp, buf);
    renameSync(tmp, join(DATA_DIR, MASTER_FILES[which]));
    const count = reloadMaster();
    appendAudit({ action: 'master-csv', which, bytes: buf.length, articleCount: count });
    res.json({ ok: true, articleCount: count });
  } catch (err) {
    console.error('[admin:master-csv]', err);
    res.status(500).json({ error: 'Chyba při ukládání CSV.' });
  }
});

app.listen(PORT, () => {
  console.log(`[server] Running on port ${PORT}`);
});
