import express from 'express';
import cors from 'cors';
import { handleChat } from './chat.js';
import { handleBomBuild, checkClarification, postCheckClarification } from './bomBuilder.js';
import { handleGuidedChat } from './guidedSearch.js';
import { COMPONENT_CATEGORIES } from './componentGuide.js';

const app = express();
const PORT = process.env.PORT ?? 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? '*';

app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/chat', async (req, res) => {
  const { message, history = [], webSearchEnabled = false, synthModel, componentAdvisor = false } = req.body ?? {};

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

  try {
    const result = await handleChat(
      message.trim(),
      history,
      (step, label, meta = {}) => send('status', { step, label, ...meta }),
      !!webSearchEnabled,
      synthModel,
      !!componentAdvisor,
    );
    send('result', result);
  } catch (err) {
    console.error('[chat]', err);
    send('error', { error: 'Chyba při zpracování dotazu.' });
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

  try {
    const result = await handleBomBuild(
      rows,
      preferences,
      (rowIndex, total, typoveOznaceni, status, mfrName) =>
        send('progress', { rowIndex, total, typoveOznaceni, status, mfrName }),
      answers,
    );
    send('result', { ...result, produktovaHierarchie, artiklVrcholu });
  } catch (err) {
    console.error('[bom-build]', err);
    send('error', { error: 'Chyba při zpracování kusovníku.' });
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

  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
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
  }

  res.end();
});

app.listen(PORT, () => {
  console.log(`[server] Running on port ${PORT}`);
});
