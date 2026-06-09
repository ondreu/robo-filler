import { appendFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOGS_DIR = join(__dirname, '..', 'logs');
const LOG_FILE = join(LOGS_DIR, 'chats.jsonl');

async function ensureDir() {
  await mkdir(LOGS_DIR, { recursive: true });
}

export async function logRecord(record) {
  try {
    await ensureDir();
    const line = JSON.stringify({ ts: new Date().toISOString(), ...record }) + '\n';
    await appendFile(LOG_FILE, line, 'utf8');
  } catch (err) {
    console.error('[collector] Chyba při zápisu logu:', err.message);
  }
}
