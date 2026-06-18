# Attendance Tracker

## Project Overview

Web-based attendance tracking application with photo compression, GPS location capture, and admin dashboard.

## Tech Stack

- **Frontend:** HTML, Tailwind CSS (CDN), Vanilla JavaScript
- **Backend:** Node.js, Express.js
- **Database:** Neon (PostgreSQL)
- **Auth:** Mobile number + 6-digit PIN with server-side sessions

## Project Structure

```
├── public/
│   ├── css/styles.css          # Custom styles
│   ├── js/
│   │   ├── app.js              # Main SPA logic (login, camera, attendance, admin)
│   │   └── compression.js      # Client-side photo compression module
│   └── views/index.html        # Single-page application
├── src/
│   ├── server.js               # Express server (Helmet, rate limiting, sessions)
│   ├── db.js                   # PostgreSQL connection, schema migration, seed data
│   └── routes.js               # API routes (auth, attendance, admin)
├── .env.example                # Environment variable template
├── package.json
└── CLAUDE.md
```

## Setup

```bash
cp .env.example .env
# Set DATABASE_URL to your Neon PostgreSQL connection string
npm install
npm start
```

## Environment Variables

- `DATABASE_URL` — Neon PostgreSQL connection string (required)
- `SESSION_SECRET` — Express session secret
- `PORT` — Server port (default: 3000)
- `ADMIN_MOBILE` — Admin login mobile number
- `ADMIN_PIN` — Admin login PIN

## Key Design Decisions

- **Client-side photo compression:** Photos are resized to 640x480 and compressed to JPEG <200KB before upload (see `public/js/compression.js`). Server rejects photos >500KB.
- **Single-page app:** No framework — all routing is handled via DOM show/hide in `public/js/app.js`.
- **Session auth:** Simple express-session, no JWT. Suitable for internal company use.
- **Auto-migration:** Database tables are created automatically on first run in `src/db.js`.
- **Sample data:** 6 employees are seeded on first run if the employees table is empty.

## API Endpoints

| Method | Endpoint                  | Auth     | Description                  |
|--------|---------------------------|----------|------------------------------|
| POST   | /api/login                | None     | Employee/admin login         |
| POST   | /api/logout               | Any      | End session                  |
| GET    | /api/session              | Any      | Check auth status            |
| POST   | /api/attendance           | Employee | Record check-in/check-out    |
| GET    | /api/attendance/today     | Employee | Today's summary              |
| GET    | /api/admin/employees      | Admin    | List all employees           |
| GET    | /api/admin/employee/:id   | Admin    | Employee monthly detail      |
| POST   | /api/admin/employee       | Admin    | Add new employee             |

## Common Tasks

- **Add a new API route:** Edit `src/routes.js`, use `requireAuth` or `requireAdmin` middleware.
- **Change compression settings:** Edit constants at top of `public/js/compression.js`.
- **Modify UI:** Edit `public/views/index.html` (structure) and `public/js/app.js` (behavior).
- **Change DB schema:** Edit `initializeDatabase()` in `src/db.js`.

## Testing Credentials

- **Admin:** Mobile `9999999999`, PIN `123456`
- **Sample employee:** Mobile `9876543210`, PIN `111111`
