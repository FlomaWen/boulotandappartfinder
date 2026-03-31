import { Router, Request, Response } from 'express';
import { startScheduler, stopScheduler, getSchedulerStatus, triggerScrapeNow } from '../services/scheduler';

const router = Router();

router.get('/status', (_req: Request, res: Response) => {
  const status = getSchedulerStatus();
  res.json(status);
});

router.post('/start', (req: Request, res: Response) => {
  const { cron } = req.body;
  startScheduler(cron);
  res.json({ message: 'Scheduler started', ...getSchedulerStatus() });
});

router.post('/stop', (_req: Request, res: Response) => {
  stopScheduler();
  res.json({ message: 'Scheduler stopped', ...getSchedulerStatus() });
});

router.post('/trigger', async (req: Request, res: Response) => {
  const { apartmentCity, apartmentMaxPrice, jobKeyword, jobCity } = req.body;

  // Don't wait for scraping to complete
  triggerScrapeNow({ apartmentCity, apartmentMaxPrice, jobKeyword, jobCity }).catch(err => {
    console.error('[Scheduler] Manual trigger failed:', err);
  });

  res.json({ message: 'Scraping started in background' });
});

export default router;
