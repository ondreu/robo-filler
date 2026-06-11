// API klient pro admin správu databází.
import type { DbName, DbRow, DbSchema, DbInfo } from './dbSchema';

const BACKEND_URL = ((import.meta.env.VITE_BACKEND_URL as string | undefined) ?? '').trim().replace(/\/$/, '');

export const ADMIN_AVAILABLE = !!BACKEND_URL;

export async function loginAdmin(password: string): Promise<boolean> {
  if (!BACKEND_URL) return false;
  try {
    const res = await fetch(`${BACKEND_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function listDatabases(): Promise<DbInfo[]> {
  if (!BACKEND_URL) return [];
  try {
    const res = await fetch(`${BACKEND_URL}/api/db`);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function fetchDb(name: DbName, password: string): Promise<{ rows: DbRow[]; schema: DbSchema }> {
  // Admin endpoint vrací plná data včetně interních klíčů (admin poznámky).
  const res = await fetch(`${BACKEND_URL}/api/admin/db/${name}`, {
    headers: { 'x-admin-password': password },
  });
  if (res.status === 401) throw new Error('Neplatné heslo — přihlas se znovu.');
  if (!res.ok) throw new Error(`Načtení databáze selhalo (${res.status}).`);
  const data = await res.json();
  return { rows: Array.isArray(data.rows) ? data.rows : [], schema: data.schema };
}

export interface ChatLogRecord {
  ts: string;
  type?: string;
  message?: string;
  phase?: string;
  preferences?: string;
  result?: unknown;
  [k: string]: unknown;
}

export async function fetchLogs(password: string, opts: { limit?: number; type?: string } = {}): Promise<{ records: ChatLogRecord[]; total: number }> {
  const params = new URLSearchParams();
  if (opts.limit) params.set('limit', String(opts.limit));
  if (opts.type && opts.type !== 'all') params.set('type', opts.type);
  const res = await fetch(`${BACKEND_URL}/api/admin/logs?${params}`, {
    headers: { 'x-admin-password': password },
  });
  if (res.status === 401) throw new Error('Neplatné heslo — přihlas se znovu.');
  if (!res.ok) throw new Error(`Načtení logů selhalo (${res.status}).`);
  return await res.json();
}

export interface MasterCsvInfo {
  files: Record<'main' | 'effi', { name: string; bytes: number; modified: string | null }>;
  articleCount: number;
}

export async function fetchMasterCsvInfo(password: string): Promise<MasterCsvInfo> {
  const res = await fetch(`${BACKEND_URL}/api/admin/master-csv`, {
    headers: { 'x-admin-password': password },
  });
  if (res.status === 401) throw new Error('Neplatné heslo — přihlas se znovu.');
  if (!res.ok) throw new Error(`Načtení info selhalo (${res.status}).`);
  return await res.json();
}

export async function uploadMasterCsv(password: string, which: 'main' | 'effi', dataBase64: string): Promise<{ ok: boolean; articleCount: number }> {
  const res = await fetch(`${BACKEND_URL}/api/admin/master-csv/${which}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
    body: JSON.stringify({ dataBase64 }),
  });
  if (res.status === 401) throw new Error('Neplatné heslo — přihlas se znovu.');
  if (!res.ok) {
    let msg = `Upload selhal (${res.status}).`;
    try { const j = await res.json(); if (j.error) msg = j.error; } catch { /* ignore */ }
    throw new Error(msg);
  }
  return await res.json();
}

export async function saveDb(
  name: DbName,
  password: string,
  payload: { rows?: DbRow[]; schema?: DbSchema },
): Promise<{ ok: boolean; count: number; schema: DbSchema }> {
  const res = await fetch(`${BACKEND_URL}/api/admin/db/${name}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
    body: JSON.stringify(payload),
  });
  if (res.status === 401) throw new Error('Neplatné heslo — přihlas se znovu.');
  if (!res.ok) {
    let msg = `Uložení selhalo (${res.status}).`;
    try { const j = await res.json(); if (j.error) msg = j.error; } catch { /* ignore */ }
    throw new Error(msg);
  }
  return await res.json();
}
