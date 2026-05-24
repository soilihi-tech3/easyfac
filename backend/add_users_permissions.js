const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'easyfac_db'
  });

  try {
    console.log('Checking database tables...');
    
    // Add columns permissions to users table
    const [columns] = await connection.query('SHOW COLUMNS FROM users');
    const columnNames = columns.map(c => c.Field);

    if (!columnNames.includes('permissions')) {
      console.log('Adding permissions column to users table...');
      await connection.query('ALTER TABLE users ADD COLUMN permissions TEXT DEFAULT NULL');
      console.log('permissions column added successfully.');
    } else {
      console.log('permissions column already exists.');
    }

    console.log('Database patched successfully for users permissions!');
  } catch (err) {
    console.error('Error patching database:', err);
  } finally {
    await connection.end();
  }
}

run();
