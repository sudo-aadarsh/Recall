import { NextRequest, NextResponse } from 'next/server';
import { queryMany, getUserWorkspace } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { from_note_id, to_note_id } = await req.json();
    const workspaceId = await getUserWorkspace();

    // Ensure both notes belong to user
    const check = await queryMany(
      `SELECT id FROM notes WHERE id IN ($1, $2) AND workspace_id = $3`,
      [from_note_id, to_note_id, workspaceId]
    );

    if (check.length !== 2) {
      return NextResponse.json({ error: 'Notes not found or access denied' }, { status: 403 });
    }

    // Insert bidirectionally
    await queryMany(`
      INSERT INTO note_connections (from_note_id, to_note_id, similarity_score, connection_type, connection_reason)
      VALUES ($1, $2, 1.0, 'manual', 'Manually connected by user'),
             ($2, $1, 1.0, 'manual', 'Manually connected by user')
      ON CONFLICT DO NOTHING
    `, [from_note_id, to_note_id]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[POST /api/connections/manual]', error);
    return NextResponse.json({ error: 'Failed to add connection' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const from_note_id = searchParams.get('from_note_id');
    const to_note_id = searchParams.get('to_note_id');
    const workspaceId = await getUserWorkspace();

    if (!from_note_id || !to_note_id) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // Ensure access
    const check = await queryMany(
      `SELECT id FROM notes WHERE id IN ($1, $2) AND workspace_id = $3`,
      [from_note_id, to_note_id, workspaceId]
    );

    if (check.length !== 2) {
      return NextResponse.json({ error: 'Notes not found or access denied' }, { status: 403 });
    }

    // Delete bidirectionally
    await queryMany(`
      DELETE FROM note_connections 
      WHERE (from_note_id = $1 AND to_note_id = $2) OR (from_note_id = $2 AND to_note_id = $1)
    `, [from_note_id, to_note_id]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/connections/manual]', error);
    return NextResponse.json({ error: 'Failed to remove connection' }, { status: 500 });
  }
}
