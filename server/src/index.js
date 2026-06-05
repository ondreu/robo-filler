import express from 'express';
import cors from 'cors';
import { handleChat } from './chat.js';

const app = express();
const PORT = process.env.PORT ?? 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? '*';

app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/chat', async (req, res) => {
  const { message } = req.body ?? {};

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'Chybí parametr message.' });
  }

  if (!process.env.MISTRAL_API_KEY) {
    return res.status(500).json({ error: 'MISTRAL_API_KEY není nastaven.' });
  }

  try {
    const result = await handleChat(message.trim());
    res.json(result);
  } catch (err) {
    console.error('[chat]', err);
    res.status(500).json({ error: 'Chyba při zpracování dotazu.' });
  }
});

app.listen(PORT, () => {
  console.log(`[server] Running on port ${PORT}`);
});
