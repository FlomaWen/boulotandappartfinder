# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BoulotAndAppartFinder is a French apartment and job search aggregator. It scrapes listings from multiple sources (LeBonCoin, SeLoger for apartments; HelloWork, Meteojob, Welcome to the Jungle for jobs), stores them in a local SQLite database, and displays them in an Angular frontend.

## Repository Structure

The actual application lives in `boulotandappartfinder/` (nested directory). There are two separate npm projects:

- **Frontend** (`boulotandappartfinder/`): Angular 21 app with SCSS, standalone components, Vitest for tests
- **Backend** (`boulotandappartfinder/backend/`): Express + TypeScript API with better-sqlite3, Puppeteer/Cheerio scrapers

## Commands

### Frontend (run from `boulotandappartfinder/`)
```bash
npm start          # dev server on http://localhost:4200
npm run build      # production build to dist/
npm test           # run tests (Vitest via Angular CLI)
```

### Backend (run from `boulotandappartfinder/backend/`)
```bash
npm run dev        # dev server with tsx watch on http://localhost:3000
npm run build      # compile TypeScript to dist/
npm start          # run compiled JS
```

## Architecture

### Backend API
- Express server on port 3000, CORS configured for localhost:4200
- SQLite database at `backend/data/app.db` (auto-created, WAL mode)
- Two domain entities: **Apartment** and **Job**, each with CRUD routes + status workflow
- Scrapers in `backend/src/scrapers/` — apartment scrapers use Puppeteer (headless browser), job scrapers mix Puppeteer and Cheerio (static HTML)
- Scraping triggered via `POST /api/scrape/apartments` and `POST /api/scrape/jobs`

### Frontend
- Angular 21 standalone components (no NgModules)
- Pages: Home (`/`), ApartmentSearch (`/appartements`), JobSearch (`/emplois`)
- Services call backend API at `http://localhost:3000/api`
- SCSS for styling, Prettier configured (single quotes, 100 char width, Angular HTML parser)

### Domain Status Workflows
- Apartments: `nouveau` → `contacte` → `visite` → `supprime`
- Jobs: `nouveau` → `postule` → `entretien` → `supprime`

## Development Approach

This project follows **TDD (Test-Driven Development)**: write tests first, then implement features.

## Code Style
- TypeScript strict mode on backend (`noImplicitAny: false` is the only relaxation)
- Prettier: single quotes, 100 char print width
- Angular schematics configured to skip test file generation (tests are written manually)
- French used for routes and domain status values


## UI Design — Style Guide

### Philosophy
Clean, minimal, and intentional. Every element earns its place.
Inspired by industrial design: raw, functional, yet refined.
No gradients. No shadows. No decoration for its own sake.

---

### Color Palette
- **Background:** `#0A0A0A` (near-black)
- **Surface:** `#111111` / `#1A1A1A`
- **Border:** `#2A2A2A` (subtle, 1px only)
- **Primary text:** `#F5F5F5`
- **Secondary text:** `#6B6B6B`
- **Accent:** `#FF3C3C` ← adjust to your brand color
- **Success:** `#3CFF8F`
- **Muted:** `#333333`

> Dark mode first. Light mode is optional.

---

### Typography
- **Font:** `Inter`, `DM Mono`, or system monospace for data/labels
- **Scale:** 11 / 13 / 15 / 20 / 28 / 40px — strict hierarchy, no in-between
- **Weight:** Regular (400) for body, Medium (500) for labels, no Bold unless necessary
- **Letter-spacing:** `+0.08em` on uppercase labels and tags
- **Line-height:** 1.4 for body, 1.1 for headings

---

### Layout & Spacing
- Base unit: **8px**. All spacing is a multiple of 8 (8, 16, 24, 32, 48…)
- Prefer full-width sections with generous internal padding (32–48px)
- Asymmetry is allowed; rigid grids are not required
- **No rounded corners** — or use a very tight `border-radius: 2px` max
- Dividers: 1px `#2A2A2A`, used sparingly

---

### Components
- **Buttons:** Outlined (`border: 1px solid #2A2A2A`) or ghost style. Filled only for primary CTA.
- **Inputs:** No floating labels. Minimal border, clear focus ring in accent color.
- **Cards:** Flat surfaces, 1px border, no shadow.
- **Tags/Badges:** Monospace font, uppercase, small, tight padding.
- **Icons:** Line-style only, 16–20px, stroke-width 1–1.5px.
- **Dot/Grid motifs:** Optional background texture — subtle dot matrix at 10% opacity.

---

### Motion
- Transitions: `150–200ms`, `ease-out` only
- No bounces, no springs, no playful easing
- Purposeful only: reveal, focus shift, state change

---

### Tone
> Raw. Functional. No filler.
> If it doesn't communicate something, remove it.
