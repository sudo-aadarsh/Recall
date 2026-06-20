const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('ALTER TABLE notes ADD COLUMN IF NOT EXISTS formatted_content TEXT').then(() => {
  console.log('done');
  process.exit(0);
}).catch(e => {
  console.error(e);
  process.exit(1);
});
