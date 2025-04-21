const fs = require('fs');
const path = require('path');

// Path to the database file
const dbPath = path.join(__dirname, 'database.db');

// Check if the database file exists
if (fs.existsSync(dbPath)) {
  console.log('Existing database found. Deleting...');
  
  try {
    // Delete the existing database file
    fs.unlinkSync(dbPath);
    console.log('Database deleted successfully.');
  } catch (err) {
    console.error('Error deleting database:', err.message);
    process.exit(1);
  }
}

console.log('Database reset complete. Restart the server to create a new database with the default admin user.');
console.log('Default login credentials:');
console.log('Username: admin');
console.log('Password: admin123');

// Note: The database will be recreated when you start the server 