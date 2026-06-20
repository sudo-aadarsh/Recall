import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, queryMany, getUserWorkspace } from '@/lib/db';
import { generateEmbedding, formatNoteForEmbedding, toVectorString } from '@/lib/embeddings';
import { analyzeNote } from '@/lib/ai';

// ─── GET /api/notes/:id ──────────────────────────────────────────────
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const note = await queryOne(
      `UPDATE notes SET view_count = view_count + 1
       WHERE id = $1 AND workspace_id = $2
       RETURNING *`,
      [params.id, await getUserWorkspace()]
    );

    if (!note) return NextResponse.json({ error: 'Note not found' }, { status: 404 });

    // Fetch connections
    const connections = await queryMany(
      `SELECT n.id, n.title, n.summary, n.tags, nc.similarity_score, nc.connection_reason
       FROM note_connections nc
       JOIN notes n ON n.id = nc.to_note_id
       WHERE nc.from_note_id = $1
       ORDER BY nc.similarity_score DESC
       LIMIT 8`,
      [params.id]
    );

    return NextResponse.json({ note, connections });
  } catch (error) {
    console.error('[GET /api/notes/:id]', error);
    return NextResponse.json({ error: 'Failed to fetch note' }, { status: 500 });
  }
}

// ─── PUT /api/notes/:id ──────────────────────────────────────────────
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const { content, is_pinned } = body;

    if (content !== undefined) {
      // Re-analyze and re-embed when content changes
      const [aiMetadata, embedding] = await Promise.all([
        analyzeNote(content),
        generateEmbedding(formatNoteForEmbedding(content.slice(0, 60), content)),
      ]);

      const { title, summary, tags, key_concepts } = aiMetadata;
      const vectorStr = toVectorString(embedding);

      const note = await queryOne(
        `UPDATE notes
         SET title=$1, content=$2, summary=$3, tags=$4, key_concepts=$5, embedding=$6::vector, updated_at=NOW()
         WHERE id=$7 AND workspace_id=$8
         RETURNING *`,
        [title, content, summary, tags, key_concepts, vectorStr, params.id, await getUserWorkspace()]
      );

      return NextResponse.json({ note });
    }

    if (is_pinned !== undefined) {
      const note = await queryOne(
        `UPDATE notes SET is_pinned=$1, updated_at=NOW() WHERE id=$2 AND workspace_id=$3 RETURNING *`,
        [is_pinned, params.id, await getUserWorkspace()]
      );
      return NextResponse.json({ note });
    }

    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  } catch (error) {
    console.error('[PUT /api/notes/:id]', error);
    return NextResponse.json({ error: 'Failed to update note' }, { status: 500 });
  }
}

// ─── DELETE /api/notes/:id ───────────────────────────────────────────
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await query(
      `DELETE FROM notes WHERE id=$1 AND workspace_id=$2`,
      [params.id, await getUserWorkspace()]
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/notes/:id]', error);
    return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 });
  }
}
