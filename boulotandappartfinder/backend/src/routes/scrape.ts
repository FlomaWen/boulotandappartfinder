import { Router, Request, Response } from 'express';
import { scrapeLeboncoin, solveLeboncoinCaptcha } from '../scrapers/leboncoin';
import { scrapeSeloger } from '../scrapers/seloger';
import { scrapeHellowork } from '../scrapers/hellowork';
import { scrapeMeteojob } from '../scrapers/meteojob';
import { scrapeWelcometothejungle } from '../scrapers/welcometothejungle';
import { getDb } from '../database/schema';

const router = Router();

function saveLastFilters(id: string, filters: Record<string, unknown>): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO last_search_filters (id, filters, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET filters = excluded.filters, updated_at = datetime('now')`
  ).run(id, JSON.stringify(filters));
}

export function getLastFilters(id: string): Record<string, unknown> | null {
  const db = getDb();
  const row = db.prepare('SELECT filters FROM last_search_filters WHERE id = ?').get(id) as { filters: string } | undefined;
  return row ? JSON.parse(row.filters) : null;
}

router.post('/apartments', async (req: Request, res: Response) => {
  const { cities, city, minPrice, maxPrice, propertyTypes, minRooms, maxRooms, minBedrooms, maxBedrooms, minSurface, maxSurface, minLandSurface, maxLandSurface, furnished } = req.body;

  // Support both `cities` array and legacy `city` string
  const cityList: string[] = cities && cities.length > 0 ? cities : city ? [city] : [];

  if (cityList.length === 0) {
    res.status(400).json({ error: 'city or cities is required' });
    return;
  }

  const baseFilters = {
    minPrice, maxPrice, propertyTypes,
    minRooms, maxRooms, minBedrooms, maxBedrooms,
    minSurface, maxSurface, minLandSurface, maxLandSurface,
    furnished,
  };

  // Save filters so the scheduler reuses them
  saveLastFilters('apartments', { cities: cityList, ...baseFilters });

  try {
    let total = 0;

    for (const c of cityList) {
      const filters = { city: c, ...baseFilters };

      console.log(`[Scrape] Starting LeBonCoin for ${c}...`);
      const lbcCount = await scrapeLeboncoin(filters);
      console.log(`[Scrape] LeBonCoin (${c}) done: ${lbcCount} new listings`);
      total += lbcCount;

      console.log(`[Scrape] Starting SeLoger for ${c}...`);
      const slCount = await scrapeSeloger(filters);
      console.log(`[Scrape] SeLoger (${c}) done: ${slCount} new listings`);
      total += slCount;
    }

    res.json({
      message: `${total} annonces scrapees pour ${cityList.join(', ')}`,
      count: total,
    });
  } catch (err) {
    console.error('Scrape apartments error:', err);
    res.status(500).json({ error: 'Scraping failed', details: String(err) });
  }
});

// Opens a browser for manual captcha solving on LeBonCoin
router.post('/leboncoin-captcha', async (_req: Request, res: Response) => {
  try {
    res.json({ message: 'Browser ouvert. Résolvez le captcha dans la fenêtre du navigateur.' });
    await solveLeboncoinCaptcha();
  } catch (err) {
    console.error('Captcha solve error:', err);
  }
});

router.post('/jobs', async (req: Request, res: Response) => {
  const { keyword, cities, city } = req.body;

  const cityList: string[] = cities && cities.length > 0 ? cities : city ? [city] : [];

  if (!keyword || cityList.length === 0) {
    res.status(400).json({ error: 'keyword and city/cities are required' });
    return;
  }

  saveLastFilters('jobs', { keyword, cities: cityList });

  try {
    let total = 0;

    for (const c of cityList) {
      console.log(`[Scrape] Starting HelloWork for ${keyword} in ${c}...`);
      const hwCount = await scrapeHellowork(keyword, c);
      console.log(`[Scrape] HelloWork (${c}) done: ${hwCount} new listings`);
      total += hwCount;

      console.log(`[Scrape] Starting Meteojob for ${keyword} in ${c}...`);
      const mjCount = await scrapeMeteojob(keyword, c);
      console.log(`[Scrape] Meteojob (${c}) done: ${mjCount} new listings`);
      total += mjCount;

      console.log(`[Scrape] Starting Welcome to the Jungle for ${keyword} in ${c}...`);
      const wttjCount = await scrapeWelcometothejungle(keyword, c);
      console.log(`[Scrape] WTTJ (${c}) done: ${wttjCount} new listings`);
      total += wttjCount;
    }

    res.json({
      message: `${total} offres scrapees pour ${cityList.join(', ')}`,
      count: total,
    });
  } catch (err) {
    console.error('Scrape jobs error:', err);
    res.status(500).json({ error: 'Scraping failed', details: String(err) });
  }
});

// GET /api/scrape/auto-filters — return the saved filters used by the scheduler
router.get('/auto-filters', (_req: Request, res: Response) => {
  const apartments = getLastFilters('apartments');
  const jobs = getLastFilters('jobs');
  res.json({ apartments, jobs });
});

export default router;
