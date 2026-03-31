import { getDb } from '../database/schema';
import { ProxyAgent } from 'undici';
import { createStealthBrowser, setupPage } from '../services/browser';
import { execSync, spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';

const LBC_API_URL = 'https://api.leboncoin.fr/finder/search';
const LBC_API_KEY = 'ba0c2dad52b3ec';
const COOKIE_FILE = path.resolve(__dirname, '../../data/leboncoin-cookies.json');

function getProxyDispatcher(): ProxyAgent | undefined {
  const proxyUrl = process.env.PROXY_URL;
  if (!proxyUrl) return undefined;
  return new ProxyAgent(proxyUrl);
}

function loadDatadomeCookie(): string | null {
  try {
    if (!fs.existsSync(COOKIE_FILE)) return null;
    const cookies = JSON.parse(fs.readFileSync(COOKIE_FILE, 'utf-8'));
    const dd = cookies.find((c: any) => c.name === 'datadome');
    if (!dd) return null;
    // Check expiry
    if (dd.expires && dd.expires < Date.now() / 1000) {
      console.log('[LeBonCoin API] datadome cookie expired');
      return null;
    }
    console.log('[LeBonCoin API] Using saved datadome cookie');
    return dd.value;
  } catch (e) {
    console.log('[LeBonCoin API] Failed to load cookies:', e);
    return null;
  }
}

function startVnc(): ChildProcess | null {
  try {
    // Kill any existing x11vnc
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
 * Once solved, saves all cookies to a file for reuse by the API scraper.
 */
export async function solveLeboncoinCaptcha(): Promise<void> {
  console.log('[LeBonCoin] Opening browser for manual captcha solving...');
  console.log('[LeBonCoin] Connect via VNC on port 5900 to see the browser.');

  const vnc = startVnc();
  const browser = await createStealthBrowser({ headless: false });
  const page = await setupPage(browser);

  await page.goto('https://www.leboncoin.fr', { waitUntil: 'networkidle2', timeout: 60000 });

  console.log('[LeBonCoin] Browser opened on leboncoin.fr. Solve the captcha via VNC.');
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
    const cookies = await page.cookies();
    fs.mkdirSync(path.dirname(COOKIE_FILE), { recursive: true });
    fs.writeFileSync(COOKIE_FILE, JSON.stringify(cookies, null, 2));
    console.log(`[LeBonCoin] Cookies saved! (${cookies.length} cookies)`);
  } else {
    console.log('[LeBonCoin] Timeout - captcha not solved in time');
  }

  await browser.close();
  stopVnc(vnc);
}

const CITY_POSTCODES: Record<string, { name: string; code: string; department_id: string; region_id: string }> = {
  paris: { name: 'Paris', code: '75000', department_id: '75', region_id: '12' },
  lyon: { name: 'Lyon', code: '69000', department_id: '69', region_id: '1' },
  bordeaux: { name: 'Bordeaux', code: '33000', department_id: '33', region_id: '2' },
  toulouse: { name: 'Toulouse', code: '31000', department_id: '31', region_id: '16' },
  nantes: { name: 'Nantes', code: '44000', department_id: '44', region_id: '18' },
  marseille: { name: 'Marseille', code: '13000', department_id: '13', region_id: '21' },
  montpellier: { name: 'Montpellier', code: '34000', department_id: '34', region_id: '13' },
  lille: { name: 'Lille', code: '59000', department_id: '59', region_id: '17' },
  strasbourg: { name: 'Strasbourg', code: '67000', department_id: '67', region_id: '1' },
  rennes: { name: 'Rennes', code: '35000', department_id: '35', region_id: '3' },
  nice: { name: 'Nice', code: '06000', department_id: '6', region_id: '21' },
  grenoble: { name: 'Grenoble', code: '38000', department_id: '38', region_id: '1' },
  rouen: { name: 'Rouen', code: '76000', department_id: '76', region_id: '17' },
  toulon: { name: 'Toulon', code: '83000', department_id: '83', region_id: '21' },
  dijon: { name: 'Dijon', code: '21000', department_id: '21', region_id: '4' },
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

function buildApiPayload(filters: LeboncoinFilters, offset = 0) {
  const cityRaw = filters.city.trim();
  const match = cityRaw.match(/^([a-zA-ZÀ-ÿ-]+)\s*[_\s]?\s*(\d{5})?$/);
  const cityName = match ? match[1] : cityRaw;
  const explicitPostcode = match ? match[2] : undefined;
  const cityLower = cityName.toLowerCase();
  const cityInfo = CITY_POSTCODES[cityLower];

  const displayName = cityInfo ? cityInfo.name : cityName.charAt(0).toUpperCase() + cityName.slice(1).toLowerCase();
  const zipcode = explicitPostcode || cityInfo?.code || '';

  // Build location
  const location: any = {
    locationType: 'city',
    label: `${displayName} (${zipcode})`,
    city: displayName,
    zipcode,
  };
  if (cityInfo) {
    location.department_id = cityInfo.department_id;
    location.region_id = cityInfo.region_id;
  }

  // Build real estate types
  const types = filters.propertyTypes?.length
    ? filters.propertyTypes
    : ['appartement', '2'];

  // Build ranges
  const ranges: any = {};
  if (filters.minPrice || filters.maxPrice) {
    ranges.price = {};
    if (filters.minPrice) ranges.price.min = filters.minPrice;
    if (filters.maxPrice) ranges.price.max = filters.maxPrice;
  }
  if (filters.minRooms || filters.maxRooms) {
    ranges.rooms = {};
    if (filters.minRooms) ranges.rooms.min = filters.minRooms;
    if (filters.maxRooms) ranges.rooms.max = filters.maxRooms;
  }
  if (filters.minBedrooms || filters.maxBedrooms) {
    ranges.bedrooms = {};
    if (filters.minBedrooms) ranges.bedrooms.min = filters.minBedrooms;
    if (filters.maxBedrooms) ranges.bedrooms.max = filters.maxBedrooms;
  }
  if (filters.minSurface || filters.maxSurface) {
    ranges.square = {};
    if (filters.minSurface) ranges.square.min = filters.minSurface;
    if (filters.maxSurface) ranges.square.max = filters.maxSurface;
  }
  if (filters.minLandSurface || filters.maxLandSurface) {
    ranges.land_plot_surface = {};
    if (filters.minLandSurface) ranges.land_plot_surface.min = filters.minLandSurface;
    if (filters.maxLandSurface) ranges.land_plot_surface.max = filters.maxLandSurface;
  }

  const enums: any = {
    ad_type: ['offer'],
    real_estate_type: types,
  };
  if (filters.furnished === 'meuble') {
    enums.furnished = ['1'];
  } else if (filters.furnished === 'non_meuble') {
    enums.furnished = ['2'];
  }

  return {
    filters: {
      enums,
      category: { id: '10' },
      location: { locations: [location] },
      ranges,
    },
    sort_by: 'relevance',
    limit: 35,
    limit_alu: 0,
    offset,
  };
}

export async function scrapeLeboncoin(filters: LeboncoinFilters): Promise<number> {
  const cityRaw = filters.city.trim();
  const match = cityRaw.match(/^([a-zA-ZÀ-ÿ-]+)\s*[_\s]?\s*(\d{5})?$/);
  const cityName = match ? match[1] : cityRaw;
  const cityInfo = CITY_POSTCODES[cityName.toLowerCase()];
  const cleanCity = cityInfo ? cityInfo.name : cityName.charAt(0).toUpperCase() + cityName.slice(1).toLowerCase();

  console.log(`[LeBonCoin API] Searching apartments in ${cleanCity}...`);

  const db = getDb();
  const insert = db.prepare(`
    INSERT OR IGNORE INTO apartments (title, city, price, image, url, source, type, description)
    VALUES (?, ?, ?, ?, ?, 'leboncoin', 'Appartement', ?)
  `);

  let insertedCount = 0;
  let offset = 0;
  let pageNum = 1;

  while (true) {
    const payload = buildApiPayload(filters, offset);

    console.log(`[LeBonCoin API] Page ${pageNum} (offset ${offset})...`);

    const dispatcher = getProxyDispatcher();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'api_key': LBC_API_KEY,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Origin': 'https://www.leboncoin.fr',
      'Referer': 'https://www.leboncoin.fr/',
      'Accept': '*/*',
      'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
    };

    // Attach datadome cookie if available
    const ddCookie = loadDatadomeCookie();
    if (ddCookie) {
      headers['Cookie'] = `datadome=${ddCookie}`;
    }

    const fetchOptions: any = {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    };
    if (dispatcher) {
      fetchOptions.dispatcher = dispatcher;
      console.log(`[LeBonCoin API] Using proxy: ${process.env.PROXY_URL?.replace(/:[^:@]+@/, ':***@')}`);
    }
    const response = await fetch(LBC_API_URL, fetchOptions);

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      console.log(`[LeBonCoin API] Error ${response.status}: ${response.statusText}`);
      const headers: Record<string, string> = {};
      response.headers.forEach((v, k) => { headers[k] = v; });
      console.log(`[LeBonCoin API] Response headers:`, JSON.stringify(headers));
      console.log(`[LeBonCoin API] Response body (first 500 chars):`, errorBody.slice(0, 500));
      break;
    }

    const rawText = await response.text();
    console.log(`[LeBonCoin API] Response status: ${response.status}`);
    console.log(`[LeBonCoin API] Response body (first 500 chars):`, rawText.slice(0, 500));

    const data = JSON.parse(rawText);
    const ads = data.ads || [];
    console.log(`[LeBonCoin API] Page ${pageNum}: ${ads.length} ads (total: ${data.total || 0}, keys: ${Object.keys(data).join(',')})`);


    if (ads.length === 0) break;

    const insertMany = db.transaction((items: any[]) => {
      for (const ad of items) {
        const title = ad.subject || '';
        const price = ad.price?.[0] || 0;
        const city = ad.location?.city || cleanCity;
        const url = ad.url || `https://www.leboncoin.fr/ad/immobilier/${ad.list_id}`;
        const image = ad.images?.urls?.[0] || ad.images?.thumb_url || '';
        const description = ad.body || '';

        const result = insert.run(title, city, price, image, url, description);
        if (result.changes > 0) insertedCount++;
      }
    });
    insertMany(ads);

    // Check if there are more pages
    const total = data.total || 0;
    offset += ads.length;
    if (offset >= total || ads.length < 35) {
      console.log(`[LeBonCoin API] No more pages (total: ${total}).`);
      break;
    }

    pageNum++;
    // Small delay between requests
    await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000));
  }

  console.log(`[LeBonCoin API] Total inserted: ${insertedCount} new listings`);
  return insertedCount;
}
