import { Pool, QueryResult, QueryResultRow } from 'pg';

// Aurora PostgreSQL connection pool — optimized for serverless Vercel
// Aurora supports up to 5000 connections but Vercel functions are ephemeral,
// so we keep pool size small and rely on Aurora's built-in connection pooler.

declare global {
  var _pgPool: Pool | undefined;
}

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  return new Pool({
    connectionString,
    max: 10,                  // Max connections per Vercel function instance
    idleTimeoutMillis: 30000, // Close idle connections after 30s
    connectionTimeoutMillis: 5000,
    ssl: process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }  // Aurora requires SSL in production
      : false,
  });
}

// Singleton pool — reused across hot-reload in development
export const pool = globalThis._pgPool ?? createPool();
if (process.env.NODE_ENV !== 'production') globalThis._pgPool = pool;

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
