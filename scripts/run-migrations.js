const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  connectionString: 'postgresql://postgres.ppscjntzzhkdhyvwxufc:Aadarsh%40123456789@aws-1-ap-south-1.pooler.supabase.com:5432/postgres'
});

async function run() {
  try {
    console.log("Running schema.sql...");
    const schema = fs.readFileSync('schema.sql', 'utf8');
    await pool.query(schema);
    console.log("schema.sql executed successfully.");

    console.log("Running schema_auth.sql...");
    const schemaAuth = fs.readFileSync('schema_auth.sql', 'utf8');
    await pool.query(schemaAuth);
    console.log("schema_auth.sql executed successfully.");
    
    // Also create a test user since they are trying to login
    const bcrypt = require('bcrypt');
    const hash = await bcrypt.hash('password123', 10);
    await pool.query('INSERT INTO users (name, email, password) VALUES ($1, $2, $3) ON CONFLICT (email) DO NOTHING', ['Test User', 'test@example.com', hash]);
    console.log("Created test user: test@example.com / password123");

    process.exit(0);
  } catch (e) {
    console.error("Error:", e);
    process.exit(1);
  }
}
run();
