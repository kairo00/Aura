const fs = require('fs');
const path = require('path');
const db = require('./db');

// Let's directly test the UPDATE query inside the backend environment to see if better-sqlite3 is failing
try {
    const userId = 6;
    const testUrl = '/uploads/test_upload_script.jpg';
    console.log("Before:", db.prepare('SELECT avatar_url FROM users WHERE id = ?').get(userId));
    db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(testUrl, userId);
    console.log("After:", db.prepare('SELECT avatar_url FROM users WHERE id = ?').get(userId));
} catch(e) { console.error(e) }
