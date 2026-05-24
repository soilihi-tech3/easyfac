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
    
    // Add column userId to factures table
    const [factureCols] = await connection.query('SHOW COLUMNS FROM factures');
    const factureColNames = factureCols.map(c => c.Field);

    if (!factureColNames.includes('userId')) {
      console.log('Adding userId column to factures table...');
      await connection.query('ALTER TABLE factures ADD COLUMN userId VARCHAR(255) DEFAULT NULL');
      console.log('userId column added to factures successfully.');
    } else {
      console.log('userId column already exists in factures.');
    }

    // Add column userId to depenses table
    const [depenseCols] = await connection.query('SHOW COLUMNS FROM depenses');
    const depenseColNames = depenseCols.map(c => c.Field);

    if (!depenseColNames.includes('userId')) {
      console.log('Adding userId column to depenses table...');
      await connection.query('ALTER TABLE depenses ADD COLUMN userId VARCHAR(255) DEFAULT NULL');
      console.log('userId column added to depenses successfully.');
    } else {
      console.log('userId column already exists in depenses.');
    }

    console.log('Database patched successfully for audit tracking!');
  } catch (err) {
    console.error('Error patching database:', err);
  } finally {
    await connection.end();
  }
}

run();
