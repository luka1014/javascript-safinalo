const express = require('express');
const router  = express.Router();
const db      = require('../database');

function parsePositiveInt(value, fallback = null) {
  const n = parseInt(String(value), 10);
  if (Number.isNaN(n) || n < 1) return fallback;
  return n;
}

function validateEventBody(body) {
  const { title, date, capacity } = body;

  if (!title || !String(title).trim()) {
    return { error: 'სათაური სავალდებულოა' };
  }
  if (!date || !String(date).trim()) {
    return { error: 'თარიღი სავალდებულოა' };
  }
  if (parsePositiveInt(capacity) === null) {
    return { error: 'ტევადობა უნდა იყოს მთელი რიცხვი მინიმუმ 1' };
  }

  return null;
}


router.get('/', (req, res) => {
  const { search, category, sort, when } = req.query;

  let query = `
    SELECT e.*,
      (SELECT COUNT(*) FROM registrations r WHERE r.eventId = e.id) AS registeredCount
    FROM events e
    WHERE 1=1
  `;
  const params = [];

  if (search) {
    query += ' AND e.title LIKE ?';
    params.push(`%${search}%`);
  }

  if (category) {
    query += ' AND e.category = ?';
    params.push(category);
  }

  if (when === 'upcoming') {
    query += ` AND e.date >= date('now')`;
  } else if (when === 'past') {
    query += ` AND e.date < date('now')`;
  }

  if (sort === 'asc') {
    query += ' ORDER BY e.date ASC, e.time ASC';
  } else if (sort === 'desc') {
    query += ' ORDER BY e.date DESC, e.time DESC';
  } else {
    query += ' ORDER BY e.date ASC, e.time ASC';
  }

  const rows = db.prepare(query).all(...params);
  const events = rows.map((e) => ({
    ...e,
    registeredCount: e.registeredCount,
    spotsLeft: Math.max(0, Number(e.capacity || 0) - Number(e.registeredCount || 0)),
  }));

  res.json(events);
});

// GET /api/events/:id
router.get('/:id', (req, res) => {
  const event = db.prepare(
    'SELECT * FROM events WHERE id = ?'
  ).get(req.params.id);

  if (!event) {
    return res.status(404).json({ error: 'ღონისძიება ვერ მოიძებნა' });
  }

  const regCount = db.prepare(
    'SELECT COUNT(*) as total FROM registrations WHERE eventId = ?'
  ).get(req.params.id);

  event.registeredCount = regCount.total;
  event.spotsLeft = Math.max(0, event.capacity - regCount.total);

  res.json(event);
});


// POST /api/events

router.post('/', (req, res) => {
  const err = validateEventBody(req.body);
  if (err) {
    return res.status(400).json(err);
  }

  const { title, description, date, time, location, category, capacity } = req.body;
  const cap = parsePositiveInt(capacity);

  const result = db.prepare(`
    INSERT INTO events (title, description, date, time, location, category, capacity)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    String(title).trim(),
    description != null ? String(description).trim() : '',
    String(date).trim(),
    time != null ? String(time).trim() : '',
    location != null ? String(location).trim() : '',
    category != null ? String(category).trim() : '',
    cap
  );

  res.status(201).json({
    success : true,
    message : 'ღონისძიება დაემატა',
    id      : result.lastInsertRowid,
  });
});


// PUT /api/events/:id

router.put('/:id', (req, res) => {
  const err = validateEventBody(req.body);
  if (err) {
    return res.status(400).json(err);
  }

  const { title, description, date, time, location, category, capacity } = req.body;
  const cap = parsePositiveInt(capacity);

  const event = db.prepare(
    'SELECT * FROM events WHERE id = ?'
  ).get(req.params.id);

  if (!event) {
    return res.status(404).json({ error: 'ღონისძიება ვერ მოიძებნა' });
  }

  const regCount = db.prepare(
    'SELECT COUNT(*) as total FROM registrations WHERE eventId = ?'
  ).get(req.params.id);

  if (cap < regCount.total) {
    return res.status(400).json({
      error: 'ტევადობა ვერ იქნება ნაკლები უკვე დარეგისტრირებული მონაწილეების რაოდენობაზე',
    });
  }

  db.prepare(`
    UPDATE events
    SET title=?, description=?, date=?, time=?, location=?, category=?, capacity=?
    WHERE id=?
  `).run(
    String(title).trim(),
    description != null ? String(description).trim() : '',
    String(date).trim(),
    time != null ? String(time).trim() : '',
    location != null ? String(location).trim() : '',
    category != null ? String(category).trim() : '',
    cap,
    req.params.id
  );

  res.json({ success: true, message: 'ღონისძიება განახლდა' });
});

// DELETE /api/events/:id
router.delete('/:id', (req, res) => {
  const event = db.prepare(
    'SELECT * FROM events WHERE id = ?'
  ).get(req.params.id);

  if (!event) {
    return res.status(404).json({ error: 'ღონისძიება ვერ მოიძებნა' });
  }

  db.prepare(
    'DELETE FROM registrations WHERE eventId = ?'
  ).run(req.params.id);

  db.prepare(
    'DELETE FROM events WHERE id = ?'
  ).run(req.params.id);

  res.json({ success: true, message: 'ღონისძიება წაიშალა' });
});

module.exports = router;
