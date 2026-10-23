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

  const browser: Browser = await chromium.launch({
    headless: isHeadless,
    args: ["--start-maximized", "--disable-blink-features=AutomationControlled"]
  });

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

  // Name handling (full name, first name, last name)
  const nameParts = TRUTH_PROFILE.candidate.name.split(" ");
  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(" ") || firstName;

  await fillField(['input[name*="first_name" i]', 'input[id*="first_name" i]', '#first_name'], firstName);
  await fillField(['input[name*="last_name" i]', 'input[id*="last_name" i]', '#last_name'], lastName);
  await fillField(['input[name*="name" i]', '#name', 'input[placeholder*="Full Name" i]'], TRUTH_PROFILE.candidate.name);

  // Email
  await fillField(['input[type="email"]', 'input[name*="email" i]', '#email'], TRUTH_PROFILE.candidate.email);

  // Phone
  await fillField(['input[type="tel"]', 'input[name*="phone" i]', '#phone'], TRUTH_PROFILE.candidate.phone);

  // Socials and Portfolios
  await fillField(['input[name*="linkedin" i]', 'input[id*="linkedin" i]', 'input[placeholder*="LinkedIn" i]'], TRUTH_PROFILE.candidate.linkedin);
  await fillField(['input[name*="github" i]', 'input[id*="github" i]', 'input[placeholder*="GitHub" i]'], TRUTH_PROFILE.candidate.github);
  await fillField(['input[name*="website" i]', 'input[name*="portfolio" i]', '#website'], TRUTH_PROFILE.candidate.portfolio);
  await fillField(['input[name*="location" i]', 'input[placeholder*="Location" i]'], TRUTH_PROFILE.candidate.location);

  // Cover Letter Textarea (if present and provided)
  if (options.coverLetter) {
    await fillField(
      ['textarea[name*="cover" i]', 'textarea[id*="cover" i]', 'textarea[placeholder*="Cover Letter" i]', 'textarea'],
      options.coverLetter
    );
  }

  // Resume Upload (if input[type="file"] exists)
  if (resumePath && fs.existsSync(resumePath)) {
    try {
      const fileInput = await page.$('input[type="file"]');
      if (fileInput) {
        await fileInput.setInputFiles(path.resolve(resumePath));
        console.log(`[FormFiller] Resume attached successfully from ${resumePath}`);
      }
    } catch (err: any) {
      console.warn(`[FormFiller] Could not attach file: ${err.message}`);
    }
  }

  console.log("=================================================================");
  console.log("Form pre-filled. Review the details in the browser window.");
  console.log("Submit manually when ready to avoid automated CAPTCHA triggers.");
  console.log("=================================================================");

  return { browser, context, page };
}
