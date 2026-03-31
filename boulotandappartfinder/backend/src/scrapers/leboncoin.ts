import puppeteer from 'puppeteer';
import { getDb } from '../database/schema';
import fs from 'fs';
import path from 'path';

const CHROME_PROFILE_DIR = path.resolve(__dirname, '../../data/chrome-profile');

const CITY_POSTCODES: Record<string, { name: string; code: string }> = {
  paris: { name: 'Paris', code: '75000' },
  lyon: { name: 'Lyon', code: '69000' },
  bordeaux: { name: 'Bordeaux', code: '33000' },
  toulouse: { name: 'Toulouse', code: '31000' },
  nantes: { name: 'Nantes', code: '44000' },
  marseille: { name: 'Marseille', code: '13000' },
  montpellier: { name: 'Montpellier', code: '34000' },
  lille: { name: 'Lille', code: '59000' },
  strasbourg: { name: 'Strasbourg', code: '67000' },
  rennes: { name: 'Rennes', code: '35000' },
  nice: { name: 'Nice', code: '06000' },
  grenoble: { name: 'Grenoble', code: '38000' },
  rouen: { name: 'Rouen', code: '76000' },
  toulon: { name: 'Toulon', code: '83000' },
  dijon: { name: 'Dijon', code: '21000' },
};

export interface LeboncoinFilters {
  city: string;
  minPrice?: number;
  maxPrice?: number;
  propertyTypes?: string[];
  minRooms?: number;
  maxRooms?: number;
  minBedrooms?: number;
  maxBedrooms?: number;
  minSurface?: number;
  maxSurface?: number;
  minLandSurface?: number;
  maxLandSurface?: number;
  furnished?: string;
}

export async function scrapeLeboncoin(filters: LeboncoinFilters): Promise<number> {
  const cityRaw = filters.city.trim();

  // Support formats: "Bordeaux", "Bordeaux 33300", "Bordeaux_33300"
  const match = cityRaw.match(/^([a-zA-ZÀ-ÿ-]+)\s*[_\s]?\s*(\d{5})?$/);
  const cityName = match ? match[1] : cityRaw;
  const explicitPostcode = match ? match[2] : undefined;

  const cityLower = cityName.toLowerCase();
  const cityInfo = CITY_POSTCODES[cityLower];

  let locationParam: string;
  if (explicitPostcode) {
    // User specified a postcode — use it directly
    const displayName = cityInfo ? cityInfo.name : cityName.charAt(0).toUpperCase() + cityName.slice(1).toLowerCase();
    locationParam = `${displayName}_${explicitPostcode}`;
  } else if (cityInfo) {
    locationParam = `${cityInfo.name}_${cityInfo.code}`;
  } else {
    locationParam = cityRaw;
  }

  const typeMap: Record<string, string> = {
    appartement: '2',
    maison: '1',
    terrain: '3',
    parking: '4',
    autre: '5',
  };
  const types = filters.propertyTypes?.length
    ? filters.propertyTypes.map(t => typeMap[t] || t).join(',')
    : '2';

  let url = `https://www.leboncoin.fr/recherche?category=10&locations=${encodeURIComponent(locationParam)}&real_estate_type=${types}`;

  if (filters.minPrice || filters.maxPrice) {
    const pMin = filters.minPrice ?? 'min';
    const pMax = filters.maxPrice ?? 'max';
    url += `&price=${pMin}-${pMax}`;
  }

  if (filters.minRooms || filters.maxRooms) {
    const rMin = filters.minRooms ?? 'min';
    const rMax = filters.maxRooms ?? 'max';
    url += `&rooms=${rMin}-${rMax}`;
  }

  if (filters.minBedrooms || filters.maxBedrooms) {
    const bMin = filters.minBedrooms ?? 'min';
    const bMax = filters.maxBedrooms ?? 'max';
    url += `&bedrooms=${bMin}-${bMax}`;
  }

  if (filters.minSurface || filters.maxSurface) {
    const sMin = filters.minSurface ?? 'min';
    const sMax = filters.maxSurface ?? 'max';
    url += `&square=${sMin}-${sMax}`;
  }

  if (filters.minLandSurface || filters.maxLandSurface) {
    const lMin = filters.minLandSurface ?? 'min';
    const lMax = filters.maxLandSurface ?? 'max';
    url += `&land_plot_surface=${lMin}-${lMax}`;
  }

  if (filters.furnished === 'meuble') {
    url += `&furnished=1`;
  } else if (filters.furnished === 'non_meuble') {
    url += `&furnished=2`;
  }

  console.log(`[LeBonCoin] Scraping: ${url}`);

  // Launch visible Chrome with persistent profile (cookies survive between runs)
  const browser = await puppeteer.launch({
    headless: false,
    userDataDir: CHROME_PROFILE_DIR,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1920,1080',
    ],
    defaultViewport: { width: 1920, height: 1080 },
  });

  let insertedCount = 0;

  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    // Check if we hit a captcha page
    const isCaptcha = await page.evaluate(() => {
      return document.title === 'leboncoin.fr' && document.body.innerHTML.includes('captcha-delivery');
    });

    if (isCaptcha) {
      console.log('[LeBonCoin] Captcha detected! Please solve it in the browser window. Waiting up to 120 seconds...');
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 120000 });
      console.log('[LeBonCoin] Captcha solved! Page navigated.');
      await new Promise(r => setTimeout(r, 3000));
    }

    // Wait for JS rendering
    await new Promise(r => setTimeout(r, 3000));

    // Try to accept cookie consent if present
    try {
      const consentBtn = await page.$('button#didomi-notice-agree-button, [aria-label="Accepter & Fermer"], button[class*="accept"]');
      if (consentBtn) {
        await consentBtn.click();
        await new Promise(r => setTimeout(r, 2000));
      }
    } catch { /* no consent banner */ }

    const db = getDb();
    const insert = db.prepare(`
      INSERT OR IGNORE INTO apartments (title, city, price, image, url, source, type, description)
      VALUES (?, ?, ?, ?, ?, 'leboncoin', 'Appartement', ?)
    `);
    const cleanCity = cityInfo ? cityInfo.name : cityName.charAt(0).toUpperCase() + cityName.slice(1).toLowerCase();

    let pageNum = 1;

    while (true) {
      // Wait for ad cards to appear
      await page.waitForSelector('[data-test-id="ad"][data-qa-id="aditem_container"]', { timeout: 15000 }).catch(() => {
        console.log(`[LeBonCoin] Page ${pageNum}: Could not find ad cards`);
      });

      // Debug: dump HTML and check selectors
      const debugHtml = await page.content();
      const debugDir = path.join(__dirname, '../../data');
      if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });
      fs.writeFileSync(path.join(debugDir, `leboncoin_debug_p${pageNum}.html`), debugHtml, 'utf-8');
      console.log(`[LeBonCoin] Page ${pageNum}: HTML size = ${debugHtml.length} chars`);

      const debugCounts = await page.evaluate(() => {
        return {
          adCards: document.querySelectorAll('[data-test-id="ad"][data-qa-id="aditem_container"]').length,
          adLinks: document.querySelectorAll('a.absolute.inset-0').length,
          prices: document.querySelectorAll('[data-test-id="price"]').length,
          allLinks: document.querySelectorAll('a[href*="/ad/"]').length,
          title: document.title,
          bodyLen: document.body.innerHTML.length,
        };
      });
      console.log(`[LeBonCoin] Page ${pageNum} debug:`, JSON.stringify(debugCounts));

      const listings = await page.evaluate(() => {
        const results: Array<{
          title: string;
          price: number;
          city: string;
          url: string;
          image: string;
          details: string;
        }> = [];

        const cards = document.querySelectorAll('[data-test-id="ad"][data-qa-id="aditem_container"]');

        cards.forEach((card: Element) => {
          try {
            // Find the ad link — use class-based selector to avoid apostrophe escaping issues
            const link = card.querySelector('a.absolute.inset-0') as HTMLAnchorElement | null;
            const href = link?.getAttribute('href') || '';
            if (!href) return;

            // Title is on a sibling span (not inside the <a>), with title="Voir l'annonce: ..."
            const titleSpan = card.querySelector('span[title^="Voir"]');
            const rawTitle = titleSpan?.getAttribute('title') || '';
            const title = rawTitle.replace(/^Voir l.annonce:\s*/i, '').trim();

            const priceEl = card.querySelector('[data-test-id="price"]');
            const priceText = priceEl?.textContent?.trim() || '0';
            const price = parseInt(priceText.replace(/[^0-9]/g, ''), 10) || 0;

            const locationEl = card.querySelector('[data-test-id="adcard-housing-location"] p');
            const cityText = locationEl?.textContent?.trim() || '';

            const imgEl = card.querySelector('img');
            const image = imgEl?.getAttribute('src') || '';
            const sourceEl = card.querySelector('source[type="image/avif"]');
            const betterImage = sourceEl?.getAttribute('srcset') || image;

            if (title) {
              results.push({
                title,
                price,
                city: cityText,
                url: href.startsWith('http') ? href : `https://www.leboncoin.fr${href}`,
                image: betterImage,
                details: '',
              });
            }
          } catch {
            // skip malformed card
          }
        });

        return results;
      });

      console.log(`[LeBonCoin] Page ${pageNum}: Found ${listings.length} listings`);

      if (listings.length === 0) break;

      // Insert into DB
      const insertMany = db.transaction((items: typeof listings) => {
        for (const item of items) {
          if (!item.city || item.city.includes('/')) {
            item.city = cleanCity;
          }
          const result = insert.run(item.title, item.city || filters.city, item.price, item.image, item.url, item.details);
          if (result.changes > 0) insertedCount++;
        }
      });
      insertMany(listings);

      // Try to go to next page
      const nextBtn = await page.$('a[aria-label="Page suivante"]');
      if (!nextBtn) {
        console.log('[LeBonCoin] No more pages.');
        break;
      }

      await nextBtn.click();
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 2000));
      pageNum++;
    }

    console.log(`[LeBonCoin] Total inserted: ${insertedCount} new listings across ${pageNum} pages`);
  } finally {
    await browser.close();
  }

  return insertedCount;
}
