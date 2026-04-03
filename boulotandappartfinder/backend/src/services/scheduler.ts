import cron from 'node-cron';
import { scrapeLeboncoin } from '../scrapers/leboncoin';
import { scrapeSeloger } from '../scrapers/seloger';
import { scrapeHellowork } from '../scrapers/hellowork';
import { scrapeMeteojob } from '../scrapers/meteojob';
import { scrapeWelcometothejungle } from '../scrapers/welcometothejungle';
import { getDb } from '../database/schema';

let scheduledTask: cron.ScheduledTask | null = null;

export interface SchedulerConfig {
  apartmentCity: string;
  apartmentMaxPrice?: number;
  jobKeyword: string;
  jobCity: string;
}

interface AutoSearchRow {
  id: number;
  type: 'apartments' | 'jobs';
  name: string;
  filters: string;
  active: number;
}

function getActiveAutoSearches(): AutoSearchRow[] {
  const db = getDb();
  return db.prepare('SELECT * FROM auto_searches WHERE active = 1').all() as AutoSearchRow[];
}

async function runScheduledScrape(): Promise<void> {
  console.log(`[Scheduler] Starting scheduled scrape at ${new Date().toISOString()}`);

  const searches = getActiveAutoSearches();

  if (searches.length === 0) {
    console.log('[Scheduler] No active auto searches configured, skipping.');
    return;
  }

  console.log(`[Scheduler] Found ${searches.length} active auto searches`);

  const aptSearches = searches.filter((s) => s.type === 'apartments');
  const jobSearches = searches.filter((s) => s.type === 'jobs');

  // Scrape apartments for each active apartment search
  for (const search of aptSearches) {
    const parsed = JSON.parse(search.filters);
    // Support both `cities` array and legacy `city` string
    const cityList: string[] = parsed.cities || (parsed.city ? [parsed.city] : []);
    console.log(`[Scheduler] Scraping apartments: "${search.name}" — cities: ${cityList.join(', ')}`);

    for (const c of cityList) {
      const filters = { ...parsed, city: c };
      delete filters.cities;

      try {
        const lbcCount = await scrapeLeboncoin(filters);
        console.log(`[Scheduler] LeBonCoin (${search.name}/${c}): ${lbcCount} new apartments`);
      } catch (err) {
        console.error(`[Scheduler] LeBonCoin (${search.name}/${c}) failed:`, err);
      }

      await new Promise((r) => setTimeout(r, 30000));

      try {
        const slCount = await scrapeSeloger(filters);
        console.log(`[Scheduler] SeLoger (${search.name}/${c}): ${slCount} new apartments`);
      } catch (err) {
        console.error(`[Scheduler] SeLoger (${search.name}/${c}) failed:`, err);
      }

      await new Promise((r) => setTimeout(r, 30000));
    }
  }

  // Scrape jobs for each active job search
  for (const search of jobSearches) {
    const parsed = JSON.parse(search.filters) as { keyword: string; cities?: string[]; city?: string };
    const cityList: string[] = parsed.cities || (parsed.city ? [parsed.city] : []);
    console.log(`[Scheduler] Scraping jobs: "${search.name}" — keyword: ${parsed.keyword}, cities: ${cityList.join(', ')}`);

    for (const c of cityList) {
      try {
        const hwCount = await scrapeHellowork(parsed.keyword, c);
        console.log(`[Scheduler] HelloWork (${search.name}/${c}): ${hwCount} new jobs`);
      } catch (err) {
        console.error(`[Scheduler] HelloWork (${search.name}/${c}) failed:`, err);
      }

      await new Promise((r) => setTimeout(r, 10000));

      try {
        const mjCount = await scrapeMeteojob(parsed.keyword, c);
        console.log(`[Scheduler] Meteojob (${search.name}/${c}): ${mjCount} new jobs`);
      } catch (err) {
        console.error(`[Scheduler] Meteojob (${search.name}/${c}) failed:`, err);
      }

      await new Promise((r) => setTimeout(r, 30000));

      try {
        const wttjCount = await scrapeWelcometothejungle(parsed.keyword, c);
        console.log(`[Scheduler] WTTJ (${search.name}/${c}): ${wttjCount} new jobs`);
      } catch (err) {
        console.error(`[Scheduler] WTTJ (${search.name}/${c}) failed:`, err);
      }

      await new Promise((r) => setTimeout(r, 30000));
    }
  }

  console.log(`[Scheduler] Complete!`);
}

export function startScheduler(cronExpression?: string): void {
  const expression = cronExpression || process.env.SCRAPE_CRON || '0 */5 * * *';

  if (scheduledTask) {
    console.log('[Scheduler] Stopping existing scheduler');
    scheduledTask.stop();
  }

  if (!cron.validate(expression)) {
    console.error(`[Scheduler] Invalid cron expression: ${expression}`);
    return;
  }

  console.log(`[Scheduler] Starting scheduler with cron: ${expression}`);

  scheduledTask = cron.schedule(expression, () => {
    runScheduledScrape();
  });

  console.log('[Scheduler] Scheduler started successfully');
}

export function stopScheduler(): void {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    console.log('[Scheduler] Scheduler stopped');
  }
}

export function getSchedulerStatus(): { running: boolean; cron: string } {
  return {
    running: scheduledTask !== null,
    cron: process.env.SCRAPE_CRON || '0 */5 * * *',
  };
}

export async function triggerScrapeNow(): Promise<void> {
  await runScheduledScrape();
}
