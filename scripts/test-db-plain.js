const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});
pool.query('SELECT NOW()').then(res => {
  console.log("Success:", res.rows);
  process.exit(0);
}).catch(err => {
  console.error("Failed:", err);
  process.exit(1);
});
