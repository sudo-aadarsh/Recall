import { NextRequest } from 'next/server';
import { query, queryMany, getUserWorkspace } from '@/lib/db';
import { generateEmbedding, toVectorString } from '@/lib/embeddings';
import { askWithContext } from '@/lib/ai';
import type { SearchResult } from '@/lib/ai';

// ─── POST /api/ask ───────────────────────────────────────────────────
// The full RAG (Retrieval-Augmented Generation) pipeline:
// 1. Embed the question
// 2. Retrieve semantically relevant notes from Aurora PostgreSQL
// 3. Stream Claude's answer, grounded in the retrieved context
// 4. Save the Q&A to history
//
// Uses a streaming Response so the answer appears word-by-word.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { question } = body;

    if (!question?.trim()) {
      return new Response(JSON.stringify({ error: 'Question is required' }), { status: 400 });
    }

    // Step 1: Embed the question
    const questionEmbedding = await generateEmbedding(question);
    const vectorStr = toVectorString(questionEmbedding);

    // Step 2: Retrieve top-8 most relevant notes from Aurora pgvector
    const relevantNotes = await queryMany<SearchResult>(
      `SELECT * FROM search_notes($1::vector, $2, 0.2, 8)`,
      [vectorStr, await getUserWorkspace()]
    );

    if (relevantNotes.length === 0) {
      // No relevant context found — tell Claude to say so
      return new Response(
        "I couldn't find any relevant notes in your knowledge base to answer that question. Try adding notes on this topic first!",
        { headers: { 'Content-Type': 'text/plain' } }
      );
    }

    const sourceNoteIds = relevantNotes.map((n) => n.id);

    // Step 3: Stream Claude's answer
    const stream = await askWithContext(question, relevantNotes);

    // Step 4: Return a streaming response
    let fullAnswer = '';
    const readableStream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          for await (const chunk of stream) {
            fullAnswer += chunk;
            controller.enqueue(encoder.encode(chunk));
          }
        } finally {
          controller.close();

          // Step 5: Persist Q&A to history (async, after stream ends)
          query(
            `INSERT INTO qa_history (workspace_id, question, answer, source_note_ids)
             VALUES ($1, $2, $3, $4)`,
            [await getUserWorkspace(), question, fullAnswer, sourceNoteIds]
          ).catch(console.error);
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        // Send source note IDs as a header for the UI to highlight them
        'X-Source-Note-Ids': JSON.stringify(sourceNoteIds),
        'X-Source-Count': String(relevantNotes.length),
      },
    });
  } catch (error) {
    console.error('[POST /api/ask]', error);
    return new Response(JSON.stringify({ error: 'Failed to process question' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
