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
