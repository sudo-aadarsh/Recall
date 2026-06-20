import { Pool } from 'pg';
import OpenAI from 'openai';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const client = new OpenAI({ 
  apiKey: process.env.GROQ_API_KEY_1 || process.env.GROQ_API_KEY_2 || '', 
  baseURL: 'https://api.groq.com/openai/v1' 
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function main() {
  const result = await pool.query<{ id: string; content: string }>('SELECT id, content FROM notes');
  const notes = result.rows;
  console.log(`Found ${notes.length} notes.`);

  for (const note of notes) {
    // Check if it already has line breaks, skip if it does to save time
    if (note.content.includes('\n\n') || note.content.includes('- ')) {
      console.log(`Skipping note ${note.id} (already formatted)`);
      continue;
    }

    console.log(`Formatting note ${note.id}...`);
    try {
      const response = await client.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at organizing messy text into beautiful, structured Markdown. Add line breaks, bullet points, headers, and bold text to make it extremely neat and readable. Do NOT summarize or remove any information, just format it. Return ONLY the formatted markdown text.'
          },
          {
            role: 'user',
            content: note.content
          }
        ]
      });

      const formatted = response.choices[0]?.message?.content?.trim();
      if (formatted) {
        await pool.query('UPDATE notes SET content = $1 WHERE id = $2', [formatted, note.id]);
        console.log(`-> Updated note ${note.id}`);
      }
    } catch (e) {
      console.error(`Failed to format note ${note.id}:`, e);
    }
  }
  
  await pool.end();
  console.log('Done!');
}

main().catch(console.error);
