import { chromium, Browser, BrowserContext, Page } from "playwright";
import { TRUTH_PROFILE } from "../config/truthProfile";
import fs from "fs";
import path from "path";

export interface PrefillOptions {
  headless?: boolean;
  coverLetter?: string;
}

export async function prefillApplication(jobUrl: string, resumePath?: string, options: PrefillOptions = {}) {
  const isHeadless = options.headless ?? false;
  console.log(`[FormFiller] Launching browser (headless: ${isHeadless}) for ${jobUrl}`);

  let browser: Browser;
  try {
    browser = await chromium.launch({
      headless: isHeadless,
      channel: "chrome",
      args: ["--start-maximized", "--disable-blink-features=AutomationControlled"]
    });
  } catch {
    try {
      browser = await chromium.launch({
        headless: isHeadless,
        channel: "msedge",
        args: ["--start-maximized", "--disable-blink-features=AutomationControlled"]
      });
    } catch {
      browser = await chromium.launch({
        headless: isHeadless,
        args: ["--start-maximized", "--disable-blink-features=AutomationControlled"]
      });
    }
  }

  const context: BrowserContext = await browser.newContext({
    viewport: null
  });

  const page: Page = await context.newPage();

  console.log(`[FormFiller] Navigating to: ${jobUrl}`);
  try {
    await page.goto(jobUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  } catch (err: any) {
    console.warn(`[FormFiller] Navigation warning: ${err.message}`);
  }

  // Intelligent field filling for standard ATS inputs
  const fillField = async (selectors: string[], value: string) => {
    for (const sel of selectors) {
      try {
        const el = await page.$(sel);
        if (el && await el.isVisible()) {
          await el.fill(value);
          return true;
        }
      } catch {
        // Continue to next selector
      }
    }
    return false;
  };

  // 1. Resume Upload (if input[type="file"] exists, upload first so any parser finishes)
  if (resumePath && fs.existsSync(resumePath)) {
    try {
      const fileInput = await page.$('input[type="file"][id*="resume" i], input[type="file"]');
      if (fileInput) {
        await fileInput.setInputFiles(path.resolve(resumePath));
        console.log(`[FormFiller] Resume attached successfully from ${resumePath}`);
        // Brief pause to allow ATS auto-fill/upload events to settle
        await page.waitForTimeout(1500);
      }
    } catch (err: any) {
      console.warn(`[FormFiller] Could not attach file: ${err.message}`);
    }
  }

  // 2. Name handling (first name, last name, full name)
  const nameParts = TRUTH_PROFILE.candidate.name.split(" ");
  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(" ") || firstName;

  await fillField(['#first_name', 'input[id="first_name"]', 'input[name="first_name"]', 'input[aria-label*="first name" i]'], firstName);
  await fillField(['#last_name', 'input[id="last_name"]', 'input[name="last_name"]', 'input[aria-label*="last name" i]'], lastName);
  await fillField(['#name', 'input[id="name"]', 'input[name="name"]', 'input[placeholder*="Full Name" i]'], TRUTH_PROFILE.candidate.name);

  // 3. Contact & Location
  await fillField(['#email', 'input[id="email"]', 'input[type="email"]', 'input[name*="email" i]'], TRUTH_PROFILE.candidate.email);
  await fillField(['#phone', 'input[id="phone"]', 'input[type="tel"]', 'input[name*="phone" i]'], TRUTH_PROFILE.candidate.phone);
  await fillField(['input[id="candidate-location"]', 'input[name*="location" i]', 'input[placeholder*="Location" i]'], TRUTH_PROFILE.candidate.location);

  // 4. Socials and Portfolios
  await fillField(['input[aria-label*="linkedin" i]', 'input[id*="linkedin" i]', 'input[name*="linkedin" i]'], TRUTH_PROFILE.candidate.linkedin);
  await fillField(['input[aria-label*="github" i]', 'input[id*="github" i]', 'input[name*="github" i]'], TRUTH_PROFILE.candidate.github);
  await fillField(['input[id*="website" i]', 'input[name*="website" i]', '#website'], TRUTH_PROFILE.candidate.portfolio);

  // 5. Cover Letter Textarea (if present and provided)
  if (options.coverLetter) {
    await fillField(
      ['textarea[name*="cover" i]', 'textarea[id*="cover" i]', 'textarea[placeholder*="Cover Letter" i]', 'textarea'],
      options.coverLetter
    );
  }

  console.log("=================================================================");
  console.log("Form pre-filled. Review the details in the browser window.");
  console.log("Submit manually when ready to avoid automated CAPTCHA triggers.");
  console.log("=================================================================");

  return { browser, context, page };
}
