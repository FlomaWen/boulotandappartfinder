import { Router, Request, Response } from 'express';
import { scrapeLeboncoin } from '../scrapers/leboncoin';
import { scrapeHellowork } from '../scrapers/hellowork';

const router = Router();

// POST /api/scrape/apartments
router.post('/apartments', async (req: Request, res: Response) => {
  const { city, maxPrice } = req.body;

  if (!city) {
    res.status(400).json({ error: 'city is required' });
    return;
  }

  try {
    const count = await scrapeLeboncoin(city, maxPrice);
    res.json({ message: `${count} annonces scrapees depuis LeBonCoin`, count });
  } catch (err) {
    console.error('Scrape apartments error:', err);
    res.status(500).json({ error: 'Scraping failed', details: String(err) });
  }
});

// POST /api/scrape/jobs
router.post('/jobs', async (req: Request, res: Response) => {
  const { keyword, city } = req.body;

  if (!keyword || !city) {
    res.status(400).json({ error: 'keyword and city are required' });
    return;
  }

  try {
    const count = await scrapeHellowork(keyword, city);
    res.json({ message: `${count} offres scrapees depuis HelloWork`, count });
  } catch (err) {
    console.error('Scrape jobs error:', err);
    res.status(500).json({ error: 'Scraping failed', details: String(err) });
  }
});

export default router;
