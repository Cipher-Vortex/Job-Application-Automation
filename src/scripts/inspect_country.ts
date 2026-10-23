import { chromium } from "playwright";

async function inspectPhoneCountry() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage();
  await page.goto("https://job-boards.greenhouse.io/gitlab/jobs/8826965002", { waitUntil: "networkidle" });

  const input = await page.$("#country");
  if (input) {
    await input.click();
    await page.waitForTimeout(300);
    await input.fill("India");
    await page.waitForTimeout(500);

    const options = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("[class*='option'], [id*='-option-']")).map(o => ({
        id: o.id,
        className: o.className,
        text: o.textContent?.trim()
      }));
    });
    console.log("Country search options for 'India':", JSON.stringify(options, null, 2));
  }
  await browser.close();
}

inspectPhoneCountry();
