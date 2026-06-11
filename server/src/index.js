import express from 'express';
import cors from 'cors';
import { handleChat } from './chat.js';
import { handleBomBuild, checkClarification, postCheckClarification } from './bomBuilder.js';
import { handleGuidedChat } from './guidedSearch.js';
import { COMPONENT_CATEGORIES } from './componentGuide.js';
import { logRecord } from './collector.js';
import { DATABASES, isValidDb, getDb, writeRows, writeSchema, readSchema } from './dataStore.js';

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

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
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

// Veřejné čtení dat + schématu — používá frontend vyhledávání pro živá data a
// dynamické filtry. Nevyžaduje heslo (jen čtení).
app.get('/api/db/:name', (req, res) => {
  const { name } = req.params;
  if (!isValidDb(name)) return res.status(404).json({ error: 'Neznámá databáze.' });
  try {
    res.json(getDb(name));
  } catch (err) {
    console.error('[db:get]', err);
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
    if (schema !== undefined) writeSchema(name, schema);
    if (rows !== undefined) {
      if (!Array.isArray(rows)) return res.status(400).json({ error: 'rows musí být pole.' });
      writeRows(name, rows);
    }
    const saved = getDb(name);
    res.json({ ok: true, count: saved.rows.length, schema: saved.schema });
  } catch (err) {
    console.error('[db:put]', err);
    res.status(500).json({ error: 'Chyba při ukládání databáze.' });
  }
});

app.listen(PORT, () => {
  console.log(`[server] Running on port ${PORT}`);
});
