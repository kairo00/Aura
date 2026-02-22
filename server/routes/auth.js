const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET;
const COLORS = ['#5865f2', '#3ba55c', '#faa61a', '#ed4245', '#9b59b6', '#1abc9c', '#e91e63', '#ff5722'];
const randColor = () => COLORS[Math.floor(Math.random() * COLORS.length)];

router.post('/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    if (username.length < 2) return res.status(400).json({ error: 'Username too short' });
    if (password.length < 4) return res.status(400).json({ error: 'Password too short (min 4 chars)' });

    try {
        const hash = await bcrypt.hash(password, 10);
        const stmt = db.prepare('INSERT INTO users (username, password, avatar_color) VALUES (?, ?, ?)');
        const result = stmt.run(username, hash, randColor());
        const user = db.prepare('SELECT id, username, avatar_color, avatar_url FROM users WHERE id = ?').get(result.lastInsertRowid);
        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user });
    } catch (e) {
        if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Username already taken' });
        res.status(500).json({ error: e.message });
    }
});

router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const safeUser = { id: user.id, username: user.username, avatar_color: user.avatar_color, avatar_url: user.avatar_url, is_superadmin: user.is_superadmin };
    const token = jwt.sign({ id: user.id, username: user.username, is_superadmin: user.is_superadmin }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: safeUser });
});

module.exports = router;
