import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import type {Browser, Page, PuppeteerLaunchOptions} from 'puppeteer';
import { anonymizeProxy } from 'proxy-chain';
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

  // Use proxy-chain to anonymize the proxy (handles auth transparently)
  if (proxyUrl) {
    const anonymizedUrl = await anonymizeProxy(proxyUrl);
    args.push(`--proxy-server=${anonymizedUrl}`);
    console.log(`[Browser] Using proxy via proxy-chain: ${new URL(proxyUrl).hostname}`);
  }

  const launchOptions: PuppeteerLaunchOptions = {
    headless: headless,
    userDataDir: CHROME_PROFILE_DIR,
    args,
    defaultViewport: { width: 1920, height: 1080 },
  };

  return await puppeteer.launch(launchOptions);
}

export async function setupPage(browser: Browser): Promise<Page> {
  const page = await browser.newPage();

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
