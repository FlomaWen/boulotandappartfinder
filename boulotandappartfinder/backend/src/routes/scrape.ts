import { Router, Request, Response } from 'express';
import { scrapeLeboncoin } from '../scrapers/leboncoin';
import { scrapeSeloger } from '../scrapers/seloger';
import { scrapeHellowork } from '../scrapers/hellowork';
import { scrapeMeteojob } from '../scrapers/meteojob';
import { scrapeWelcometothejungle } from '../scrapers/welcometothejungle';

const router = Router();

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

router.post('/jobs', async (req: Request, res: Response) => {
  const { keyword, city } = req.body;

  if (!keyword || !city) {
    res.status(400).json({ error: 'keyword and city are required' });
    return;
  }

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

export default router;
