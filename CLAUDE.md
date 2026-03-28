# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A couple's memory/diary web app (情侣回忆应用) with an admin backend. Built with Express.js serving static HTML/JS/CSS frontend pages. All text and UI is in Chinese (zh-CN).

## Commands

- **Run dev server:** `npm run dev` (uses nodemon, auto-restarts on changes)
- **Run production:** `npm start` (plain `node server.js`)
- **Install dependencies:** `npm install`

No test framework or linter is configured.

## Architecture

**Single-file backend:** `server.js` contains the entire Express API server — all routes, middleware, file upload handling (multer + sharp for thumbnails), and JSON file-based data persistence.

**Data storage:** JSON files in `data/` directory (gitignored). Data files: `memories.json`, `photos.json`, `messages.json`, `admin.json`, `comments.json`, `daily-moods.json`. Read/write via `readData()`/`writeData()` helper functions.

**File uploads:** Images stored in `uploads/` with thumbnails in `uploads/thumbnails/`. Max 50MB per file. Allowed types: JPEG, PNG, GIF, WebP.

**Frontend:** Static files in `public/`, served directly by Express. No build step or bundler.
- `index.html` / `index.js` / `styles.css` — Main couple-facing app (memories, photos, messages)
- `admin.html` — Admin panel (password-protected, default password in `admin.json`)
- `calendar.html` / `calendar.js` — Daily mood calendar feature
- `game1.html`, `game2.html`, `game3.html` — Mini games

**Key API resource groups:**
- `/api/memories` — Memory entries (CRUD + comments + visibility toggle)
- `/api/photos` — Photo uploads with thumbnails (single + batch upload, CRUD, comments)
- `/api/messages` — Private messages ("悄悄话")
- `/api/daily-moods` — Daily mood entries with optional image uploads
- `/api/admin` — Login and password management
- `*-query` endpoints — Date-filtered queries for memories, photos, messages

**Frontend stack:** Tailwind CSS (via CDN), Font Awesome icons, Google Fonts (Inter + Dancing Script). No framework — vanilla JS with inline Tailwind config.

## Conventions

- Entity IDs use `Date.now()` for memories/messages, `uuid` for photos
- Author field uses `'his'` / `'her'` to distinguish the two users
- All API responses follow `{ success: boolean, ... }` pattern (with some inconsistency in older routes)
- Port configurable via `PORT` env var, defaults to 3000
