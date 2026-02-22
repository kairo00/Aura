const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'discord.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    avatar_color TEXT NOT NULL DEFAULT '#5865f2',
    avatar_url TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS servers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    icon TEXT,
    owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS server_members (
    server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'Member',
    PRIMARY KEY (server_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS channels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'text'
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    attachment_url TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS dm_threads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user1_id INTEGER NOT NULL REFERENCES users(id),
    user2_id INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user1_id, user2_id)
  );

  CREATE TABLE IF NOT EXISTS dm_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    thread_id INTEGER NOT NULL REFERENCES dm_threads(id) ON DELETE CASCADE,
    sender_id INTEGER NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    attachment_url TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS invites (
    code TEXT PRIMARY KEY,
    server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    created_by INTEGER NOT NULL REFERENCES users(id),
    uses INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS server_roles (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id   INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    color       TEXT NOT NULL DEFAULT '#99aab5',
    position    INTEGER NOT NULL DEFAULT 0,
    can_manage_messages INTEGER NOT NULL DEFAULT 0,
    can_kick_members    INTEGER NOT NULL DEFAULT 0,
    can_ban_members     INTEGER NOT NULL DEFAULT 0,
    can_manage_roles    INTEGER NOT NULL DEFAULT 0,
    can_manage_channels INTEGER NOT NULL DEFAULT 0,
    UNIQUE(server_id, name)
  );

  CREATE TABLE IF NOT EXISTS server_bans (
    server_id   INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    banned_by   INTEGER NOT NULL REFERENCES users(id),
    reason      TEXT,
    banned_at   TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (server_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS reactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji TEXT NOT NULL,
    UNIQUE(message_id, user_id, emoji)
  );

  CREATE TABLE IF NOT EXISTS dm_reactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dm_message_id INTEGER NOT NULL REFERENCES dm_messages(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji TEXT NOT NULL,
    UNIQUE(dm_message_id, user_id, emoji)
  );
`);

// Runtime migrations (safe to re-run)
try { db.exec('ALTER TABLE server_members ADD COLUMN role TEXT DEFAULT "Member"'); } catch (_) { }
try { db.exec('ALTER TABLE messages ADD COLUMN attachment_url TEXT'); } catch (_) { }
try { db.exec('ALTER TABLE dm_messages ADD COLUMN attachment_url TEXT'); } catch (_) { }
// Phase 2 migrations
try { db.exec('ALTER TABLE users ADD COLUMN is_superadmin INTEGER NOT NULL DEFAULT 0'); } catch (_) { }
try { db.exec('ALTER TABLE server_members ADD COLUMN role_id INTEGER REFERENCES server_roles(id) ON DELETE SET NULL'); } catch (_) { }

module.exports = db;
