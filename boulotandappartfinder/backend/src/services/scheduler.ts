import cron from 'node-cron';
import { scrapeLeboncoin } from '../scrapers/leboncoin';
import { scrapeSeloger } from '../scrapers/seloger';
import { scrapeHellowork } from '../scrapers/hellowork';
import { scrapeMeteojob } from '../scrapers/meteojob';
import { scrapeWelcometothejungle } from '../scrapers/welcometothejungle';

let scheduledTask: cron.ScheduledTask | null = null;

export interface SchedulerConfig {
  apartmentCity: string;
  apartmentMaxPrice?: number;
  jobKeyword: string;
  jobCity: string;
}

function getDefaultConfig(): SchedulerConfig {
  return {
    apartmentCity: process.env.DEFAULT_APARTMENT_CITY || 'Bordeaux',
    apartmentMaxPrice: process.env.DEFAULT_APARTMENT_MAX_PRICE
      ? parseInt(process.env.DEFAULT_APARTMENT_MAX_PRICE, 10)
      : undefined,
    jobKeyword: process.env.DEFAULT_JOB_KEYWORD || 'developpeur',
    jobCity: process.env.DEFAULT_JOB_CITY || 'Bordeaux',
  };
}

async function runScheduledScrape(config: SchedulerConfig): Promise<void> {
  console.log(`[Scheduler] Starting scheduled scrape at ${new Date().toISOString()}`);
  console.log(`[Scheduler] Config:`, JSON.stringify(config));

  try {
    // Scrape apartments
    console.log('[Scheduler] Scraping apartments...');
    const apartmentFilters = {
      city: config.apartmentCity,
      maxPrice: config.apartmentMaxPrice,
    };

    let totalApartments = 0;
    try {
      const lbcCount = await scrapeLeboncoin(apartmentFilters);
      console.log(`[Scheduler] LeBonCoin: ${lbcCount} new apartments`);
      totalApartments += lbcCount;
    } catch (err) {
      console.error('[Scheduler] LeBonCoin failed:', err);
    }

    // Wait between scrapers to avoid rate limiting
    await new Promise(r => setTimeout(r, 30000));

    try {
      const slCount = await scrapeSeloger(apartmentFilters);
      console.log(`[Scheduler] SeLoger: ${slCount} new apartments`);
      totalApartments += slCount;
    } catch (err) {
      console.error('[Scheduler] SeLoger failed:', err);
    }

    await new Promise(r => setTimeout(r, 30000));

    // Scrape jobs
    console.log('[Scheduler] Scraping jobs...');
    let totalJobs = 0;

    try {
      const hwCount = await scrapeHellowork(config.jobKeyword, config.jobCity);
      console.log(`[Scheduler] HelloWork: ${hwCount} new jobs`);
      totalJobs += hwCount;
    } catch (err) {
      console.error('[Scheduler] HelloWork failed:', err);
    }

    await new Promise(r => setTimeout(r, 10000));

    try {
      const mjCount = await scrapeMeteojob(config.jobKeyword, config.jobCity);
      console.log(`[Scheduler] Meteojob: ${mjCount} new jobs`);
      totalJobs += mjCount;
    } catch (err) {
      console.error('[Scheduler] Meteojob failed:', err);
    }

    await new Promise(r => setTimeout(r, 30000));

    try {
      const wttjCount = await scrapeWelcometothejungle(config.jobKeyword, config.jobCity);
      console.log(`[Scheduler] WTTJ: ${wttjCount} new jobs`);
      totalJobs += wttjCount;
    } catch (err) {
      console.error('[Scheduler] WTTJ failed:', err);
    }

    console.log(`[Scheduler] Complete! Total: ${totalApartments} apartments, ${totalJobs} jobs`);
  } catch (err) {
    console.error('[Scheduler] Scraping failed:', err);
  }
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
  const config = getDefaultConfig();

  scheduledTask = cron.schedule(expression, () => {
    runScheduledScrape(config);
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

// Manual trigger for immediate scrape
export async function triggerScrapeNow(config?: Partial<SchedulerConfig>): Promise<void> {
  const fullConfig = { ...getDefaultConfig(), ...config };
  await runScheduledScrape(fullConfig);
}
