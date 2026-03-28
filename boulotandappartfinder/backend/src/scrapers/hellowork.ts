import * as cheerio from 'cheerio';
import { getDb } from '../database/schema';

const COMPANY_COLORS = ['#4f46e5', '#0891b2', '#059669', '#dc2626', '#7c3aed', '#b45309', '#e11d48', '#0d9488'];

export async function scrapeHellowork(keyword: string, city: string): Promise<number> {
  const keywordSlug = encodeURIComponent(keyword.toLowerCase().trim());
  const citySlug = encodeURIComponent(city.toLowerCase().trim());

  const url = `https://www.hellowork.com/fr-fr/emploi/recherche.html?k=${keywordSlug}&l=${citySlug}&c=CDI`;

  console.log(`[HelloWork] Scraping: ${url}`);

  let insertedCount = 0;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'fr-FR,fr;q=0.9',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const listings: Array<{
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

    $('[data-cy="job-card"], .offer-card, article, [class*="JobCard"], [class*="job-result"]').each((_i, el) => {
      try {
        const $el = $(el);
        const title = $el.find('h2, h3, [class*="Title"], [data-cy="job-title"]').first().text().trim();
        const company = $el.find('[class*="Company"], [data-cy="company-name"], [class*="company"]').first().text().trim();
        const location = $el.find('[class*="Location"], [class*="location"], [data-cy="job-location"]').first().text().trim();
        const salaryText = $el.find('[class*="Salary"], [class*="salary"]').first().text().trim();
        const desc = $el.find('[class*="Description"], [class*="description"], p').first().text().trim();
        const link = $el.find('a').first().attr('href') || $el.closest('a').attr('href') || '';
        const fullUrl = link.startsWith('http') ? link : `https://www.hellowork.com${link}`;

        let salaryMin: number | null = null;
        const salaryMatch = salaryText.match(/(\d[\d\s]*)/);
        if (salaryMatch) {
          salaryMin = parseInt(salaryMatch[1].replace(/\s/g, ''), 10);
          if (salaryMin < 100) salaryMin *= 1000;
        }

        const fullText = $el.text().toLowerCase();
        let remote = 'Presentiel';
        if (fullText.includes('teletravail') || fullText.includes('remote') || fullText.includes('domicile')) {
          remote = fullText.includes('partiel') || fullText.includes('hybride') ? 'Hybride' : 'Full remote';
        }

        if (title && fullUrl && fullUrl !== 'https://www.hellowork.com') {
          listings.push({
            title,
            company: company || 'Entreprise',
            city: location || city,
            salary: salaryText || 'Non precise',
            salaryMin,
            description: desc,
            url: fullUrl,
            remote,
            tags: [],
          });
        }
      } catch {
        // skip malformed card
      }
    });

    console.log(`[HelloWork] Found ${listings.length} listings`);

    const db = getDb();
    const insert = db.prepare(`
      INSERT OR IGNORE INTO jobs (title, company, city, salary, salary_min, description, url, source, remote, tags, color)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'hellowork', ?, ?, ?)
    `);

    const insertMany = db.transaction((items: typeof listings) => {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const color = COMPANY_COLORS[i % COMPANY_COLORS.length];
        const result = insert.run(
          item.title,
          item.company,
          item.city,
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
    console.log(`[HelloWork] Inserted ${insertedCount} new listings`);
  } catch (err) {
    console.error('[HelloWork] Scraping error:', err);
    throw err;
  }

  return insertedCount;
}
