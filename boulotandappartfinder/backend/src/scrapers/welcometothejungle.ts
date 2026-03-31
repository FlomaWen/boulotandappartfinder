import { createStealthBrowser, setupPage, randomDelay } from '../services/browser';
import { getDb } from '../database/schema';
import type { Browser } from 'puppeteer';

const COMPANY_COLORS = ['#4f46e5', '#0891b2', '#059669', '#dc2626', '#7c3aed', '#b45309', '#e11d48', '#0d9488'];

export async function scrapeWelcometothejungle(keyword: string, city: string): Promise<number> {
  const query = encodeURIComponent(keyword.trim());
  const cityParam = city.trim() ? `&aroundQuery=${encodeURIComponent(city.trim())}` : '';

  const url = `https://www.welcometothejungle.com/fr/jobs?query=${query}${cityParam}&refinementList%5Boffices.country_code%5D%5B%5D=FR`;

  console.log(`[WTTJ] Scraping: ${url}`);

  let insertedCount = 0;
  let browser: Browser | null = null;

  try {
    // Launch with stealth plugin and optional proxy
    const isProduction = process.env.NODE_ENV === 'production';
    browser = await createStealthBrowser({
      headless: isProduction,
      useProxy: true,
    });

    const page = await setupPage(browser);
    await randomDelay(2000, 5000);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    // Accept cookies if present
    try {
      const cookieBtn = await page.$('[data-testid="cookie-consent-accept"], button[id*="accept"], [aria-label*="Accept"]');
      if (cookieBtn) await cookieBtn.click();
    } catch { /* no cookie banner */ }

    // Wait for job cards to load
    await page.waitForSelector('li[data-testid^="search-results-list-item"], [role="list"] li, article', { timeout: 15000 }).catch(() => {
      console.log('[WTTJ] No job cards found, page may have no results or different structure');
    });

    // Scroll down to load more results
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight));
      await new Promise(r => setTimeout(r, 1000));
    }

    // Extract listings from the page
    const listings = await page.evaluate(() => {
      const results: Array<{
        title: string;
        company: string;
        city: string;
        salary: string;
        salaryMin: number | null;
        description: string;
        url: string;
        remote: string;
        tags: string[];
      }> = [];

      // WTTJ uses list items or article-based cards
      const cards = document.querySelectorAll(
        'li[data-testid^="search-results-list-item"], [role="list"] > div, [role="list"] > li'
      );

      // Fallback: try all links that look like job offers
      const jobLinks = cards.length > 0
        ? cards
        : document.querySelectorAll('a[href*="/fr/companies/"][href*="/jobs/"]');

      jobLinks.forEach((el) => {
        try {
          // Find the link to the job
          const linkEl = el.tagName === 'A'
            ? el as HTMLAnchorElement
            : el.querySelector('a[href*="/jobs/"], a[href*="/emplois/"]') as HTMLAnchorElement;

          if (!linkEl) return;

          const href = linkEl.getAttribute('href') || '';
          const fullUrl = href.startsWith('http')
            ? href
            : `https://www.welcometothejungle.com${href}`;

          // Skip non-job links
          if (!fullUrl.includes('/jobs/') && !fullUrl.includes('/emplois/')) return;

          // Extract text content from the card
          const allText = el.textContent || '';

          // Title: usually the first prominent text/heading
          const titleEl = el.querySelector('h3, h4, [role="heading"], strong');
          const title = titleEl?.textContent?.trim() || linkEl.textContent?.trim()?.split('\n')[0] || '';

          // Company: often in a separate span or div
          const texts = Array.from(el.querySelectorAll('span, p, div'))
            .map(e => e.textContent?.trim())
            .filter(t => t && t.length > 1 && t.length < 80);

          // Usually: title, company, location, contract in that order
          const company = texts.length > 1 ? texts[1] || '' : '';

          // Location
          const locationTexts = texts.filter(t =>
            t && (t.match(/[A-Z][a-z]+/) && (t.includes(',') || t.match(/\d{2,5}/) || t.includes('Paris') || t.includes('Lyon') || t.includes('Bordeaux')))
          );
          const location = locationTexts[0] || '';

          // Contract type
          const contractTexts = texts.filter(t =>
            t && (t.includes('CDI') || t.includes('CDD') || t.includes('Stage') || t.includes('Alternance') || t.includes('Freelance'))
          );
          const contractType = contractTexts[0] || '';

          // Salary
          let salary = '';
          let salaryMin: number | null = null;
          const salaryTexts = texts.filter(t => t && t.includes('€'));
          if (salaryTexts.length > 0) {
            salary = salaryTexts[0]!;
            const match = salary.match(/([\d\s]+)/);
            if (match) {
              salaryMin = parseInt(match[1].replace(/\s/g, ''), 10);
              if (salaryMin < 100) salaryMin *= 1000;
            }
          }

          // Remote
          let remote = 'Presentiel';
          const fullText = allText.toLowerCase();
          if (fullText.includes('full remote') || fullText.includes('télétravail total') || fullText.includes('100% remote')) {
            remote = 'Full remote';
          } else if (fullText.includes('télétravail') || fullText.includes('remote') || fullText.includes('hybride') || fullText.includes('partiel')) {
            remote = 'Hybride';
          }

          const tags: string[] = [];
          if (contractType) tags.push(contractType);

          if (title && fullUrl) {
            results.push({
              title: title.substring(0, 200),
              company: company.substring(0, 100),
              city: location || '',
              salary: salary || 'Non precise',
              salaryMin,
              description: title,
              url: fullUrl,
              remote,
              tags,
            });
          }
        } catch {
          // skip malformed card
        }
      });

      return results;
    });

    console.log(`[WTTJ] Found ${listings.length} listings`);

    const db = getDb();
    const insert = db.prepare(`
      INSERT OR IGNORE INTO jobs (title, company, city, salary, salary_min, description, url, source, remote, tags, color)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'welcometothejungle', ?, ?, ?)
    `);

    const insertMany = db.transaction((items: typeof listings) => {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const color = COMPANY_COLORS[i % COMPANY_COLORS.length];
        const result = insert.run(
          item.title,
          item.company,
          item.city || city,
          item.salary,
          item.salaryMin,
          item.description,
          item.url,
          item.remote,
          JSON.stringify(item.tags),
          color
        );
        if (result.changes > 0) insertedCount++;
      }
    });

    insertMany(listings);
    console.log(`[WTTJ] Inserted ${insertedCount} new listings`);
  } catch (err) {
    console.error('[WTTJ] Scraping error:', err);
    throw err;
  } finally {
    if (browser) await browser.close();
  }

  return insertedCount;
}
