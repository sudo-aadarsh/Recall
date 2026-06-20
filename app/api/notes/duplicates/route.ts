import { NextRequest, NextResponse } from 'next/server';
import { queryMany, query, getUserWorkspace } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    // Find note pairs with high similarity (e.g. > 0.95)
    // We group them by finding all pairs and returning them as duplicate sets.
    const threshold = 0.95;
    const sql = `
      SELECT 
        n1.id as id1, n1.title as title1, n1.content as content1, n1.tags as tags1, n1.created_at as created_at1,
        n2.id as id2, n2.title as title2, n2.content as content2, n2.tags as tags2, n2.created_at as created_at2,
        1 - (n1.embedding <=> n2.embedding) AS similarity
      FROM notes n1
      JOIN notes n2 ON n1.id < n2.id
      WHERE n1.workspace_id = $1 
        AND n2.workspace_id = $1
        AND n1.embedding IS NOT NULL
        AND n2.embedding IS NOT NULL
        AND 1 - (n1.embedding <=> n2.embedding) > $2
      ORDER BY similarity DESC
      LIMIT 50
    `;
    const pairs = await queryMany(sql, [await getUserWorkspace(), threshold]);

    return NextResponse.json({ duplicates: pairs }, { status: 200 });
  } catch (error) {
    console.error('[GET /api/notes/duplicates]', error);
    return NextResponse.json({ error: 'Failed to fetch duplicates' }, { status: 500 });
  }
}

// Merge duplicate notes: Keeps the first ID, deletes the second ID.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { keepId, deleteId } = body;

    if (!keepId || !deleteId) {
      return NextResponse.json({ error: 'Missing keepId or deleteId' }, { status: 400 });
    }

    // Move connections from deleteId to keepId before deleting
    await query(`
      UPDATE note_connections 
      SET from_note_id = $1 
      WHERE from_note_id = $2
    `, [keepId, deleteId]);

    await query(`
      UPDATE note_connections 
      SET to_note_id = $1 
      WHERE to_note_id = $2
    `, [keepId, deleteId]);

    // Finally delete the duplicate note
    await query(`DELETE FROM notes WHERE id = $1 AND workspace_id = $2`, [deleteId, await getUserWorkspace()]);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('[POST /api/notes/duplicates]', error);
    return NextResponse.json({ error: 'Failed to merge duplicates' }, { status: 500 });
  }
}
