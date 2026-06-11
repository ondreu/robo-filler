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

export async function fetchDb(name: DbName): Promise<{ rows: DbRow[]; schema: DbSchema }> {
  const res = await fetch(`${BACKEND_URL}/api/db/${name}`);
  if (!res.ok) throw new Error(`Načtení databáze selhalo (${res.status}).`);
  const data = await res.json();
  return { rows: Array.isArray(data.rows) ? data.rows : [], schema: data.schema };
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
