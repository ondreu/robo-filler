import express from 'express';
import cors from 'cors';
import { handleChat } from './chat.js';
import { handleBomBuild } from './bomBuilder.js';

const app = express();
const PORT = process.env.PORT ?? 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? '*';

app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/chat', async (req, res) => {
  const { message, history = [], webSearchEnabled = false, synthModel } = req.body ?? {};

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
    );
    send('result', result);
  } catch (err) {
    console.error('[chat]', err);
    send('error', { error: 'Chyba při zpracování dotazu.' });
  }

  res.end();
});

app.post('/api/bom-build', async (req, res) => {
  const { rows = [], preferences = '', produktovaHierarchie = '', artiklVrcholu = '' } = req.body ?? {};

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
      (rowIndex, total, typoveOznaceni, status) =>
        send('progress', { rowIndex, total, typoveOznaceni, status }),
    );
    send('result', { ...result, produktovaHierarchie, artiklVrcholu });
  } catch (err) {
    console.error('[bom-build]', err);
    send('error', { error: 'Chyba při zpracování kusovníku.' });
  }

  res.end();
});

app.listen(PORT, () => {
  console.log(`[server] Running on port ${PORT}`);
});
