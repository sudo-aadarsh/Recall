import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import TurndownService from 'turndown';
import { query, queryMany, getUserWorkspace } from '@/lib/db';
import { generateEmbedding, formatNoteForEmbedding, toVectorString } from '@/lib/embeddings';
import { analyzeNote } from '@/lib/ai';
import { runHook } from '@/lib/plugins';

// ─── GET /api/notes ──────────────────────────────────────────────────
// Returns all notes for the workspace, newest first.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tag = searchParams.get('tag');
    const limit = parseInt(searchParams.get('limit') ?? '50');
    const offset = parseInt(searchParams.get('offset') ?? '0');

    let sql = `
      SELECT
        n.id, n.title, n.content, n.tags, n.summary, n.key_concepts,
        n.source, n.is_pinned, n.view_count, n.created_at, n.updated_at,
        COUNT(nc.to_note_id)::INT AS connection_count
      FROM notes n
      LEFT JOIN note_connections nc ON nc.from_note_id = n.id
      WHERE n.workspace_id = $1
    `;
    const params: unknown[] = [await getUserWorkspace()];

    if (tag) {
      params.push(tag);
      sql += ` AND $${params.length} = ANY(n.tags)`;
    }

    sql += `
      GROUP BY n.id
      ORDER BY n.is_pinned DESC, n.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    params.push(limit, offset);

    const notes = await queryMany(sql, params);

    // Get all unique tags for filter UI
    const tagsResult = await query<{ tag: string }>(
      `SELECT DISTINCT UNNEST(tags) AS tag FROM notes WHERE workspace_id = $1 ORDER BY tag`,
      [await getUserWorkspace()]
    );

    return NextResponse.json({
      notes,
      tags: tagsResult.rows.map((r) => r.tag),
      total: notes.length,
    });
  } catch (error) {
    console.error('[GET /api/notes]', error);
    return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 });
  }
}

// ─── POST /api/notes ─────────────────────────────────────────────────
// Creates a new note: runs AI tagging + embedding generation in parallel,
// then discovers connections to existing notes using pgvector.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { content, source = 'manual', autoSplit = false } = body;

    if (!content?.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    let finalContent = content.trim();
    let finalSource = source;

    // Check if the content is exactly a single URL
    try {
      const url = new URL(finalContent);
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        try {
          const isYouTube = url.hostname.includes('youtube.com') || url.hostname.includes('youtu.be');
          
          if (isYouTube) {
            const { YoutubeTranscript } = require('youtube-transcript');
            const transcript = await YoutubeTranscript.fetchTranscript(url.toString());
            const transcriptText = transcript.map((t: any) => t.text).join(' ');
            
            const res = await fetch(url.toString(), {
              headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
            });
            const html = await res.text();
            const cheerio = require('cheerio');
            const $ = cheerio.load(html);
            const pageTitle = $('title').text().replace('- YouTube', '').trim() || 'YouTube Video';
            
            finalContent = `YouTube Video URL: ${url.toString()}\nTitle: ${pageTitle}\n\nTranscript:\n${transcriptText}`;
            finalContent = finalContent.substring(0, 15000); // limit to avoid massive context
            finalSource = 'youtube-clip';
          } else {
            const res = await fetch(url.toString(), {
              headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
            });
            const html = await res.text();
            const cheerio = require('cheerio');
            const $ = cheerio.load(html);
            
            $('script, style, noscript, nav, footer, header, iframe').remove();
            const pageTitle = $('title').text().trim() || url.hostname;
            
            const turndownService = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
            const markdownText = turndownService.turndown($('body').html() || '');
            
            finalContent = `URL: ${url.toString()}\nTitle: ${pageTitle}\n\n${markdownText}`;
            finalContent = finalContent.substring(0, 15000); // limit to avoid massive context
            finalSource = 'web-clip';
          }
        } catch (err) {
          console.error('Failed to fetch URL content', err);
        }
      }
    } catch {
      // Not a URL, proceed normally
    }

    // Step 1: Handle auto-split if requested and content is large
    if (autoSplit && finalContent.length > 2000) {
      const { splitLargeNote } = require('@/lib/ai');
      const splits = await splitLargeNote(finalContent);
      
      if (splits.length > 0) {
        // Group tag to link them as a "directory"
        const groupTag = `group-${Date.now().toString().slice(-6)}`;
        const insertedNotes = [];
        
        for (const split of splits) {
          const splitTitle = split.title || 'Note section';
          const splitTags = [...(split.tags || []), groupTag];
          
          const embedding = await generateEmbedding(formatNoteForEmbedding(splitTitle, split.content));
          const noteId = uuidv4();
          const vectorStr = toVectorString(embedding);
          
          const { rows } = await query(
            `INSERT INTO notes
              (id, workspace_id, title, content, summary, tags, key_concepts, embedding, source)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8::vector, $9)
             RETURNING id, title, summary, tags, key_concepts, created_at`,
            [
              noteId,
              await getUserWorkspace(),
              splitTitle,
              split.content,
              split.summary,
              splitTags,
              split.key_concepts || [],
              vectorStr,
              finalSource,
            ]
          );
          
          insertedNotes.push(rows[0]);
          findAndStoreConnections(noteId, vectorStr).catch(console.error);
          processManualConnections(noteId, split.content).catch(console.error);
          runHook('onNoteCreate', rows[0]).catch(console.error);
        }
        
        return NextResponse.json({ notes: insertedNotes, isSplit: true }, { status: 201 });
      }
    }

    // Step 2: Normal flow (Run AI analysis and embedding generation in PARALLEL)
    const [aiMetadata, embedding] = await Promise.all([
      analyzeNote(finalContent),
      generateEmbedding(formatNoteForEmbedding(
        finalContent.slice(0, 60), // tentative title for embedding
        finalContent
      )),
    ]);

    const { title, summary, tags, key_concepts } = aiMetadata;
    const noteId = uuidv4();
    const vectorStr = toVectorString(embedding);

    // Step 3: Insert the note with its embedding
    const { rows } = await query(
      `INSERT INTO notes
        (id, workspace_id, title, content, summary, tags, key_concepts, embedding, source)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::vector, $9)
       RETURNING id, title, summary, tags, key_concepts, created_at`,
      [
        noteId,
        await getUserWorkspace(),
        title,
        finalContent,
        summary,
        tags,
        key_concepts,
        vectorStr,
        finalSource,
      ]
    );

    const newNote = rows[0];

    // Step 4: Find semantically similar existing notes using pgvector, parse wikilinks, run plugins
    findAndStoreConnections(noteId, vectorStr).catch(console.error);
    processManualConnections(noteId, finalContent).catch(console.error);
    runHook('onNoteCreate', newNote).catch(console.error);

    return NextResponse.json({ note: newNote, isSplit: false }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/notes]', error);
    return NextResponse.json({ error: 'Failed to create note' }, { status: 500 });
  }
}

// ─── Internal: discover connections ──────────────────────────────────

async function findAndStoreConnections(
  newNoteId: string,
  vectorStr: string
): Promise<void> {
  // Find the 5 most similar existing notes (excluding the new note itself)
  const similar = await queryMany<{
    id: string;
    similarity: number;
  }>(
    `SELECT id, 1 - (embedding <=> $1::vector) AS similarity
     FROM notes
     WHERE workspace_id = $2
       AND id != $3
       AND embedding IS NOT NULL
       AND 1 - (embedding <=> $1::vector) > 0.4
     ORDER BY embedding <=> $1::vector
     LIMIT 5`,
    [vectorStr, await getUserWorkspace(), newNoteId]
  );

  if (similar.length === 0) return;

  // Insert connections (bidirectional)
  for (const match of similar) {
    await query(
      `INSERT INTO note_connections (from_note_id, to_note_id, similarity_score, connection_type)
       VALUES ($1, $2, $3, 'semantic'), ($2, $1, $3, 'semantic')
       ON CONFLICT (from_note_id, to_note_id) DO NOTHING`,
      [newNoteId, match.id, match.similarity]
    );
  }
}

async function processManualConnections(newNoteId: string, content: string): Promise<void> {
  const wikilinks = Array.from(content.matchAll(/\[\[(.*?)\]\]/g)).map(m => m[1].trim());
  if (wikilinks.length === 0) return;

  const uniqueLinks = Array.from(new Set(wikilinks));
  
  for (const link of uniqueLinks) {
    // Find note by exact title match (case insensitive)
    const { rows } = await query(
      `SELECT id FROM notes WHERE workspace_id = $1 AND title ILIKE $2 LIMIT 1`,
      [await getUserWorkspace(), link]
    );

    if (rows.length > 0) {
      const matchId = rows[0].id;
      if (matchId !== newNoteId) {
        await query(
          `INSERT INTO note_connections (from_note_id, to_note_id, similarity_score, connection_type)
           VALUES ($1, $2, $3, 'manual'), ($2, $1, $3, 'manual')
           ON CONFLICT (from_note_id, to_note_id) DO NOTHING`,
          [newNoteId, matchId, 1.0]
        );
      }
    }
  }
}
