import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  const sql = fs.readFileSync(path.join(__dirname, '../schema_auth.sql'), 'utf-8');
  console.log('Running auth schema...');
  await pool.query(sql);
  console.log('Auth tables created successfully.');
  process.exit(0);
}

main().catch(console.error);
