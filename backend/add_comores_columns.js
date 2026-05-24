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
    
    // Add columns payerComores and montantComores to factures table
    const [columns] = await connection.query('SHOW COLUMNS FROM factures');
    const columnNames = columns.map(c => c.Field);

    if (!columnNames.includes('payerComores')) {
      console.log('Adding payerComores column to factures table...');
      await connection.query('ALTER TABLE factures ADD COLUMN payerComores TINYINT DEFAULT 0');
      console.log('payerComores column added successfully.');
    } else {
      console.log('payerComores column already exists.');
    }

    if (!columnNames.includes('montantComores')) {
      console.log('Adding montantComores column to factures table...');
      await connection.query('ALTER TABLE factures ADD COLUMN montantComores DECIMAL(15, 2) DEFAULT 0');
      console.log('montantComores column added successfully.');
    } else {
      console.log('montantComores column already exists.');
    }

    console.log('Database patched successfully!');
  } catch (err) {
    console.error('Error patching database:', err);
  } finally {
    await connection.end();
  }
}

run();
