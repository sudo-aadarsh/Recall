import { NextRequest, NextResponse } from 'next/server';
import { queryMany, queryOne, getUserWorkspace } from '@/lib/db';
import { generateKnowledgeInsights } from '@/lib/ai';

// ─── GET /api/connections ────────────────────────────────────────────
// Returns the full connection graph for the workspace:
// nodes = notes, edges = connections with similarity scores.
// Used by the knowledge graph visualization.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const noteId = searchParams.get('noteId');

    if (noteId) {
      // Connections for a specific note
      const connections = await queryMany(
        `SELECT
           n.id, n.title, n.summary, n.tags,
           nc.similarity_score, nc.connection_reason, nc.connection_type
         FROM note_connections nc
         JOIN notes n ON n.id = nc.to_note_id
         WHERE nc.from_note_id = $1
         ORDER BY nc.similarity_score DESC
         LIMIT 10`,
        [noteId]
      );
      return NextResponse.json({ connections });
    }

    // Full graph: all nodes + edges
    const nodes = await queryMany(
      `SELECT id, title, tags, summary,
              (SELECT COUNT(*) FROM note_connections WHERE from_note_id = notes.id)::INT AS degree
       FROM notes
       WHERE workspace_id = $1
       ORDER BY created_at DESC`,
      [await getUserWorkspace()]
    );

    const edges = await queryMany(
      `SELECT nc.from_note_id, nc.to_note_id, nc.similarity_score, nc.connection_reason
       FROM note_connections nc
       JOIN notes n1 ON n1.id = nc.from_note_id
       JOIN notes n2 ON n2.id = nc.to_note_id
       WHERE n1.workspace_id = $1
         AND nc.from_note_id < nc.to_note_id  -- deduplicate bidirectional edges
         AND n1.title != n2.title             -- ignore connections between identical titles
         AND nc.similarity_score > 0.45
       ORDER BY nc.similarity_score DESC
       LIMIT 200`,
      [await getUserWorkspace()]
    );

    // Stats
    const stats = await queryOne(
      `SELECT
         COUNT(DISTINCT n.id)::INT AS note_count,
         COUNT(DISTINCT nc.from_note_id)::INT AS connected_notes,
         AVG(nc.similarity_score)::FLOAT AS avg_similarity,
         (SELECT tag FROM (SELECT UNNEST(tags) AS tag FROM notes WHERE workspace_id=$1) t
          WHERE tag NOT LIKE 'group-%'
          GROUP BY tag ORDER BY COUNT(*) DESC LIMIT 1) AS top_tag
       FROM notes n
       LEFT JOIN note_connections nc ON nc.from_note_id = n.id
       WHERE n.workspace_id = $1`,
      [await getUserWorkspace()]
    );

    return NextResponse.json({ nodes, edges, stats });
  } catch (error) {
    console.error('[GET /api/connections]', error);
    return NextResponse.json({ error: 'Failed to fetch connections' }, { status: 500 });
  }
}

// ─── POST /api/connections/insights ──────────────────────────────────
// Triggers AI insight generation across all notes in the workspace.
export async function POST() {
  try {
    const notes = await queryMany<{ title: string; tags: string[] }>(
      `SELECT title, tags FROM notes WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [await getUserWorkspace()]
    );

    if (notes.length < 3) {
      return NextResponse.json({
        insights: '• Add at least 3 notes to unlock AI insights about your knowledge base.',
      });
    }

    const insights = await generateKnowledgeInsights(notes);
    return NextResponse.json({ insights });
  } catch (error) {
    console.error('[POST /api/connections]', error);
    return NextResponse.json({ error: 'Failed to generate insights' }, { status: 500 });
  }
}
