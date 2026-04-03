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
  const { city, minPrice, maxPrice, propertyTypes, minRooms, maxRooms, minBedrooms, maxBedrooms, minSurface, maxSurface, minLandSurface, maxLandSurface, furnished } = req.body;

  if (!city) {
    res.status(400).json({ error: 'city is required' });
    return;
  }

  const filters = {
    city, minPrice, maxPrice, propertyTypes,
    minRooms, maxRooms, minBedrooms, maxBedrooms,
    minSurface, maxSurface, minLandSurface, maxLandSurface,
    furnished,
  };

  // Save filters so the scheduler reuses them
  saveLastFilters('apartments', filters);

  try {
    // Run both scrapers sequentially (they each open a browser)
    console.log('[Scrape] Starting LeBonCoin...');
    const lbcCount = await scrapeLeboncoin(filters);
    console.log(`[Scrape] LeBonCoin done: ${lbcCount} new listings`);

    console.log('[Scrape] Starting SeLoger...');
    const slCount = await scrapeSeloger(filters);
    console.log(`[Scrape] SeLoger done: ${slCount} new listings`);

    const total = lbcCount + slCount;
    res.json({
      message: `${total} annonces scrapees (LeBonCoin: ${lbcCount}, SeLoger: ${slCount})`,
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
    // Run in background — the response is sent immediately
    await solveLeboncoinCaptcha();
  } catch (err) {
    console.error('Captcha solve error:', err);
    // Response already sent, just log
  }
});

router.post('/jobs', async (req: Request, res: Response) => {
  const { keyword, city } = req.body;

  if (!keyword || !city) {
    res.status(400).json({ error: 'keyword and city are required' });
    return;
  }

  // Save filters so the scheduler reuses them
  saveLastFilters('jobs', { keyword, city });

  try {
    // HelloWork: static HTML scraping (fast)
    console.log('[Scrape] Starting HelloWork...');
    const hwCount = await scrapeHellowork(keyword, city);
    console.log(`[Scrape] HelloWork done: ${hwCount} new listings`);

    // Meteojob: static HTML scraping (fast)
    console.log('[Scrape] Starting Meteojob...');
    const mjCount = await scrapeMeteojob(keyword, city);
    console.log(`[Scrape] Meteojob done: ${mjCount} new listings`);

    // WTTJ: Puppeteer (slower, opens browser)
    console.log('[Scrape] Starting Welcome to the Jungle...');
    const wttjCount = await scrapeWelcometothejungle(keyword, city);
    console.log(`[Scrape] WTTJ done: ${wttjCount} new listings`);

    const total = hwCount + mjCount + wttjCount;
    res.json({
      message: `${total} offres scrapees (HelloWork: ${hwCount}, Meteojob: ${mjCount}, WTTJ: ${wttjCount})`,
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
