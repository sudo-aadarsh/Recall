import { pool } from './lib/db';
async function run() {
  const res = await pool.query("SELECT formatted_content FROM notes WHERE title = 'Methodology and Technology Used' LIMIT 1");
  console.log(res.rows[0].formatted_content);
  process.exit(0);
}
run();
