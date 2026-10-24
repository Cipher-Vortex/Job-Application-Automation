import { chromium, BrowserContext, Page } from "playwright";
import { TRUTH_PROFILE } from "../config/truthProfile";
import fs from "fs";
import path from "path";

export interface LocalApplyOptions {
  headless?: boolean;
  userDataDir?: string;
  resumePath?: string;
  autoSubmit?: boolean;
}

export interface LocalApplyResult {
  context: BrowserContext;
  page: Page;
  fieldsFilled: string[];
  resumeAttached: boolean;
}

export async function prefillWithPersistentContext(
  jobUrl: string,
  options: LocalApplyOptions = {}
): Promise<LocalApplyResult> {
  const isHeadless = options.headless ?? false;
  const userDataDir = path.resolve(process.cwd(), options.userDataDir || "./user-data-dir");
  const resumePath = path.resolve(
    process.cwd(),
    options.resumePath || "documents/Kiran S R _ Full Stack Engineer.pdf"
  );

  console.log("==================================================================");
  console.log("🚀 [LOCAL PLAYWRIGHT PERSISTENT CONTEXT AUTO-FILLER]");
  console.log(`🌐 Target Job URL: ${jobUrl}`);
  console.log(`📁 User Data Dir: ${userDataDir}`);
  console.log(`📄 Resume Path: ${resumePath}`);
  console.log(`🖥️ Headless: ${isHeadless}`);
  console.log("==================================================================");

  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }

  // Launch persistent context with Chrome / Edge residential fingerprint
  let context: BrowserContext;
  const launchArgs = [
    "--start-maximized",
    "--disable-blink-features=AutomationControlled",
    "--no-sandbox",
    "--disable-infobars",
  ];

  try {
    context = await chromium.launchPersistentContext(userDataDir, {
      headless: isHeadless,
      channel: "chrome",
      viewport: null,
      args: launchArgs,
    });
  } catch {
    try {
      context = await chromium.launchPersistentContext(userDataDir, {
        headless: isHeadless,
        channel: "msedge",
        viewport: null,
        args: launchArgs,
      });
    } catch {
      context = await chromium.launchPersistentContext(userDataDir, {
        headless: isHeadless,
        viewport: null,
        args: launchArgs,
      });
    }
  }

  const pages = context.pages();
  const page: Page = pages.length > 0 ? pages[0] : await context.newPage();

  console.log(`[FormFiller] Navigating to target job posting...`);
  try {
    await page.goto(jobUrl, { waitUntil: "domcontentloaded", timeout: 35000 });
  } catch (err: any) {
    console.warn(`[FormFiller] Navigation notice: ${err.message}`);
  }

  // Wait 2 seconds for dynamic JS / ATS widgets to hydrate
  await page.waitForTimeout(2000);

  const fieldsFilled: string[] = [];
  let resumeAttached = false;

  // 1. Resume Attachment
  if (fs.existsSync(resumePath)) {
    try {
      const fileInput = await page.$(
        'input[type="file"][id*="resume" i], input[type="file"][name*="resume" i], #_systemfield_resume, input[type="file"]'
      );
      if (fileInput) {
        await fileInput.setInputFiles(resumePath);
        resumeAttached = true;
        fieldsFilled.push("Resume (PDF Attached)");
        console.log(`✅ Resume attached successfully: ${path.basename(resumePath)}`);
        await page.waitForTimeout(1500); // Allow parsing
      } else {
        console.log("ℹ️ No file upload input found on this page.");
      }
    } catch (err: any) {
      console.warn(`[FormFiller] Resume upload note: ${err.message}`);
    }
  }

  // 2. Intelligent Candidate Inputs
  const fillIfMatches = async (selectors: string[], value: string, fieldName: string) => {
    for (const sel of selectors) {
      try {
        const el = await page.$(sel);
        if (el && (await el.isVisible())) {
          await el.fill(value);
          fieldsFilled.push(fieldName);
          console.log(`✅ Filled ${fieldName} -> "${value}"`);
          return true;
        }
      } catch {}
    }
    return false;
  };

  const nameParts = TRUTH_PROFILE.candidate.name.split(" ");
  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(" ") || nameParts[0];

  // First & Last Name
  await fillIfMatches(
    ['#first_name', 'input[name="first_name"]', 'input[autocomplete="given-name"]', '#firstName', 'input[name="firstName"]'],
    firstName,
    "First Name"
  );
  await fillIfMatches(
    ['#last_name', 'input[name="last_name"]', 'input[autocomplete="family-name"]', '#lastName', 'input[name="lastName"]'],
    lastName,
    "Last Name"
  );

  // Full Name
  await fillIfMatches(
    ['input[name="name"]', '#name', 'input[name="full_name"]', 'input[autocomplete="name"]'],
    TRUTH_PROFILE.candidate.name,
    "Full Name"
  );

  // Email
  await fillIfMatches(
    ['#email', 'input[name="email"]', 'input[type="email"]', 'input[autocomplete="email"]'],
    TRUTH_PROFILE.candidate.email,
    "Email"
  );

  // Phone
  await fillIfMatches(
    ['#phone', 'input[name="phone"]', 'input[type="tel"]', 'input[autocomplete="tel"]'],
    TRUTH_PROFILE.candidate.phone,
    "Phone"
  );

  // LinkedIn
  await fillIfMatches(
    ['input[name*="linkedin" i]', 'input[id*="linkedin" i]', 'input[aria-label*="linkedin" i]'],
    TRUTH_PROFILE.candidate.linkedin,
    "LinkedIn Profile"
  );

  // GitHub
  await fillIfMatches(
    ['input[name*="github" i]', 'input[id*="github" i]', 'input[aria-label*="github" i]'],
    TRUTH_PROFILE.candidate.github,
    "GitHub Profile"
  );

  // Portfolio / Website
  await fillIfMatches(
    ['input[name*="website" i]', 'input[name*="portfolio" i]', 'input[id*="portfolio" i]', 'input[id*="website" i]', 'input[name*="urls[Portfolio]"]'],
    TRUTH_PROFILE.candidate.portfolio,
    "Portfolio"
  );

  // Location / City
  await fillIfMatches(
    ['#location', 'input[name="location"]', 'input[name*="city" i]', 'input[id*="location" i]'],
    "Bengaluru, Karnataka, India",
    "Location"
  );

  // 3. Screen questions / Standard ATS Inputs
  try {
    const textInputs = await page.$$('input[type="text"]:not([value]):not([disabled]), textarea:not([disabled])');
    for (const inp of textInputs) {
      if (!(await inp.isVisible())) continue;

      const id = (await inp.getAttribute("id")) || "";
      const name = (await inp.getAttribute("name")) || "";
      const placeholder = (await inp.getAttribute("placeholder")) || "";
      const combined = `${id} ${name} ${placeholder}`.toLowerCase();

      if (combined.includes("country")) {
        await inp.fill("India");
      } else if (combined.includes("sponsorship") || combined.includes("visa")) {
        await inp.fill("No");
      } else if (combined.includes("notice")) {
        await inp.fill("Immediate (15 days)");
      } else if (combined.includes("salary") || combined.includes("compensation")) {
        await inp.fill("Open to Discussion / Competitive");
      }
    }
  } catch (err: any) {
    console.warn(`[FormFiller] Screening questions note: ${err.message}`);
  }

  console.log("\n==================================================================");
  console.log("🎉 PRE-FILL COMPLETE! BROWSER SESSION PERSISTED LOCALLY.");
  console.log(`Fields pre-filled (${fieldsFilled.length}):`, fieldsFilled.join(", "));
  console.log("------------------------------------------------------------------");
  console.log("👉 The browser window is now open on your desktop.");
  console.log("👉 Inspect any custom employer questions, then click SUBMIT in 5 sec!");
  console.log("==================================================================\n");

  if (options.autoSubmit) {
    console.log("[FormFiller] AutoSubmit requested: searching for submit button...");
    const submitBtn = await page.$(
      'button[type="submit"], #submit_app, input[type="submit"], button:has-text("Submit application"), button:has-text("Submit Application")'
    );
    if (submitBtn) {
      await submitBtn.scrollIntoViewIfNeeded();
      await page.waitForTimeout(1000);
      await submitBtn.click();
      console.log("🚀 Submit button clicked automatically.");
    }
  }

  return { context, page, fieldsFilled, resumeAttached };
}
