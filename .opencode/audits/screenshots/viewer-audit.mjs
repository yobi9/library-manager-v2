import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const DIR = 'C:/projects/library-manager-v2/screenshots/viewer-audit';
mkdirSync(DIR, { recursive: true });

const VIEWER_PAGES = [
  { name: 'home', path: '/' },
  { name: 'genre-list', path: '/genre' },
  { name: 'genre-items', path: '/genre/افلام' },
  { name: 'new', path: '/new' },
  { name: 'sections', path: '/sections' },
  { name: 'person-list', path: '/person' },
  { name: 'rating-list', path: '/rating' },
  { name: 'certification-list', path: '/certification' },
  { name: 'year-list', path: '/year' },
  { name: 'watch-later', path: '/watch-later' },
  { name: 'item-detail-movie', path: '/itemView/movie/117325' },
  { name: 'item-detail-series', path: '/itemView/collection/117331' },
  { name: 'library-items', path: '/items/2' },
  { name: 'live-stream', path: '/liveStream' },
];

const VIEWPORT_DESKTOP = { width: 1440, height: 900 };
const VIEWPORT_MOBILE = { width: 390, height: 844 };

async function capturePage(browser, pageConfig, theme, viewport, suffix) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  
  try {
    await page.goto(`http://localhost:4000${pageConfig.path}`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    
    if (theme === 'light') {
      await page.evaluate(() => document.documentElement.classList.remove('dark'));
      await page.waitForTimeout(500);
    }
    
    const filename = `${theme}-${pageConfig.name}-${suffix}`;
    await page.screenshot({ path: `${DIR}/${filename}.png`, fullPage: false });
    console.log(`  ✓ ${filename}.png`);
    
    if (suffix === 'viewport') {
      const fullFilename = `${theme}-${pageConfig.name}-fullpage`;
      await page.screenshot({ path: `${DIR}/${fullFilename}.png`, fullPage: true });
      console.log(`  ✓ ${fullFilename}.png`);
    }
  } catch (e) {
    console.log(`  ✗ ${theme}-${pageConfig.name}-${suffix}: ${e.message}`);
  } finally {
    await ctx.close();
  }
}

const browser = await chromium.launch({ headless: true });

console.log('=== DARK THEME — Desktop ===');
for (const pg of VIEWER_PAGES) {
  await capturePage(browser, pg, 'dark', VIEWPORT_DESKTOP, 'viewport');
}

console.log('\n=== LIGHT THEME — Desktop ===');
for (const pg of VIEWER_PAGES) {
  await capturePage(browser, pg, 'light', VIEWPORT_DESKTOP, 'viewport');
}

console.log('\n=== DARK THEME — Mobile ===');
for (const pg of VIEWER_PAGES) {
  await capturePage(browser, pg, 'dark', VIEWPORT_MOBILE, 'mobile');
}

console.log('\n=== LIGHT THEME — Mobile ===');
for (const pg of VIEWER_PAGES) {
  await capturePage(browser, pg, 'light', VIEWPORT_MOBILE, 'mobile');
}

await browser.close();
console.log('\n=== DONE ===');
