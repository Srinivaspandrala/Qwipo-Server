const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'customers_1.db');

const initDatabase = () => {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Error opening database:', err);
        reject(err);
      } else {
        console.log('Connected to SQLite database');
        
        // Create customers table
        db.run(`CREATE TABLE IF NOT EXISTS customers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          first_name TEXT NOT NULL,
          last_name TEXT NOT NULL,
          phone_number  Number NOT NULL,
          city TEXT
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
          if (err) {
            console.error('Error creating customers table:', err);
            reject(err);
          }
        });
        
        // Create addresses table
        db.run(`CREATE TABLE IF NOT EXISTS addresses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          customer_id INTEGER NOT NULL,
          address_details TEXT NOT NULL,
          city TEXT NOT NULL,
          state TEXT NOT NULL,
          pin_code TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE
        )`, (err) => {
          if (err) {
            console.error('Error creating addresses table:', err);
            reject(err);
          } else {
            console.log('Database initialized successfully');
            resolve();
          }
        });
        
        db.close();
      }
    });
  });
};

module.exports = { initDatabase };