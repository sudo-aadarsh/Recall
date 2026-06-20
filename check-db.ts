import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const res = await pool.query("SELECT content FROM notes WHERE title = 'Methodology and Technology Used' LIMIT 1");
  console.log(res.rows[0].content);
  process.exit(0);
}
run();
