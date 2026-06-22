import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { queryMany, getUserWorkspace } from '@/lib/db';
import { generateEmbedding, toVectorString } from '@/lib/embeddings';

// ─── GET /api/search?q=your+question ────────────────────────────────
// Converts the query to a vector embedding, then uses pgvector's cosine
// distance operator (<=> ) to find the most semantically similar notes.
// This is the core technical differentiator — not keyword matching.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim();
    const threshold = parseFloat(searchParams.get('threshold') ?? '0.25');
    const limit = parseInt(searchParams.get('limit') ?? '10');

    if (!q) {
      return NextResponse.json({ error: 'Query parameter q is required' }, { status: 400 });
    }

    // Generate embedding for the search query
    const queryEmbedding = await generateEmbedding(q);
    const vectorStr = toVectorString(queryEmbedding);

    // pgvector cosine similarity search via Aurora PostgreSQL
    // The search_notes function was defined in schema.sql
    const results = await queryMany(
      `SELECT * FROM search_notes($1::vector, $2, $3, $4)`,
      [vectorStr, await getUserWorkspace(), threshold, limit]
    );

    return NextResponse.json({
      query: q,
      results,
      count: results.length,
    });
  } catch (error) {
    console.error('[GET /api/search]', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
