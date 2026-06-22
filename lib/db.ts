import { QueryResult, QueryResultRow } from 'pg';
import { pool } from './pool';

// ─── Query helpers ──────────────────────────────────────────────────

export async function query<T extends QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const start = Date.now();
  const result = await pool.query<T>(text, params);
  const duration = Date.now() - start;
  if (process.env.NODE_ENV === 'development') {
    console.log('[DB]', { text: text.slice(0, 80), duration: `${duration}ms`, rows: result.rowCount });
  }
  return result;
}

export async function queryOne<T extends QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const result = await query<T>(text, params);
  return result.rows[0] ?? null;
}

export async function queryMany<T extends QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const result = await query<T>(text, params);
  return result.rows;
}

import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"

export async function getUserWorkspace(): Promise<string> {
  const session = await getServerSession(authOptions);
  if (!session?.user || !(session.user as any).id) {
    throw new Error("Unauthorized");
  }
  const userId = (session.user as any).id;
  
  // Ensure the user has a workspace record (using their userId as the workspace id)
  await query('INSERT INTO workspaces (id, name, slug) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING', [userId, session.user.name || 'My Workspace', userId]);
  
  return userId;
}
