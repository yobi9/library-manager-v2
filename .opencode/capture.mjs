import { chromium } from "playwright";

const dir = "C:\\Users\\ADMINI~1\\AppData\\Local\\Temp\\opencode\\screenshots";

const pages = [
  { name: "home-light", url: "http://localhost:4000", theme: "light" },
  { name: "home-dark", url: "http://localhost:4000", theme: "dark" },
  { name: "detail-light", url: "http://localhost:4000/itemView/movie/103695", theme: "light" },
  { name: "detail-dark", url: "http://localhost:4000/itemView/movie/103695", theme: "dark" },
];

async function run() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();

  for (const p of pages) {
    await page.goto(p.url, { waitUntil: "networkidle", timeout: 30000 });
    await page.evaluate((t) => {
      localStorage.setItem("theme", t);
      document.documentElement.classList.remove("light", "dark");
      document.documentElement.classList.add(t);
    }, p.theme);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${dir}\\${p.name}.png`, fullPage: false });
    console.log(`✓ ${p.name}`);
  }

  await browser.close();
  console.log("Done.");
}

run().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});
