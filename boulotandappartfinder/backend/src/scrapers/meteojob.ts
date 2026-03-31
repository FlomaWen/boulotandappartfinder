import * as cheerio from 'cheerio';
import { getDb } from '../database/schema';

const COMPANY_COLORS = ['#4f46e5', '#0891b2', '#059669', '#dc2626', '#7c3aed', '#b45309', '#e11d48', '#0d9488'];

export async function scrapeMeteojob(keyword: string, city: string): Promise<number> {
  const what = encodeURIComponent(keyword.trim());
  const where = encodeURIComponent(city.trim());

  const url = `https://www.meteojob.com/jobsearch/offers?what=${what}&where=${where}`;

  console.log(`[Meteojob] Scraping: ${url}`);

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

    // Each job card is an app-offer-list-item with class cc-job-offer-list-item
    $('.cc-job-offer-list-item').each((_i, el) => {
      try {
        const $el = $(el);

        // Title from h2.cc-job-offer-title
        const title = $el.find('.cc-job-offer-title').text().trim();

        // Company name: p tag with id ending in "-company-name"
        const $companyEl = $el.find('[id$="-company-name"]');
        const company = $companyEl.text().trim();

        // Extract offer ID from the company element id (e.g. "52825925-company-name")
        const companyId = $companyEl.attr('id') || '';
        const offerId = companyId.replace('-company-name', '');

        // Location: element with id ending in "-job-locations"
        const location = $el.find('[id$="-job-locations"] span').text().trim();

        // Contract type: element with id ending in "-contract-types"
        const contractType = $el.find('[id$="-contract-types"] span').text().trim();

        // Remote status: element with id ending in "-telework"
        const telework = $el.find('[id$="-telework"] span').text().trim();

        // Salary: span with class cc-tag-primary-light containing €
        let salaryText = '';
        $el.find('.cc-tag-primary-light').each((_j, tagEl) => {
          const text = $(tagEl).text().trim();
          if (text.includes('€')) {
            salaryText = text;
          }
        });

        // Parse remote status
        let remote = 'Presentiel';
        if (telework) {
          const teleworkLower = telework.toLowerCase();
          if (teleworkLower.includes('partiel') || teleworkLower.includes('occasionnel') || teleworkLower.includes('hybride')) {
            remote = 'Hybride';
          } else if (teleworkLower.includes('total') || teleworkLower.includes('complet') || teleworkLower.includes('full')) {
            remote = 'Full remote';
          } else if (teleworkLower.includes('télétravail') || teleworkLower.includes('teletravail')) {
            remote = 'Hybride';
          }
        }

        // Parse min salary
        let salaryMin: number | null = null;
        const salaryMatch = salaryText.match(/([\d\s\u00A0\u202F]+)/);
        if (salaryMatch) {
          salaryMin = parseInt(salaryMatch[1].replace(/[\s\u00A0\u202F]/g, ''), 10);
          if (salaryMin < 100) salaryMin *= 1000;
        }

        // Build offer URL
        const offerUrl = offerId
          ? `https://www.meteojob.com/jobsearch/offers/show/${offerId}`
          : '';

        // Tags
        const tags: string[] = [];
        if (contractType) tags.push(contractType);
        if (telework) tags.push(telework);

        // Date
        const dateText = $el.find('.cc-font-size-small .ft-clock').parent().text().trim();
        if (dateText) tags.push(dateText);

        if (title && offerUrl) {
          listings.push({
            title,
            company: company || 'Entreprise',
            city: location || city,
            salary: salaryText || 'Non precise',
            salaryMin,
            description: title,
            url: offerUrl,
            remote,
            tags,
          });
        }
      } catch {
        // skip malformed card
      }
    });

    console.log(`[Meteojob] Found ${listings.length} listings`);

    const db = getDb();
    const insert = db.prepare(`
      INSERT OR IGNORE INTO jobs (title, company, city, salary, salary_min, description, url, source, remote, tags, color)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'meteojob', ?, ?, ?)
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
    console.log(`[Meteojob] Inserted ${insertedCount} new listings`);
  } catch (err) {
    console.error('[Meteojob] Scraping error:', err);
    throw err;
  }

  return insertedCount;
}
