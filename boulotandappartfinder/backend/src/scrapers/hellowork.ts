import * as cheerio from 'cheerio';
import { getDb } from '../database/schema';

const COMPANY_COLORS = ['#4f46e5', '#0891b2', '#059669', '#dc2626', '#7c3aed', '#b45309', '#e11d48', '#0d9488'];

export async function scrapeHellowork(keyword: string, city: string): Promise<number> {
  const keywordSlug = encodeURIComponent(keyword.trim());
  const citySlug = encodeURIComponent(city.trim());

  const url = `https://www.hellowork.com/fr-fr/emploi/recherche.html?k=${keywordSlug}&l=${citySlug}`;

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

    // Each job card has data-cy="serpCard"
    $('[data-cy="serpCard"]').each((_i, el) => {
      try {
        const $el = $(el);

        // Title & link from the offerTitle anchor
        const $link = $el.find('a[data-cy="offerTitle"]');
        const href = $link.attr('href') || '';
        const fullUrl = href.startsWith('http') ? href : `https://www.hellowork.com${href}`;

        // Title is in h3 > first p
        const title = $el.find('h3 p').first().text().trim();

        // Company is in h3 > second p (with tw-typo-s class)
        const company = $el.find('h3 p.tw-typo-s').text().trim() ||
                        $el.find('h3 p').eq(1).text().trim();

        // Location from data-cy="localisationCard"
        const location = $el.find('[data-cy="localisationCard"]').text().trim();

        // Contract type from data-cy="contractCard"
        const contractType = $el.find('[data-cy="contractCard"]').text().trim();

        // Salary: look for tag divs containing € sign
        let salaryText = '';
        $el.find('.tw-tag-secondary-s').each((_j, tagEl) => {
          const text = $(tagEl).text().trim();
          if (text.includes('€')) {
            salaryText = text;
          }
        });

        // Remote status from data-cy="contractTag"
        const remoteTag = $el.find('[data-cy="contractTag"]').text().trim();

        let remote = 'Presentiel';
        if (remoteTag) {
          const remoteText = remoteTag.toLowerCase();
          if (remoteText.includes('partiel') || remoteText.includes('occasionnel') || remoteText.includes('hybride')) {
            remote = 'Hybride';
          } else if (remoteText.includes('teletravail') || remoteText.includes('télétravail') || remoteText.includes('remote') || remoteText.includes('domicile')) {
            remote = 'Full remote';
          }
        }

        // Parse min salary from salary text
        let salaryMin: number | null = null;
        const salaryMatch = salaryText.match(/([\d\s]+)/);
        if (salaryMatch) {
          salaryMin = parseInt(salaryMatch[1].replace(/[\s\u202F]/g, ''), 10);
          if (salaryMin < 100) salaryMin *= 1000;
        }

        // Description from the title attribute on the link (contains "title - company")
        const titleAttr = $link.attr('aria-label') || '';

        // Tags: contract type + remote
        const tags: string[] = [];
        if (contractType) tags.push(contractType);
        if (remoteTag) tags.push(remoteTag);

        // Date posted
        const dateText = $el.find('.tw-text-grey-500').text().trim();
        if (dateText) tags.push(dateText);

        if (title && fullUrl && fullUrl !== 'https://www.hellowork.com') {
          listings.push({
            title,
            company: company || 'Entreprise',
            city: location || city,
            salary: salaryText || 'Non precise',
            salaryMin,
            description: titleAttr || title,
            url: fullUrl,
            remote,
            tags,
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
