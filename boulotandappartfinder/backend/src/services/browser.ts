import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import type { Browser, Page, PuppeteerLaunchOptions } from 'puppeteer';
import path from 'path';

// Apply stealth plugin
puppeteer.use(StealthPlugin());

const CHROME_PROFILE_DIR = path.resolve(__dirname, '../../data/chrome-profile');

export interface BrowserConfig {
  headless?: boolean;
  useProxy?: boolean;
}

function getProxyUrl(): string | null {
  return process.env.PROXY_URL || null;
}

export async function createStealthBrowser(config: BrowserConfig = {}): Promise<Browser> {
  const { headless = true, useProxy = true } = config;
  const proxyUrl = useProxy ? getProxyUrl() : null;

  const args = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-blink-features=AutomationControlled',
    '--window-size=1920,1080',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--disable-gpu',
  ];

  // Add proxy if configured
  if (proxyUrl) {
    const url = new URL(proxyUrl);
    const proxyServer = `${url.protocol}//${url.hostname}:${url.port}`;
    args.push(`--proxy-server=${proxyServer}`);
    console.log(`[Browser] Using proxy: ${url.hostname}:${url.port}`);
  }

  const launchOptions: PuppeteerLaunchOptions = {
    headless: headless ? true : false,
    userDataDir: CHROME_PROFILE_DIR,
    args,
    defaultViewport: { width: 1920, height: 1080 },
  };

  const browser = await puppeteer.launch(launchOptions);
  return browser;
}

export async function setupPage(browser: Browser): Promise<Page> {
  const page = await browser.newPage();
  const proxyUrl = getProxyUrl();

  // Set up proxy authentication if needed
  if (proxyUrl) {
    const url = new URL(proxyUrl);
    if (url.username && url.password) {
      await page.authenticate({
        username: decodeURIComponent(url.username),
        password: decodeURIComponent(url.password),
      });
    }
  }

  // Set realistic user agent
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
  );

  // Set extra headers
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
  });

  return page;
}

export async function randomDelay(min = 1000, max = 3000): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1) + min);
  await new Promise(r => setTimeout(r, delay));
}
