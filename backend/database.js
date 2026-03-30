const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const dbPath = path.join(__dirname, 'events.db');
const db = new DatabaseSync(dbPath);

db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT    NOT NULL,
    description TEXT,
    date        TEXT,
    time        TEXT,
    location    TEXT,
    category    TEXT,
    capacity    INTEGER,
    createdAt   TEXT    DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS registrations (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    eventId   INTEGER NOT NULL,
    fullName  TEXT    NOT NULL,
    email     TEXT    NOT NULL,
    phone     TEXT,
    createdAt TEXT    DEFAULT (datetime('now')),
    FOREIGN KEY (eventId) REFERENCES events(id)
  );

  DROP INDEX IF EXISTS idx_registrations_event_email;
  CREATE UNIQUE INDEX IF NOT EXISTS idx_registrations_event_email
    ON registrations (eventId, lower(email));
`);

module.exports = db;
