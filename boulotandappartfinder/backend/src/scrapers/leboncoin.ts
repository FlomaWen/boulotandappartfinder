import { createStealthBrowser, setupPage, randomDelay } from '../services/browser';
import { getDb } from '../database/schema';
import fs from 'fs';
import path from 'path';
import { Solver } from '2captcha-ts';

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

/**
 * Manually solve captcha — now just navigates to LeBonCoin with proxy
 * and lets 2Captcha handle any DataDome challenge automatically.
 */
export async function solveLeboncoinCaptcha(): Promise<void> {
  console.log('[LeBonCoin] Opening browser to warm up session + solve captcha via 2Captcha...');
  const browser = await createStealthBrowser({ headless: false, useProxy: true });
  const page = await setupPage(browser);

  await page.goto('https://www.leboncoin.fr', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await solveDataDomeCaptcha(page, 'https://www.leboncoin.fr');

  console.log('[LeBonCoin] Session warmed up. Chrome profile saved for next scrape.');
  await browser.close();
}

async function solveDataDomeCaptcha(page: any, pageUrl: string): Promise<boolean | null> {
  const html = await page.content();
  const isCaptcha =
    html.includes('captcha-delivery') || html.includes('datadome') || html.includes('geo.captcha-delivery.com');

  if (!isCaptcha) return null; // no captcha, continue

  console.log('[LeBonCoin] DataDome captcha detected — solving via 2Captcha...');

  const apiKey = process.env.TWOCAPTCHA_API_KEY;
  if (!apiKey) {
    console.error('[LeBonCoin] TWOCAPTCHA_API_KEY not set in .env');
    return false;
  }

  const solver = new Solver(apiKey);

  // Extract the DataDome captcha URL from the page
  const captchaUrl = await page.evaluate(() => {
    // DataDome redirects to an iframe or geo.captcha-delivery.com
    const iframe = document.querySelector('iframe[src*="captcha-delivery"]') as HTMLIFrameElement | null;
    if (iframe) return iframe.src;
    // Sometimes it's the current URL itself
    if (window.location.href.includes('captcha-delivery')) return window.location.href;
    return null;
  });

  if (!captchaUrl) {
    console.log('[LeBonCoin] Could not find captcha URL in page');
    return false;
  }

  console.log(`[LeBonCoin] Captcha URL: ${captchaUrl}`);

  // Get DataDome cookie from browser
  const cookies = await page.cookies();
  const ddCookie = cookies.find((c: any) => c.name === 'datadome');
  const userAgent = await page.evaluate(() => navigator.userAgent);

  try {
    // Format proxy from http://user:pass@host:port to user:pass@host:port
    const rawProxy = process.env.PROXY_URL || '';
    const proxy = rawProxy.replace(/^https?:\/\//, '');

    const result = await solver.dataDome({
      pageurl: pageUrl,
      captcha_url: captchaUrl,
      userAgent: userAgent,
      proxy: proxy,
      proxytype: 'http',
    });

    console.log('[LeBonCoin] 2Captcha solved! Applying cookie...');

    // The response contains a cookie value to set
    if (result.data) {
      const cookieValue = result.data;
      // Set the datadome cookie with the solved value
      await page.setCookie({
        name: 'datadome',
        value: cookieValue,
        domain: '.leboncoin.fr',
        path: '/',
      });

      // Reload the page with the valid cookie
      await randomDelay(1000, 2000);
      await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

      // Verify captcha is gone
      const stillCaptcha = await page.evaluate(() => {
        return (
          document.body.innerHTML.includes('captcha-delivery') ||
          window.location.href.includes('captcha-delivery')
        );
      });

      if (stillCaptcha) {
        console.log('[LeBonCoin] Captcha still present after 2Captcha solve — retrying...');
        return solveDataDomeCaptcha(page, pageUrl);
      }

      console.log('[LeBonCoin] Captcha solved successfully!');
      return true;
    }
  } catch (err: any) {
    console.error('[LeBonCoin] 2Captcha error:', err.message || err);
    return false;
  }

  return false;
}

export async function scrapeLeboncoin(filters: LeboncoinFilters): Promise<number> {
  const cityRaw = filters.city.trim();
  const match = cityRaw.match(/^([a-zA-ZÀ-ÿ-]+)\s*[_\s]?\s*(\d{5})?$/);
  const cityName = match ? match[1] : cityRaw;
  const cityInfo = CITY_POSTCODES[cityName.toLowerCase()];
  const cleanCity = cityInfo ? cityInfo.name : cityName.charAt(0).toUpperCase() + cityName.slice(1).toLowerCase();

  const searchUrl = buildSearchUrl(filters);
  console.log(`[LeBonCoin] Scraping: ${searchUrl}`);
  // Try with proxy first, fallback without proxy if it times out
  let browser!: Awaited<ReturnType<typeof createStealthBrowser>>;
  let insertedCount = 0;

  try {
    try {
      console.log('[LeBonCoin] Attempting with residential proxy...');
      browser = await createStealthBrowser({ headless: false, useProxy: true });
    } catch (browserErr: any) {
      console.error(`[LeBonCoin] Failed to launch browser: ${browserErr.message}`);
      throw browserErr;
    }
    let page = await setupPage(browser);
    console.log('[LeBonCoin] Browser ready, waiting before navigation...');
    await randomDelay(2000, 4000);

    let loaded = false;
    try {
      console.log('[LeBonCoin] Navigating to search page (timeout: 120s)...');
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
      loaded = true;
    } catch (navErr: any) {
      console.log(`[LeBonCoin] Proxy navigation failed: ${navErr.message}`);
    }

    if (!loaded) {
      console.log('[LeBonCoin] Retrying without proxy...');
      await browser.close();
      browser = await createStealthBrowser({ headless: false, useProxy: false });
      page = await setupPage(browser);
      await randomDelay(2000, 4000);
      console.log('[LeBonCoin] Navigating without proxy (timeout: 120s)...');
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
    }

    console.log('[LeBonCoin] Page loaded successfully.');

    // Check for captcha and solve automatically via 2Captcha
    const captchaResolved = await solveDataDomeCaptcha(page, searchUrl);
    if (captchaResolved === false) {
      console.log('[LeBonCoin] Could not solve captcha. Aborting.');
      return 0;
    }

    // Accept cookies if present
    try {
      const consentBtn = await page.$('button#didomi-notice-agree-button, [aria-label="Accepter & Fermer"], button[id*="accept"]');
      if (consentBtn) {
        console.log('[LeBonCoin] Accepting cookies...');
        await consentBtn.click();
        await new Promise(r => setTimeout(r, 2000));
      }
    } catch { /* no consent banner */ }

    // Wait for ad cards to render (LeBonCoin is a JS-heavy SPA)
    console.log('[LeBonCoin] Waiting for ad cards to render...');
    try {
      await page.waitForSelector('[data-test-id="ad"]', { timeout: 30000 });
      console.log('[LeBonCoin] Ad cards detected!');
    } catch {
      console.log('[LeBonCoin] No ad cards found after 30s, continuing anyway...');
    }
    await new Promise(r => setTimeout(r, 2000));

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

        // Each ad card is a [data-test-id="ad"] container
        const cards = document.querySelectorAll('[data-test-id="ad"]');

        cards.forEach((card) => {
          try {
            // Link: <a aria-label="Voir l'annonce" href="/ad/locations/...">
            const link = card.querySelector('a[aria-label="Voir l\'annonce"]') as HTMLAnchorElement | null;
            const href = link?.getAttribute('href') || '';
            if (!href || !href.includes('/ad/')) return;

            const fullUrl = `https://www.leboncoin.fr${href}`;

            // Price: <p data-test-id="price"><span>1 125&nbsp;€</span></p>
            const priceEl = card.querySelector('[data-test-id="price"] span');
            const priceText = priceEl?.textContent?.trim() || '0';
            const price = parseInt(priceText.replace(/[^0-9]/g, ''), 10) || 0;

            // Title/description: "Appartement · 2 pièces · 56m²" in <p class="text-body-2 font-bold">
            const titleEl = card.querySelector('p.text-body-2.font-bold');
            const title = titleEl?.textContent?.trim() || '';

            // Location: <p aria-hidden="true"> inside [data-test-id="adcard-housing-location"]
            const cityEl = card.querySelector('[data-test-id="adcard-housing-location"] p[aria-hidden="true"]');
            const cityText = cityEl?.textContent?.trim() || '';

            // Image: first <img> with a real src (skip SVG data URIs)
            const imgs = Array.from(card.querySelectorAll('img'));
            let image = '';
            for (const img of imgs) {
              const src = img.getAttribute('src') || '';
              if (src && !src.startsWith('data:')) {
                image = src;
                break;
              }
            }

            if (title || price) {
              results.push({ title, price, city: cityText, url: fullUrl, image, description: title });
            }
          } catch {
            // skip malformed card
          }
        });

        return results;
      });

      console.log(`[LeBonCoin] Page ${pageNum}: Found ${listings.length} listings`);

      if (listings.length === 0) {
        console.log(`[LeBonCoin] Page ${pageNum}: No listings found — stopping.`);
        break;
      }

      for (let i = 0; i < listings.length; i++) {
        const item = listings[i];
        const city = item.city || cleanCity;
        const result = insert.run(item.title, city, item.price, item.image, item.url, item.description);
        const status = result.changes > 0 ? 'NEW' : 'already exists';
        console.log(`[LeBonCoin] Page ${pageNum} | Annonce ${i + 1}/${listings.length}: ${item.price}€ — ${item.title} (${city}) [${status}]`);
        if (result.changes > 0) insertedCount++;
      }

      // Try next page
      const nextPageUrl = await page.evaluate(() => {
        const nextBtn = document.querySelector('a[aria-label="Page suivante"], [data-spark-component="pagination"] a:last-child, a[title="Page suivante"]') as HTMLAnchorElement | null;
        return nextBtn?.getAttribute('href') || null;
      });

      if (!nextPageUrl) {
        console.log(`[LeBonCoin] No more pages after page ${pageNum}.`);
        break;
      }

      const fullNextUrl = nextPageUrl.startsWith('http') ? nextPageUrl : `https://www.leboncoin.fr${nextPageUrl}`;
      console.log(`[LeBonCoin] Navigating to page ${pageNum + 1}...`);
      await page.goto(fullNextUrl, { waitUntil: 'domcontentloaded', timeout: 0 });
      await randomDelay(3000, 7000);
      pageNum++;
    }

    console.log(`[LeBonCoin] Total inserted: ${insertedCount} new listings`);
  } catch (err: any) {
    console.error(`[LeBonCoin] Error: ${err.message}`);
    throw err;
  } finally {
    try { await browser?.close(); } catch {}
  }

  return insertedCount;
}
