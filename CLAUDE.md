# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A couple's memory/diary web app (情侣回忆应用) with an admin backend. Built with Express.js serving static HTML/JS/CSS frontend pages. All text and UI is in Chinese (zh-CN).

## Commands

- **Run dev server:** `npm run dev` (uses nodemon, auto-restarts on changes)
- **Run production:** `npm start` (plain `node server.js`)
- **Install dependencies:** `npm install`
- **Migrate JSON data to SQLite:** `node scripts/migrate.js`
- **Migrate mood notes from JSON:** `node scripts/migrate-notes.js`
- **Deploy to production:** `bash scripts/deploy.sh` (one-click deploy, runs npm install + PM2 restart)

No test framework or linter is configured.

## Architecture

### Backend

**Entry point:** `server.js` — Express app setup, middleware, route mounting, static file serving.

**Modular routes** in `routes/`:
- `auth.js` — JWT registration, login, logout, `/api/auth/me`, `/api/auth/setup`
- `admin.js` — Admin login (bcrypt), password change
- `memories.js` — Memory CRUD + comments + visibility + date query
- `photos.js` — Photo upload (single + batch with thumbnails), CRUD, comments
- `messages.js` — Private messages ("悄悄话") CRUD + blur toggle
- `moods.js` — Daily mood entries with optional image uploads
- `anniversaries.js` — Anniversary/countdown CRUD + upcoming calculation
- `couple-tasks.js` — Couple task management with status tracking
- `wishes.js` — Wish list with completion toggle
- `daily-questions.js` — Daily Q&A between partners
- `locations.js` — Footprint/location CRUD for the map view
- `backup.js` — Admin data backup/export
- `timeline.js` — Mixed timeline view (memories + photos + messages)

**Utilities** in `utils/`:
- `db.js` — SQLite database (better-sqlite3) initialization, all CREATE TABLE statements
- `data.js` — Legacy JSON file read/write helpers (for backward compatibility)
- `upload.js` — Multer config, sharp thumbnail generation, file deletion

**Middleware** in `middleware/`:
- `auth.js` — JWT authentication (`authenticateUser`, `authenticateAdmin`, `optionalAuth`, `signToken`)

### Data Storage

**Primary:** SQLite database at `data/app.db` (WAL mode enabled). Tables: users, memories, photos, messages, comments (polymorphic), daily_moods, anniversaries, tasks, wishes, daily_questions, locations.

**File uploads:** Images in `uploads/`, thumbnails in `uploads/thumbnails/`. Max 50MB, UUID filenames, `thumbnail-` prefix for thumbnails (200x200 via sharp).

**Migration:** `scripts/migrate.js` migrates from legacy JSON files to SQLite. JSON files in `data/` are kept as backup.

### Authentication

- JWT tokens stored in httpOnly cookies
- Users: `his` and `her` (two partner accounts) + `admin`
- First-time setup via `/api/auth/setup` (creates both accounts)
- Login page at `/login` (`public/login.html`)
- Passwords hashed with bcrypt (cost 10)
- `authenticateUser` middleware on all write endpoints; `optionalAuth` on reads
- Backward compatible: falls back to `?user=his/her` URL params if no JWT cookie

### Frontend

Static files in `public/`, served via Express. No build step or bundler.
- `login.html` — Authentication page (his/her selection + password)
- `index.html` / `index.js` / `styles.css` — Main app (memories, photos, messages)
- `admin.html` — Admin panel (password-protected)
- `calendar.html` / `calendar.js` — Daily mood calendar
- `timeline.html` — Timeline view of all content
- `game1.html`, `game2.html`, `game3.html` — Mini games (self-contained)

- `map.html` — Footprint map (Leaflet + AMap tiles)

**Stack:** Tailwind CSS (CDN), Font Awesome icons, Google Fonts (Inter + Dancing Script). Vanilla JS.

**PWA:** Service worker (`sw.js`) + `manifest.json` for offline caching and home screen install.

## Conventions

- Entity IDs: `Date.now()` for memories/messages, `uuid` for photos
- Author field: `'his'` / `'her'`
- API responses: `{ success: boolean, data?, message? }`
- SQLite columns use snake_case; API responses map to camelCase where needed (e.g. `thumbnail_url` → `thumbnailUrl`, `should_blur` → `shouldBlur`)
- Port configurable via `PORT` env var, defaults to 3000
- JWT secret via `JWT_SECRET` env var, has a default for dev (change in production)
- Comments table is polymorphic: `entity_type` ('memory'|'photo') + `entity_id`
- All fetch calls include `credentials: 'include'` for cookie-based auth
