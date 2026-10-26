import { chromium, Browser, BrowserContext, Page } from "playwright";
import { TRUTH_PROFILE } from "../config/truthProfile";
import fs from "fs";
import path from "path";

export interface PrefillOptions {
  headless?: boolean;
  coverLetter?: string;
  autoSubmit?: boolean;
}

export async function prefillApplication(jobUrl: string, resumePath?: string, options: PrefillOptions = {}) {
  const isHeadless = options.headless ?? false;
  const shouldSubmit = options.autoSubmit ?? false;

  console.log(`[FormFiller] Launching browser (headless: ${isHeadless}, autoSubmit: ${shouldSubmit}) for ${jobUrl}`);

  let browser: Browser;
  const possiblePaths = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  ];
  const exePath = possiblePaths.find(p => fs.existsSync(p));

  const launchOptions: any = {
    headless: isHeadless,
    args: ["--start-maximized", "--disable-blink-features=AutomationControlled"]
  };
  if (exePath) launchOptions.executablePath = exePath;
  else launchOptions.channel = "chrome";

  try {
    browser = await chromium.launch(launchOptions);
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

  // 1. Resume Upload (Upload first so ATS auto-parsing completes before filling)
  if (resumePath && fs.existsSync(resumePath)) {
    try {
      const fileInput = await page.$('input[type="file"][id*="resume" i], #_systemfield_resume, input[type="file"]');
      if (fileInput) {
        await fileInput.setInputFiles(path.resolve(resumePath));
        console.log(`[FormFiller] Resume attached successfully from ${resumePath}`);
        await page.waitForTimeout(1500);
      }
    } catch (err: any) {
      console.warn(`[FormFiller] Could not attach file: ${err.message}`);
    }
  }

  // 2. Name handling
  const nameParts = TRUTH_PROFILE.candidate.name.split(" ");
  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(" ") || firstName;

  await fillField(['#first_name', 'input[id="first_name"]', 'input[name="first_name"]', 'input[aria-label*="first name" i]'], firstName);
  await fillField(['#last_name', 'input[id="last_name"]', 'input[name="last_name"]', 'input[aria-label*="last name" i]'], lastName);
  await fillField(['#name', '#_systemfield_name', 'input[name="_systemfield_name"]', 'input[id="name"]', 'input[name="name"]', 'input[placeholder*="Full Name" i]'], TRUTH_PROFILE.candidate.name);

  // 3. Contact & Location
  await fillField(['#email', '#_systemfield_email', 'input[name="_systemfield_email"]', 'input[id="email"]', 'input[type="email"]', 'input[name*="email" i]'], TRUTH_PROFILE.candidate.email);

  // Phone: Handle intl-tel-input widget if present
  try {
    const itiCountryBtn = await page.$('.iti__selected-country');
    if (itiCountryBtn) {
      await itiCountryBtn.click();
      await page.waitForTimeout(300);
      const itiSearch = await page.$('.iti__search-input');
      if (itiSearch) {
        await itiSearch.fill("India");
        await page.keyboard.press("Enter");
        await page.waitForTimeout(300);
      }
    }
  } catch {}

  const cleanPhone = TRUTH_PROFILE.candidate.phone.replace(/[^0-9]/g, '').slice(-10);
  const phoneFilled = await fillField(['#phone', 'input[id="phone"]', 'input[type="tel"]', 'input[name*="phone" i]'], cleanPhone);
  if (!phoneFilled) {
    await fillField(['#phone', 'input[type="tel"]'], TRUTH_PROFILE.candidate.phone);
  }
  await fillField(['input[id="candidate-location"]', 'input[name*="location" i]', 'input[placeholder*="Location" i]'], TRUTH_PROFILE.candidate.location);

  // 4. Socials and Portfolios
  await fillField(['input[aria-label*="linkedin" i]', 'input[id*="linkedin" i]', 'input[name*="linkedin" i]'], TRUTH_PROFILE.candidate.linkedin);
  await fillField(['input[aria-label*="github" i]', 'input[id*="github" i]', 'input[name*="github" i]'], TRUTH_PROFILE.candidate.github);
  await fillField(['input[id*="website" i]', 'input[name*="website" i]', '#website'], TRUTH_PROFILE.candidate.portfolio);
  await fillField(['input[id*="38435287002" i]', 'input[aria-label*="prefer" i]'], firstName);
  await fillField(['input[id*="38435291002" i]', 'input[aria-label*="gitlab username" i]'], "skkiran1258");

  // 5. Cover Letter Textarea
  if (options.coverLetter) {
    await fillField(
      ['textarea[name*="cover" i]', 'textarea[id*="cover" i]', 'textarea[placeholder*="Cover Letter" i]', 'textarea'],
      options.coverLetter
    );
  }

  // 6. Automated Standard ATS Screening Question Answers & Dropdowns
  try {
    const dropdownInputs = await page.$$('input.select__input, input[role="combobox"], [class*="-control"], div[id*="question"]');
    for (const inp of dropdownInputs) {
      try {
        const id = (await inp.getAttribute('id') || '').toLowerCase();
        const label = (await inp.evaluate(el => {
          const lbl = document.querySelector(`label[for="${el.id}"]`) || el.closest('div')?.querySelector('label');
          return lbl ? lbl.textContent || '' : '';
        })).toLowerCase();

        const combinedText = `${id} ${label}`;
        let answer = "";
        if (id === "country") {
          answer = "India +91";
        } else if (combinedText.includes("country of residence") || combinedText.includes("current country")) {
          answer = "India";
        } else if (combinedText.includes("sponsorship") || combinedText.includes("visa")) {
          answer = "No";
        } else if (combinedText.includes("restrictions") || combinedText.includes("employment agreement")) {
          answer = "No";
        } else if (combinedText.includes("worked at") || combinedText.includes("previously worked")) {
          answer = "No";
        } else if (id === "gender") {
          answer = "Male";
        } else if (id === "hispanic_ethnicity") {
          answer = "No";
        } else if (id === "veteran_status") {
          answer = "I am not a protected veteran";
        }

        if (answer) {
          await inp.scrollIntoViewIfNeeded();
          await inp.click();
          await page.waitForTimeout(300);
          await inp.fill(answer);
          await page.waitForTimeout(500);

          const fieldId = id.replace('#', '');
          const option = await page.$(`div[id^="react-select-${fieldId}-option"]:has-text("${answer}")`)
                      || await page.$(`[class*="option"]:has-text("${answer}")`)
                      || await page.$(`div[id^="react-select-${fieldId}-option"]`)
                      || await page.$('.select__option');
          if (option) {
            await option.click();
          } else {
            await page.keyboard.press("Enter");
          }
          await page.waitForTimeout(300);
        }
      } catch {}
    }

    const textInputs = await page.$$('input[type="text"]:not(#first_name):not(#last_name):not(#email), textarea:not([name*="cover" i])');
    for (const inp of textInputs) {
      const id = (await inp.getAttribute('id') || '').toLowerCase();
      const aria = (await inp.getAttribute('aria-label') || '').toLowerCase();
      const label = (await inp.evaluate(el => {
        const lbl = document.querySelector(`label[for="${el.id}"]`);
        return lbl ? lbl.textContent || '' : '';
      })).toLowerCase();

      const combinedText = `${id} ${aria} ${label}`;

      if (combinedText.includes("country of residence") || combinedText.includes("current country")) {
        await inp.fill("India");
      } else if (combinedText.includes("sponsorship") || combinedText.includes("visa")) {
        await inp.fill("No");
      } else if (combinedText.includes("restrictions") || combinedText.includes("employment agreement")) {
        await inp.fill("No");
      } else if (combinedText.includes("worked at") || combinedText.includes("previously worked")) {
        await inp.fill("No");
      } else if (combinedText.includes("notice period") || combinedText.includes("notice")) {
        await inp.fill("Immediate (15 days)");
      } else if (combinedText.includes("legal name")) {
        await inp.fill(TRUTH_PROFILE.candidate.name);
      }
    }
  } catch (err: any) {
    console.warn(`[FormFiller] Screening questions warning: ${err.message}`);
  }

  // 7. Auto-Submit if requested
  if (shouldSubmit) {
    console.log("[FormFiller] Auto-Submit is enabled. Attempting to submit application...");
    try {
      const submitBtn = await page.$('button[type="submit"], #submit_app, input[type="submit"], button:has-text("Submit application"), button:has-text("Submit Application")');
      if (submitBtn) {
        await submitBtn.scrollIntoViewIfNeeded();
        await page.waitForTimeout(1000);
        await submitBtn.click();
        console.log("[FormFiller] Clicked Submit button. Waiting for ATS confirmation...");
        await page.waitForTimeout(5000);

        const confirmationPath = path.resolve(process.cwd(), "submission_confirmation.png");
        await page.screenshot({ path: confirmationPath, fullPage: true });
        console.log(`[FormFiller] Submission confirmation captured at: ${confirmationPath}`);
        console.log("[FormFiller] Final URL:", page.url());
      } else {
        console.warn("[FormFiller] Submit button not found automatically.");
      }
    } catch (err: any) {
      console.warn(`[FormFiller] Submission error: ${err.message}`);
    }
  } else {
    console.log("=================================================================");
    console.log("Form pre-filled. Review the details in the browser window.");
    console.log("Click Submit in the browser window to send application to employer.");
    console.log("=================================================================");
  }

  return { browser, context, page };
}
