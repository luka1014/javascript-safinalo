const express = require('express');
const router  = express.Router();
const db      = require('../database');

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

// POST /api/events/:id/register
router.post('/:id/register', (req, res) => {
  const eventId = req.params.id;
  const { fullName, phone } = req.body;
  const emailRaw = req.body.email;
  const email = normalizeEmail(emailRaw);

  if (!fullName || !String(fullName).trim() || !email || !phone || !String(phone).trim()) {
    return res.status(400).json({
      error: 'სახელი, ელ-ფოსტა და ტელეფონი სავალდებულოა',
    });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      error: 'ელ-ფოსტის ფორმატი არასწორია',
    });
  }

  const event = db.prepare(
    'SELECT * FROM events WHERE id = ?'
  ).get(eventId);

  if (!event) {
    return res.status(404).json({
      error: 'ღონისძიება ვერ მოიძებნა',
    });
  }

  const regCount = db.prepare(
    'SELECT COUNT(*) as total FROM registrations WHERE eventId = ?'
  ).get(eventId);

  if (regCount.total >= event.capacity) {
    return res.status(409).json({
      error: 'capacity_full',
      message: 'ადგილები სავსეა, რეგისტრაცია შეუძლებელია',
    });
  }

  const duplicate = db.prepare(
    'SELECT * FROM registrations WHERE eventId = ? AND lower(email) = ?'
  ).get(eventId, email);

  if (duplicate) {
    return res.status(409).json({
      error: 'duplicate_email',
      message: 'ეს ელ-ფოსტა უკვე დარეგისტრირებულია ამ ღონისძიებაზე',
    });
  }

  let result;
  try {
    result = db.prepare(`
      INSERT INTO registrations (eventId, fullName, email, phone)
      VALUES     (?,            ?,        ?,     ?)
    `).run(eventId, String(fullName).trim(), email, String(phone).trim());
  } catch (e) {
    const msg = e && e.message ? String(e.message) : '';
    const unique =
      (e && e.code === 'SQLITE_CONSTRAINT_UNIQUE') ||
      msg.includes('UNIQUE constraint');
    if (unique) {
      return res.status(409).json({
        error: 'duplicate_email',
        message: 'ეს ელ-ფოსტა უკვე დარეგისტრირებულია ამ ღონისძიებაზე',
      });
    }
    throw e;
  }

  const confirmationCode = `REG-${result.lastInsertRowid}-${Math.floor(Math.random() * 9000 + 1000)}`;

  res.status(201).json({
    success          : true,
    message          : 'წარმატებით დარეგისტრირდით!',
    confirmationCode : confirmationCode,
    registrationId   : result.lastInsertRowid,
  });
});

// GET /api/events/:id/attendees
router.get('/:id/attendees', (req, res) => {
  const event = db.prepare(
    'SELECT * FROM events WHERE id = ?'
  ).get(req.params.id);

  if (!event) {
    return res.status(404).json({ error: 'ღონისძიება ვერ მოიძებნა' });
  }

  const attendees = db.prepare(
    'SELECT * FROM registrations WHERE eventId = ? ORDER BY createdAt DESC'
  ).all(req.params.id);

  res.json({
    event     : event,
    total     : attendees.length,
    spotsLeft : Math.max(0, event.capacity - attendees.length),
    attendees : attendees,
  });
});

module.exports = router;
