import puppeteer from 'puppeteer';
import { getDb } from '../database/schema';
import fs from 'fs';
import path from 'path';

const CHROME_PROFILE_DIR = path.resolve(__dirname, '../../data/chrome-profile');

// SeLoger uses POCOFR location codes
const CITY_LOCATIONS: Record<string, { code: string; name: string }> = {
  paris: { code: 'POCOFR10032', name: 'Paris' },
  lyon: { code: 'POCOFR5765', name: 'Lyon' },
  bordeaux: { code: 'POCOFR1938', name: 'Bordeaux' },
  toulouse: { code: 'POCOFR10290', name: 'Toulouse' },
  nantes: { code: 'POCOFR7223', name: 'Nantes' },
  marseille: { code: 'POCOFR6572', name: 'Marseille' },
  montpellier: { code: 'POCOFR6967', name: 'Montpellier' },
  lille: { code: 'POCOFR5584', name: 'Lille' },
  strasbourg: { code: 'POCOFR10068', name: 'Strasbourg' },
  rennes: { code: 'POCOFR8710', name: 'Rennes' },
  nice: { code: 'POCOFR7424', name: 'Nice' },
  grenoble: { code: 'POCOFR4537', name: 'Grenoble' },
  rouen: { code: 'POCOFR8952', name: 'Rouen' },
  toulon: { code: 'POCOFR10285', name: 'Toulon' },
  dijon: { code: 'POCOFR3298', name: 'Dijon' },
};

export interface SelogerFilters {
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
  furnished?: string;
}

export async function scrapeSeloger(filters: SelogerFilters): Promise<number> {
  const cityRaw = filters.city.trim();
  const match = cityRaw.match(/^([a-zA-ZÀ-ÿ-]+)\s*[_\s]?\s*(\d{5})?$/);
  const cityName = match ? match[1] : cityRaw;
  const cityLower = cityName.toLowerCase();
  const cityInfo = CITY_LOCATIONS[cityLower];

  const locationCode = cityInfo?.code || 'POCOFR1938';
  const cleanCity = cityInfo ? cityInfo.name : cityName.charAt(0).toUpperCase() + cityName.slice(1).toLowerCase();

  // Build estate types
  const typeMap: Record<string, string> = {
    appartement: 'Apartment',
    maison: 'House',
  };
  const types = filters.propertyTypes?.length
    ? filters.propertyTypes.map(t => typeMap[t] || t).filter(Boolean).join(',')
    : 'Apartment';

  // Build URL
  let url = `https://www.seloger.com/classified-search?distributionTypes=Rent&estateTypes=${encodeURIComponent(types)}&locations=${locationCode}`;

  if (filters.minPrice) url += `&priceMin=${filters.minPrice}`;
  if (filters.maxPrice) url += `&priceMax=${filters.maxPrice}`;
  if (filters.minRooms) url += `&numberOfRoomsMin=${filters.minRooms}`;
  if (filters.maxRooms) url += `&numberOfRoomsMax=${filters.maxRooms}`;
  if (filters.minBedrooms) url += `&numberOfBedroomsMin=${filters.minBedrooms}`;
  if (filters.maxBedrooms) url += `&numberOfBedroomsMax=${filters.maxBedrooms}`;
  if (filters.minSurface) url += `&spaceMin=${filters.minSurface}`;
  if (filters.maxSurface) url += `&spaceMax=${filters.maxSurface}`;

  console.log(`[SeLoger] Scraping: ${url}`);

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

    // Check for DataDome captcha
    const isCaptcha = await page.evaluate(() => {
      return document.body.innerHTML.includes('datadome') || document.body.innerHTML.includes('captcha');
    });

    if (isCaptcha) {
      console.log('[SeLoger] Captcha detected! Please solve it in the browser window. Waiting up to 120 seconds...');
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 120000 });
      console.log('[SeLoger] Captcha solved!');
      await new Promise(r => setTimeout(r, 3000));
    }

    // Wait for JS rendering
    await new Promise(r => setTimeout(r, 5000));

    // Accept cookies if present
    try {
      const consentBtn = await page.$('button#didomi-notice-agree-button, [aria-label="Accepter"], button[class*="accept"]');
      if (consentBtn) {
        await consentBtn.click();
        await new Promise(r => setTimeout(r, 2000));
      }
    } catch { /* no consent banner */ }

    const db = getDb();
    const insert = db.prepare(`
      INSERT OR IGNORE INTO apartments (title, city, price, image, url, source, type, description, surface, rooms, bedrooms)
      VALUES (?, ?, ?, ?, ?, 'seloger', ?, ?, ?, ?, ?)
    `);

    let pageNum = 1;

    while (true) {
      await new Promise(r => setTimeout(r, 2000));

      // Debug: dump HTML
      const debugHtml = await page.content();
      const debugDir = path.join(__dirname, '../../data');
      if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });
      fs.writeFileSync(path.join(debugDir, `seloger_debug_p${pageNum}.html`), debugHtml, 'utf-8');
      console.log(`[SeLoger] Page ${pageNum}: HTML size = ${debugHtml.length} chars`);

      // Debug counts
      const debugCounts = await page.evaluate(() => {
        return {
          cards: document.querySelectorAll('[data-testid="serp-core-classified-card-testid"]').length,
          coveringLinks: document.querySelectorAll('[data-testid="card-mfe-covering-link-testid"]').length,
          prices: document.querySelectorAll('[data-testid="cardmfe-price-testid"]').length,
          addresses: document.querySelectorAll('[data-testid="cardmfe-description-box-address"]').length,
        };
      });
      console.log(`[SeLoger] Page ${pageNum} debug:`, JSON.stringify(debugCounts));

      // Extract listings from rendered HTML using data-testid selectors
      const listings = await page.evaluate(() => {
        const results: Array<{
          title: string;
          price: number;
          city: string;
          url: string;
          image: string;
          type: string;
          description: string;
          surface: number;
          rooms: number;
          bedrooms: number;
        }> = [];

        const cards = document.querySelectorAll('[data-testid="serp-core-classified-card-testid"]');

        cards.forEach((card) => {
          try {
            // Link with all info in its title attribute
            const link = card.querySelector('[data-testid="card-mfe-covering-link-testid"]') as HTMLAnchorElement | null;
            if (!link) return;

            const href = link.getAttribute('href') || '';
            if (!href) return;
            // Clean URL: remove query params and hash from the listing URL
            const listingUrl = href.split('?')[0];

            // Parse title attribute: "Appartement à louer - Bordeaux - 1 026 € - 3 pièces, 2 chambres, 69,8 m², Étage 5/5"
            const titleAttr = link.getAttribute('title') || '';

            // Price from dedicated element
            const priceEl = card.querySelector('[data-testid="cardmfe-price-testid"]');
            const priceText = priceEl?.textContent?.trim() || '0';
            const price = parseInt(priceText.replace(/[^0-9]/g, ''), 10) || 0;

            // Address/city from dedicated element
            const addressEl = card.querySelector('[data-testid="cardmfe-description-box-address"]');
            const cityText = addressEl?.textContent?.trim() || '';

            // Key facts (rooms, bedrooms, surface) from dedicated element
            const keyfactsEl = card.querySelector('[data-testid="cardmfe-keyfacts-testid"]');
            const keyfactsText = keyfactsEl?.textContent?.trim() || '';

            // Parse rooms: "5 pièces·3 chambres" or similar
            const roomsMatch = keyfactsText.match(/(\d+)\s*pi[eè]ces?/i);
            const rooms = roomsMatch ? parseInt(roomsMatch[1], 10) : 0;

            const bedroomsMatch = keyfactsText.match(/(\d+)\s*chambres?/i);
            const bedrooms = bedroomsMatch ? parseInt(bedroomsMatch[1], 10) : 0;

            // Surface from title attribute: "69,8 m²"
            const surfaceMatch = titleAttr.match(/([\d,]+)\s*m²/);
            const surface = surfaceMatch ? parseFloat(surfaceMatch[1].replace(',', '.')) : 0;

            // Detect type from title
            let type = 'Appartement';
            if (titleAttr.toLowerCase().includes('maison')) type = 'Maison';
            else if (titleAttr.toLowerCase().includes('colocation')) type = 'Colocation';

            // Build a clean title from title attribute parts
            const titleParts = titleAttr.split(' - ');
            const title = titleParts.length > 0 ? titleParts[0].trim() : titleAttr;
            const fullTitle = titleParts.length >= 4
              ? `${titleParts[0].trim()} ${titleParts[3]?.trim() || ''}`
              : title;

            // Image: first <img> in the card's gallery
            const imgEl = card.querySelector('[data-testid="card-mfe-picture-box-gallery-test-id"] img') ||
              card.querySelector('[data-testid="cardmfe-picture-box-test-id"] img') ||
              card.querySelector('img[loading="lazy"]');
            const image = imgEl?.getAttribute('src') || '';

            if (href) {
              results.push({
                title: fullTitle || `${type} ${rooms}p ${surface}m²`,
                price,
                city: cityText,
                url: listingUrl.startsWith('http') ? listingUrl : `https://www.seloger.com${listingUrl}`,
                image,
                type,
                description: '',
                surface,
                rooms,
                bedrooms,
              });
            }
          } catch {
            // skip malformed card
          }
        });

        return results;
      });

      console.log(`[SeLoger] Page ${pageNum}: Found ${listings.length} listings`);

      if (listings.length === 0) break;

      // Insert into DB
      const insertMany = db.transaction((items: typeof listings) => {
        for (const item of items) {
          const city = item.city || cleanCity;
          const result = insert.run(
            item.title, city, item.price, item.image, item.url,
            item.type || 'Appartement', item.description,
            item.surface, item.rooms, item.bedrooms
          );
          if (result.changes > 0) insertedCount++;
        }
      });
      insertMany(listings);

      // Try next page: check for pagination button
      const nextPageUrl = await page.evaluate(() => {
        const nextBtn = document.querySelector('a[aria-label="Page suivante"], [data-testid*="pagination"] a[aria-label*="next"], [data-testid*="pagination"] a:last-child') as HTMLAnchorElement | null;
        return nextBtn?.getAttribute('href') || null;
      });

      if (!nextPageUrl) {
        console.log('[SeLoger] No more pages.');
        break;
      }

      const fullNextUrl = nextPageUrl.startsWith('http') ? nextPageUrl : `https://www.seloger.com${nextPageUrl}`;
      await page.goto(fullNextUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(r => setTimeout(r, 3000));
      pageNum++;
    }

    console.log(`[SeLoger] Total inserted: ${insertedCount} new listings across ${pageNum} pages`);
  } finally {
    await browser.close();
  }

  return insertedCount;
}
