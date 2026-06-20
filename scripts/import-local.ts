import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../lib/db';
const SCRIPT_WORKSPACE_ID = '00000000-0000-0000-0000-000000000001';
import { analyzeNote, splitLargeNote } from '../lib/ai';
import { generateEmbedding, formatNoteForEmbedding, toVectorString } from '../lib/embeddings';

// Helper to hash file content to detect exact local duplicates
function hashContent(content: string) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

async function scanDirectory(dir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await scanDirectory(fullPath));
    } else if (entry.isFile() && (entry.name.endsWith('.md') || entry.name.endsWith('.txt'))) {
      files.push(fullPath);
    }
  }
  return files;
}

async function run() {
  const targetDir = process.argv[2];
  if (!targetDir) {
    console.error('Usage: npx tsx scripts/import-local.ts <path-to-directory>');
    process.exit(1);
  }

  console.log(`\n🔍 Scanning directory: ${targetDir}`);
  const files = await scanDirectory(targetDir);
  console.log(`Found ${files.length} markdown/text files.\n`);

  const seenHashes = new Set<string>();

  for (const file of files) {
    console.log(`Processing: ${file}`);
    const content = fs.readFileSync(file, 'utf-8').trim();
    if (!content) continue;

    const hash = hashContent(content);
    if (seenHashes.has(hash)) {
      console.log(`⏭️  Skipping exact duplicate: ${path.basename(file)}`);
      continue;
    }
    seenHashes.add(hash);

    try {
      if (content.length > 5000) {
        console.log(`✂️  Large file detected (${content.length} chars). Splitting via AI...`);
        const splits = await splitLargeNote(content);
        if (splits.length > 0) {
          const groupTag = `import-${Date.now().toString().slice(-6)}`;
          for (let i = 0; i < splits.length; i++) {
            const split = splits[i];
            const splitTitle = split.title || `${path.basename(file)} (Part ${i + 1})`;
            const splitTags = [...(split.tags || []), groupTag];

            console.log(`  - Saving chunk: ${splitTitle}`);
            const embedding = await generateEmbedding(formatNoteForEmbedding(splitTitle, split.content));
            const vectorStr = toVectorString(embedding);
            
            await query(
              `INSERT INTO notes (id, workspace_id, title, content, summary, tags, key_concepts, embedding, source)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8::vector, 'local-import')`,
              [uuidv4(), SCRIPT_WORKSPACE_ID, splitTitle, split.content, split.summary, splitTags, split.key_concepts || [], vectorStr]
            );
          }
        }
      } else {
        // Normal processing
        const [aiMetadata, embedding] = await Promise.all([
          analyzeNote(content),
          generateEmbedding(formatNoteForEmbedding(path.basename(file), content)),
        ]);
        
        const title = aiMetadata.title || path.basename(file);
        console.log(`✅ Saving: ${title}`);
        const vectorStr = toVectorString(embedding);

        await query(
          `INSERT INTO notes (id, workspace_id, title, content, summary, tags, key_concepts, embedding, source)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8::vector, 'local-import')`,
          [uuidv4(), SCRIPT_WORKSPACE_ID, title, content, aiMetadata.summary, aiMetadata.tags, aiMetadata.key_concepts, vectorStr]
        );
      }
    } catch (e) {
      console.error(`❌ Failed to process ${file}:`, e);
    }
  }

  console.log('\n🎉 Import complete!');
  process.exit(0);
}

run().catch(console.error);
