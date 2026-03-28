import puppeteer from 'puppeteer';
import { getDb } from '../database/schema';

const CITY_SLUGS: Record<string, string> = {
  paris: 'paris/r_12',
  lyon: 'lyon/r_116',
  bordeaux: 'bordeaux/r_33',
  toulouse: 'toulouse/r_31',
  nantes: 'nantes/r_44',
  marseille: 'marseille/r_13',
  montpellier: 'montpellier/r_34',
  lille: 'lille/r_59',
  strasbourg: 'strasbourg/r_67',
  rennes: 'rennes/r_35',
};

export async function scrapeLeboncoin(city: string, maxPrice?: number): Promise<number> {
  const cityLower = city.toLowerCase().trim();
  const slug = CITY_SLUGS[cityLower] || cityLower;

  let url = `https://www.leboncoin.fr/recherche?category=10&locations=${slug}&real_estate_type=appartement`;
  if (maxPrice) {
    url += `&price=min-${maxPrice}`;
  }

  console.log(`[LeBonCoin] Scraping: ${url}`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  let insertedCount = 0;

  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    await page.waitForSelector('[data-test-id="adcard_container"], .styles_adCard__HQRFN, article', { timeout: 10000 }).catch(() => {
      console.log('[LeBonCoin] Could not find ad cards selector, trying alternative...');
    });

    const listings = await page.evaluate(() => {
      const results: Array<{
        title: string;
        price: number;
        city: string;
        url: string;
        image: string;
        details: string;
      }> = [];

      const cards = document.querySelectorAll('[data-test-id="adcard_container"], [data-qa-id="aditem_container"], article a');

      cards.forEach((card: Element) => {
        try {
          const titleEl = card.querySelector('[data-qa-id="aditem_title"], h2, [class*="Title"]');
          const priceEl = card.querySelector('[data-qa-id="aditem_price"], [class*="Price"], span[aria-label*="prix"]');
          const locationEl = card.querySelector('[data-qa-id="aditem_location"], [class*="Location"]');
          const linkEl = card.closest('a') || card.querySelector('a');
          const imgEl = card.querySelector('img');

          const title = titleEl?.textContent?.trim() || '';
          const priceText = priceEl?.textContent?.trim() || '0';
          const price = parseInt(priceText.replace(/[^0-9]/g, ''), 10) || 0;
          const cityText = locationEl?.textContent?.trim() || '';
          const href = linkEl?.getAttribute('href') || '';
          const image = imgEl?.getAttribute('src') || '';

          if (title && href) {
            results.push({
              title,
              price,
              city: cityText,
              url: href.startsWith('http') ? href : `https://www.leboncoin.fr${href}`,
              image,
              details: '',
            });
          }
        } catch {
          // skip malformed card
        }
      });

      return results;
    });

    console.log(`[LeBonCoin] Found ${listings.length} listings`);

    const db = getDb();
    const insert = db.prepare(`
      INSERT OR IGNORE INTO apartments (title, city, price, image, url, source, type, description)
      VALUES (?, ?, ?, ?, ?, 'leboncoin', 'Appartement', ?)
    `);

    const insertMany = db.transaction((items: typeof listings) => {
      for (const item of items) {
        const result = insert.run(item.title, item.city || city, item.price, item.image, item.url, item.details);
        if (result.changes > 0) insertedCount++;
      }
    });

    insertMany(listings);
    console.log(`[LeBonCoin] Inserted ${insertedCount} new listings`);
  } finally {
    await browser.close();
  }

  return insertedCount;
}
