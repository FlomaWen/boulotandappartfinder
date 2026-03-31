import { createStealthBrowser, setupPage, randomDelay } from '../services/browser';
import { getDb } from '../database/schema';
import { execSync, spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';

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

function buildSearchUrl(filters: LeboncoinFilters): string {
  const cityRaw = filters.city.trim();
  const match = cityRaw.match(/^([a-zA-ZÀ-ÿ-]+)\s*[_\s]?\s*(\d{5})?$/);
  const cityName = match ? match[1] : cityRaw;
  const cityLower = cityName.toLowerCase();
  const cityInfo = CITY_POSTCODES[cityLower];
  const slug = cityLower.replace(/\s+/g, '-');
  const postcode = match?.[2] || cityInfo?.code || '';

  // LeBonCoin search URL for rentals (category 10 = locations immobilières)
  let url = `https://www.leboncoin.fr/recherche?category=10&locations=${slug}`;
  if (postcode) url += `_${postcode}`;

  if (filters.maxPrice) url += `&price=min-${filters.maxPrice}`;
  if (filters.minPrice && filters.maxPrice) url += `&price=${filters.minPrice}-${filters.maxPrice}`;
  else if (filters.minPrice) url += `&price=${filters.minPrice}-max`;

  if (filters.minRooms) url += `&rooms=${filters.minRooms}-max`;
  if (filters.minSurface) url += `&square=${filters.minSurface}-max`;

  if (filters.furnished === 'meuble') url += `&furnished=1`;
  else if (filters.furnished === 'non_meuble') url += `&furnished=2`;

  return url;
}

function startVnc(): ChildProcess | null {
  try {
    try { execSync('pkill x11vnc', { stdio: 'ignore' }); } catch {}
    const vnc = spawn('x11vnc', ['-display', ':99', '-nopw', '-forever', '-shared'], {
      stdio: 'ignore',
      detached: true,
    });
    vnc.unref();
    console.log('[LeBonCoin] x11vnc started on port 5900');
    return vnc;
  } catch (e) {
    console.log('[LeBonCoin] Failed to start x11vnc:', e);
    return null;
  }
}

function stopVnc(vnc: ChildProcess | null) {
  if (vnc) {
    try { process.kill(-vnc.pid!); } catch {}
  }
  try { execSync('pkill x11vnc', { stdio: 'ignore' }); } catch {}
  console.log('[LeBonCoin] x11vnc stopped');
}

/**
 * Opens a browser on leboncoin.fr so the user can solve the captcha manually via VNC.
 */
export async function solveLeboncoinCaptcha(): Promise<void> {
  console.log('[LeBonCoin] Opening browser for manual captcha solving...');
  console.log('[LeBonCoin] Connect via VNC on port 5900 to see the browser.');

  const vnc = startVnc();
  const browser = await createStealthBrowser({ headless: false });
  const page = await setupPage(browser);

  await page.goto('https://www.leboncoin.fr', { waitUntil: 'networkidle2', timeout: 60000 });

  console.log('[LeBonCoin] Browser opened. Solve the captcha via VNC if present.');
  console.log('[LeBonCoin] Waiting up to 5 minutes...');

  const maxWait = 5 * 60 * 1000;
  const start = Date.now();
  let solved = false;

  while (Date.now() - start < maxWait) {
    const cookies = await page.cookies();
    const dd = cookies.find(c => c.name === 'datadome');
    const url = page.url();
    if (dd && !url.includes('captcha-delivery.com')) {
      solved = true;
      break;
    }
    await new Promise(r => setTimeout(r, 2000));
  }

  if (solved) {
    console.log('[LeBonCoin] Session OK — captcha passed or not needed.');
  } else {
    console.log('[LeBonCoin] Timeout — captcha not solved in time.');
  }

  await browser.close();
  stopVnc(vnc);
}

export async function scrapeLeboncoin(filters: LeboncoinFilters): Promise<number> {
  const cityRaw = filters.city.trim();
  const match = cityRaw.match(/^([a-zA-ZÀ-ÿ-]+)\s*[_\s]?\s*(\d{5})?$/);
  const cityName = match ? match[1] : cityRaw;
  const cityInfo = CITY_POSTCODES[cityName.toLowerCase()];
  const cleanCity = cityInfo ? cityInfo.name : cityName.charAt(0).toUpperCase() + cityName.slice(1).toLowerCase();

  const searchUrl = buildSearchUrl(filters);
  console.log(`[LeBonCoin] Scraping: ${searchUrl}`);

  // Use non-headless so VNC can show the browser if captcha appears
  // No proxy for LeBonCoin — residential proxies get flagged by DataDome
  const browser = await createStealthBrowser({ headless: false, useProxy: false });
  let insertedCount = 0;
  let vnc: ChildProcess | null = null;

  try {
    const page = await setupPage(browser);
    await randomDelay(2000, 4000);
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 60000 });

    // Check for captcha
    const isCaptcha = await page.evaluate(() => {
      return document.body.innerHTML.includes('captcha-delivery') || document.body.innerHTML.includes('datadome');
    });
    if (isCaptcha) {
      console.log('[LeBonCoin] Captcha detected! Starting VNC on port 5900...');
      console.log('[LeBonCoin] Connect via VNC to solve the captcha, then scraping will continue.');
      vnc = startVnc();

      // Wait up to 3 minutes for user to solve captcha
      const maxWait = 3 * 60 * 1000;
      const start = Date.now();
      let solved = false;

      while (Date.now() - start < maxWait) {
        await new Promise(r => setTimeout(r, 3000));
        const stillCaptcha = await page.evaluate(() => {
          return document.body.innerHTML.includes('captcha-delivery') ||
            window.location.href.includes('captcha-delivery');
        });
        if (!stillCaptcha) {
          solved = true;
          break;
        }
      }

      if (!solved) {
        console.log('[LeBonCoin] Captcha not solved in time. Aborting.');
        stopVnc(vnc);
        return 0;
      }

      console.log('[LeBonCoin] Captcha solved! Continuing scrape...');
      // Navigate to search after captcha is solved
      await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    }

    // Accept cookies if present
    try {
      const consentBtn = await page.$('button#didomi-notice-agree-button, [aria-label="Accepter & Fermer"], button[id*="accept"]');
      if (consentBtn) {
        await consentBtn.click();
        await new Promise(r => setTimeout(r, 2000));
      }
    } catch { /* no consent banner */ }

    // Wait for content to render
    await new Promise(r => setTimeout(r, 5000));

    const db = getDb();
    const insert = db.prepare(`
      INSERT OR IGNORE INTO apartments (title, city, price, image, url, source, type, description)
      VALUES (?, ?, ?, ?, ?, 'leboncoin', 'Appartement', ?)
    `);

    let pageNum = 1;

    while (true) {
      // Debug: save HTML
      const html = await page.content();
      const debugDir = path.join(__dirname, '../../data');
      if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });
      fs.writeFileSync(path.join(debugDir, `leboncoin_debug_p${pageNum}.html`), html, 'utf-8');
      console.log(`[LeBonCoin] Page ${pageNum}: HTML size = ${html.length} chars`);

      // Extract listings from the page
      const listings = await page.evaluate(() => {
        const results: Array<{
          title: string;
          price: number;
          city: string;
          url: string;
          image: string;
          description: string;
        }> = [];

        // LeBonCoin uses <a> tags with data-test-id or class-based selectors for ad cards
        // Try multiple selector strategies
        const cards = document.querySelectorAll(
          '[data-test-id="ad"], [data-qa-id="aditem_container"], a[href*="/ad/"], article'
        );

        cards.forEach((card) => {
          try {
            const link = card.closest('a') || card.querySelector('a');
            const href = link?.getAttribute('href') || '';
            if (!href || !href.includes('/ad/')) return;

            const fullUrl = href.startsWith('http') ? href : `https://www.leboncoin.fr${href}`;

            // Title
            const titleEl = card.querySelector('[data-test-id="ad-subject"], h2, p[data-qa-id="aditem_title"], [class*="title"]');
            const title = titleEl?.textContent?.trim() || '';

            // Price
            const priceEl = card.querySelector('[data-test-id="ad-price"], span[data-qa-id="aditem_price"], [class*="price"]');
            const priceText = priceEl?.textContent?.trim() || '0';
            const price = parseInt(priceText.replace(/[^0-9]/g, ''), 10) || 0;

            // City/location
            const cityEl = card.querySelector('[data-test-id="ad-location"], p[data-qa-id="aditem_location"], [class*="location"]');
            const cityText = cityEl?.textContent?.trim() || '';

            // Image
            const imgEl = card.querySelector('img');
            const image = imgEl?.getAttribute('src') || imgEl?.getAttribute('data-src') || '';

            // Description snippet
            const descEl = card.querySelector('[data-test-id="ad-description"], [class*="description"]');
            const description = descEl?.textContent?.trim() || '';

            if (title || price) {
              results.push({ title, price, city: cityText, url: fullUrl, image, description });
            }
          } catch {
            // skip malformed card
          }
        });

        return results;
      });

      console.log(`[LeBonCoin] Page ${pageNum}: Found ${listings.length} listings`);

      if (listings.length === 0) break;

      const insertMany = db.transaction((items: typeof listings) => {
        for (const item of items) {
          const city = item.city || cleanCity;
          const result = insert.run(item.title, city, item.price, item.image, item.url, item.description);
          if (result.changes > 0) insertedCount++;
        }
      });
      insertMany(listings);

      // Try next page
      const nextPageUrl = await page.evaluate(() => {
        const nextBtn = document.querySelector('a[aria-label="Page suivante"], [data-spark-component="pagination"] a:last-child, a[title="Page suivante"]') as HTMLAnchorElement | null;
        return nextBtn?.getAttribute('href') || null;
      });

      if (!nextPageUrl) {
        console.log('[LeBonCoin] No more pages.');
        break;
      }

      const fullNextUrl = nextPageUrl.startsWith('http') ? nextPageUrl : `https://www.leboncoin.fr${nextPageUrl}`;
      await page.goto(fullNextUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      await randomDelay(3000, 7000);
      pageNum++;
    }

    console.log(`[LeBonCoin] Total inserted: ${insertedCount} new listings`);
  } finally {
    await browser.close();
    if (vnc) stopVnc(vnc);
  }

  return insertedCount;
}
