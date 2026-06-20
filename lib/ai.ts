import OpenAI from 'openai';

interface AIProvider {
  client: OpenAI;
  model: string;
}

const providers: AIProvider[] = [
  // Groq
  {
    client: new OpenAI({ apiKey: process.env.GROQ_API_KEY_1 || '', baseURL: 'https://api.groq.com/openai/v1' }),
    model: 'llama-3.1-8b-instant'
  },
  {
    client: new OpenAI({ apiKey: process.env.GROQ_API_KEY_2 || '', baseURL: 'https://api.groq.com/openai/v1' }),
    model: 'llama-3.1-8b-instant'
  },
  {
    client: new OpenAI({ apiKey: process.env.GROQ_API_KEY_3 || '', baseURL: 'https://api.groq.com/openai/v1' }),
    model: 'llama-3.1-8b-instant'
  },
  {
    client: new OpenAI({ apiKey: process.env.GROQ_API_KEY_4 || '', baseURL: 'https://api.groq.com/openai/v1' }),
    model: 'llama-3.1-8b-instant'
  },
  // OpenRouter
  {
    client: new OpenAI({ 
      apiKey: process.env.OPENROUTER_API_KEY_1 || '', 
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: { 'HTTP-Referer': 'http://localhost:3000', 'X-Title': 'Recall AI' }
    }),
    model: 'meta-llama/llama-3.3-70b-instruct'
  },
  {
    client: new OpenAI({ 
      apiKey: process.env.OPENROUTER_API_KEY_2 || '', 
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: { 'HTTP-Referer': 'http://localhost:3000', 'X-Title': 'Recall AI' }
    }),
    model: 'meta-llama/llama-3.3-70b-instruct'
  },
  // DeepSeek
  {
    client: new OpenAI({ apiKey: process.env.DEEPSEEK_API_KEY || '', baseURL: 'https://api.deepseek.com' }),
    model: 'deepseek-chat'
  }
];

let providerIndex = 0;

function getNextProvider(): AIProvider {
  const provider = providers[providerIndex];
  providerIndex = (providerIndex + 1) % providers.length;
  return provider;
}

// ─── Types ──────────────────────────────────────────────────────────

export interface NoteMetadata {
  title: string;
  summary: string;
  tags: string[];
  key_concepts: string[];
}

export interface SearchResult {
  id: string;
  title: string;
  content: string;
  tags: string[];
  summary: string;
  similarity: number;
}

// ─── Auto-tagging & summarization ───────────────────────────────────

export async function analyzeNote(content: string): Promise<NoteMetadata> {
  const maxRetries = 3;
  let lastError = null;

  for (let i = 0; i < maxRetries; i++) {
    const provider = getNextProvider();
    try {
      const response = await provider.client.chat.completions.create({
        model: provider.model,
        max_tokens: 500,
        messages: [
          {
            role: 'user',
            content: `Analyze the following note and extract structured metadata. Return ONLY a valid JSON object with no markdown, no explanation.

Note content:
"""
${content}
"""

Return this exact JSON structure:
{
  "title": "A concise, descriptive title (max 10 words)",
  "summary": "One sentence summarizing the core idea (max 20 words)",
  "tags": ["tag1", "tag2", "tag3"],
  "key_concepts": ["concept1", "concept2", "concept3"]
}

Rules for tags: lowercase, max 20 chars each, 3-6 tags, topic-focused.
Rules for key_concepts: noun phrases, 3-5 concepts, the most important ideas.`,
          },
        ],
        response_format: { type: "json_object" },
      });

      const text = response.choices[0]?.message?.content || '{}';
      try {
        return JSON.parse(text.trim()) as NoteMetadata;
      } catch {
        return {
          title: content.slice(0, 60) + (content.length > 60 ? '...' : ''),
          summary: content.slice(0, 120),
          tags: [],
          key_concepts: [],
        };
      }
    } catch (error) {
      console.error(`Provider ${provider.model} failed:`, error);
      lastError = error;
    }
  }
  
  throw lastError;
}

// ─── Auto-splitting ──────────────────────────────────────────────────

export interface SplitNote {
  title: string;
  content: string;
  summary: string;
  tags: string[];
  key_concepts: string[];
}

export async function splitLargeNote(content: string): Promise<SplitNote[]> {
  const maxRetries = 3;
  let lastError = null;

  for (let i = 0; i < maxRetries; i++) {
    const provider = getNextProvider();
    try {
      const response = await provider.client.chat.completions.create({
        model: provider.model,
        max_tokens: 4000,
        messages: [
          {
            role: 'user',
            content: `You are an expert note organizer. The user has provided a very large note. Your task is to split it into logical sub-notes based on topics.
Preserve the original meaning and text as much as possible, just divided.

Original Note:
"""
${content}
"""

Return a valid JSON object containing an array of sub-notes under the key "notes". Do not include any markdown formatting or explanation outside the JSON.
Format:
{
  "notes": [
    {
      "title": "Concise title",
      "content": "The full text for this section",
      "summary": "One sentence summary",
      "tags": ["tag1", "tag2"],
      "key_concepts": ["concept1", "concept2"]
    }
  ]
}

Rules:
- Split into 2 to 5 logical sections.
- Tags must be lowercase, max 20 chars each.
- Key concepts must be noun phrases.
- The 'content' should contain the actual detailed text from the original note for that section.`,
          },
        ],
        response_format: { type: "json_object" },
      });

      const text = response.choices[0]?.message?.content || '{"notes":[]}';
      try {
        const parsed = JSON.parse(text.trim());
        return parsed.notes || [];
      } catch {
        console.error("Failed to parse split note JSON", text);
        return [];
      }
    } catch (error) {
      console.error(`Provider ${provider.model} failed in splitLargeNote:`, error);
      lastError = error;
    }
  }

  throw lastError;
}


// ─── RAG-based Q&A ──────────────────────────────────────────────────

export async function askWithContext(
  question: string,
  relevantNotes: SearchResult[]
): Promise<AsyncIterable<string>> {
  const context = relevantNotes
    .map((note, i) =>
      `[Source ${i + 1}: "${note.title}" (similarity: ${(note.similarity * 100).toFixed(0)}%)]\n${note.content}`
    )
    .join('\n\n---\n\n');

  const provider = getNextProvider();
  const stream = await provider.client.chat.completions.create({
    model: provider.model,
    max_tokens: 1024,
    stream: true,
    messages: [
      {
        role: 'system',
        content: `You are a knowledgeable assistant with access to the user's personal knowledge base.
Your job is to answer questions by synthesizing information from the provided notes.

Rules:
- Answer ONLY from the provided context. If the answer isn't there, say so clearly.
- Cite which source(s) you're drawing from using [Source N] notation.
- Be concise but complete. Prefer bullet points for multi-part answers.
- If sources conflict, note the conflict and give both perspectives.
- End with a "💡 Related:" line listing 1-2 follow-up questions the user might want to explore.`,
      },
      {
        role: 'user',
        content: `Here is my knowledge base context:\n\n${context}\n\n---\n\nQuestion: ${question}`,
      },
    ],
  });

  return (async function* () {
    for await (const chunk of stream) {
      if (chunk.choices[0]?.delta?.content) {
        yield chunk.choices[0].delta.content;
      }
    }
  })();
}

// ─── Connection discovery ────────────────────────────────────────────

export async function explainConnection(
  note1: { title: string; content: string },
  note2: { title: string; content: string },
  similarityScore: number
): Promise<string> {
  const provider = getNextProvider();
  const response = await provider.client.chat.completions.create({
    model: provider.model,
    max_tokens: 150,
    messages: [
      {
        role: 'user',
        content: `Two notes in a knowledge base are ${(similarityScore * 100).toFixed(0)}% semantically similar. Explain the connection in one sentence (max 25 words), starting with a relevant emoji.

Note 1: "${note1.title}"
${note1.content.slice(0, 300)}

Note 2: "${note2.title}"
${note2.content.slice(0, 300)}

Connection explanation (one sentence, start with emoji):`,
      },
    ],
  });

  return response.choices[0]?.message?.content?.trim() || 'These notes share related concepts and ideas.';
}

// ─── Proactive insight generation ───────────────────────────────────

export async function generateKnowledgeInsights(
  noteSummaries: Array<{ title: string; tags: string[] }>
): Promise<string> {
  const noteList = noteSummaries
    .map((n) => `- "${n.title}" [${n.tags.join(', ')}]`)
    .join('\n');

  const provider = getNextProvider();
  const response = await provider.client.chat.completions.create({
    model: provider.model,
    max_tokens: 400,
    messages: [
      {
        role: 'user',
        content: `Analyze this knowledge base and give 3 actionable insights in bullet points. Focus on: recurring themes, knowledge gaps, and surprising connections.

Notes:
${noteList}

Return exactly 3 bullet points starting with an emoji:`,
      },
    ],
  });

  return response.choices[0]?.message?.content?.trim() || '• Keep adding notes to unlock insights!';
}
