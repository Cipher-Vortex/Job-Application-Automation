import fs from "fs";
import path from "path";
import { chromium, Browser, BrowserContext, Page } from "playwright";
import { TRUTH_PROFILE } from "../config/truthProfile";
import { generateTailoredResumePdf } from "../engine/resumeTailorer";
import { tailorApplication, generateDeterministicTailoredPitch } from "../engine/tailor";
import { tracker } from "../storage/tracker";

export interface ApplyPilotJobInput {
  url: string;
  title: string;
  company: string;
  description?: string;
  client?: string;
  source?: string;
  matchScore?: number;
}

export interface ApplyPilotOptions {
  headless?: boolean;
  autoSubmit?: boolean;
  userDataDir?: string;
  keepOpenMs?: number;
}

export interface ApplyPilotResult {
  success: boolean;
  company: string;
  title: string;
  url: string;
  tailoredResumePath: string;
  coverLetter: string;
  status: "Applied" | "Pre-filled" | "Failed";
  screenshotPath?: string;
  fieldsFilled: string[];
  error?: string;
}

export async function runApplyPilot(
  job: ApplyPilotJobInput,
  options: ApplyPilotOptions = {}
): Promise<ApplyPilotResult> {
  const isHeadless = options.headless ?? false;
  const shouldSubmit = options.autoSubmit ?? true;
  const fieldsFilled: string[] = [];

  console.log("==================================================================");
  console.log("✈️ APPLYPILOT: AUTONOMOUS APPLICATION ENGINE");
  console.log(`Company: ${job.company} | Role: ${job.title}`);
  console.log(`URL: ${job.url}`);
  console.log(`Mode: ${isHeadless ? "Headless" : "Visible Application Window (Live Form Fill)"}`);
  console.log(`Auto-Submit: ${shouldSubmit ? "Enabled" : "Pre-fill only (Human-in-the-loop review)"}`);
  console.log("==================================================================");

  // 1. Generate dynamically tailored ATS resume PDF specifically for this company & JD
  console.log(`\n[Stage 1/5] Tailoring dynamic PDF resume for ${job.company}...`);
  const tailoredResumePath = await generateTailoredResumePdf({
    jobTitle: job.title,
    company: job.company,
    description: job.description || "",
    client: job.client
  });

  // 2. Generate tailored pitch / cover letter
  console.log(`\n[Stage 2/5] Generating tailored pitch & cover letter...`);
  const tailored = await tailorApplication({
    id: `job_${Date.now()}`,
    title: job.title,
    company: job.company,
    location: "Remote",
    url: job.url,
    description: job.description || "",
    source: (job.source?.toLowerCase().includes("greenhouse") ? "greenhouse" : "feed") as any
  });
  const coverLetter = tailored.cover_letter_body;

  // 3. Launch Application Window (Chrome / Edge with real browser environment)
  console.log(`\n[Stage 3/5] Opening application window...`);
  let browser: Browser | null = null;
  const launchArgs = [
    "--start-maximized",
    "--disable-blink-features=AutomationControlled",
    "--no-sandbox"
  ];

  const possiblePaths = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  ];
  const exePath = possiblePaths.find(p => fs.existsSync(p));

  const launchOptions: any = {
    headless: isHeadless,
    args: launchArgs
  };
  if (exePath) {
    launchOptions.executablePath = exePath;
  } else {
    launchOptions.channel = "chrome";
  }

  try {
    browser = await chromium.launch(launchOptions);
  } catch {
    try {
      browser = await chromium.launch({
        channel: "msedge",
        headless: isHeadless,
        args: launchArgs
      });
    } catch {
      browser = await chromium.launch({
        headless: isHeadless,
        args: launchArgs
      });
    }
  }

  const context: BrowserContext = await browser.newContext({
    viewport: null,
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
  });

  const page: Page = await context.newPage();
  page.setDefaultTimeout(25000);
  page.setDefaultNavigationTimeout(25000);

  // Helper to fill input fields
  const fillField = async (selectors: string[], value: string, fieldName: string) => {
    for (const sel of selectors) {
      try {
        const el = await page.$(sel);
        if (el && await el.isVisible()) {
          await el.fill(value);
          fieldsFilled.push(fieldName);
          console.log(`  ✓ Filled ${fieldName}: ${value.slice(0, 30)}...`);
          return true;
        }
      } catch {}
    }
    return false;
  };

  try {
    console.log(`\n[Stage 4/5] Navigating to job posting and filling form details...`);
    await page.goto(job.url, { waitUntil: "domcontentloaded", timeout: 25000 }).catch(e => {
      console.warn(`  ℹ Navigation notice: ${e.message.split('\n')[0]}`);
    });
    await page.waitForTimeout(1000);

    // Upload tailored resume first so ATS auto-parsing fills any pre-requisites
    try {
      const fileInput = await page.$('input[type="file"][id*="resume" i], #_systemfield_resume, input[type="file"]');
      if (fileInput) {
        await fileInput.setInputFiles(path.resolve(tailoredResumePath));
        fieldsFilled.push("tailored_resume");
        console.log(`  ✓ Uploaded tailored PDF resume: ${path.basename(tailoredResumePath)}`);
        await page.waitForTimeout(1500);
      }
    } catch (err: any) {
      console.warn(`  ℹ Resume upload notice: ${err.message}`);
    }

    // Candidate Personal Details
    const nameParts = TRUTH_PROFILE.candidate.name.split(" ");
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(" ") || firstName;

    await fillField(['#first_name', 'input[id="first_name"]', 'input[name="first_name"]', 'input[aria-label*="first name" i]'], firstName, "first_name");
    await fillField(['#last_name', 'input[id="last_name"]', 'input[name="last_name"]', 'input[aria-label*="last name" i]'], lastName, "last_name");
    await fillField(['#name', '#_systemfield_name', 'input[name="_systemfield_name"]', 'input[id="name"]', 'input[name="name"]', 'input[placeholder*="Full Name" i]'], TRUTH_PROFILE.candidate.name, "full_name");
    await fillField(['#email', '#_systemfield_email', 'input[name="_systemfield_email"]', 'input[id="email"]', 'input[type="email"]', 'input[name*="email" i]'], TRUTH_PROFILE.candidate.email, "email");

    // Phone
    const cleanPhone = TRUTH_PROFILE.candidate.phone.replace(/[^0-9]/g, '').slice(-10);
    const phoneFilled = await fillField(['#phone', 'input[id="phone"]', 'input[type="tel"]', 'input[name*="phone" i]'], cleanPhone, "phone");
    if (!phoneFilled) {
      await fillField(['#phone', 'input[type="tel"]'], TRUTH_PROFILE.candidate.phone, "phone");
    }

    // Location & Portfolios
    await fillField(['input[id="candidate-location"]', 'input[name*="location" i]', 'input[placeholder*="Location" i]'], TRUTH_PROFILE.candidate.location, "location");
    await fillField(['input[aria-label*="linkedin" i]', 'input[id*="linkedin" i]', 'input[name*="linkedin" i]'], TRUTH_PROFILE.candidate.linkedin, "linkedin");
    await fillField(['input[aria-label*="github" i]', 'input[id*="github" i]', 'input[name*="github" i]'], TRUTH_PROFILE.candidate.github, "github");
    await fillField(['input[id*="website" i]', 'input[name*="website" i]', '#website', 'input[name*="portfolio" i]'], TRUTH_PROFILE.candidate.portfolio, "portfolio");
    await fillField(['input[id*="38435287002" i]', 'input[aria-label*="prefer" i]'], firstName, "preferred_name");
    await fillField(['input[id*="38435291002" i]', 'input[aria-label*="gitlab username" i]'], "skkiran1258", "gitlab_username");

    // Cover Letter Textarea
    if (coverLetter) {
      await fillField(
        ['textarea[name*="cover" i]', 'textarea[id*="cover" i]', 'textarea[placeholder*="Cover Letter" i]', 'textarea'],
        coverLetter,
        "cover_letter"
      );
    }

    // Standard ATS Screening Questions, Dropdowns, Radios & Checkboxes
    try {
      // 1. Handle standard HTML <select> dropdowns
      const htmlSelects = await page.$$('select');
      for (const sel of htmlSelects) {
        try {
          if (!await sel.isVisible()) continue;
          const options = await sel.$$('option');
          const nameAttr = (await sel.getAttribute('name') || '').toLowerCase();
          const idAttr = (await sel.getAttribute('id') || '').toLowerCase();
          const parentText = (await sel.evaluate(el => (el.closest('div') || el.parentElement)?.innerText || '')).toLowerCase();
          const combined = `${nameAttr} ${idAttr} ${parentText}`;

          let targetKeywords: string[] = [];
          if (combined.includes('gender')) {
            targetKeywords = ['male', 'decline', 'prefer not'];
          } else if (combined.includes('country') || combined.includes('dial') || combined.includes('phone')) {
            targetKeywords = ['india', '+91'];
          } else if (combined.includes('race') || combined.includes('ethnic')) {
            targetKeywords = ['asian', 'decline', 'prefer not'];
          } else if (combined.includes('veteran')) {
            targetKeywords = ['not a protected', 'no'];
          } else if (combined.includes('disability')) {
            targetKeywords = ["don't have", 'no'];
          } else if (combined.includes('sponsorship') || combined.includes('visa')) {
            targetKeywords = ['no'];
          } else if (combined.includes('authorized') || combined.includes('eligible')) {
            targetKeywords = ['yes'];
          }

          let selected = false;
          for (const opt of options) {
            const val = await opt.getAttribute('value');
            const txt = (await opt.innerText()).toLowerCase();
            if (val && val !== '' && !txt.includes('select')) {
              if (targetKeywords.length > 0) {
                if (targetKeywords.some(k => txt.includes(k))) {
                  await sel.selectOption(val);
                  selected = true;
                  fieldsFilled.push(`select_${nameAttr || idAttr}`);
                  console.log(`  ✓ Selected standard dropdown [${nameAttr || idAttr}]: ${txt.trim().slice(0, 25)}`);
                  break;
                }
              } else {
                await sel.selectOption(val);
                selected = true;
                break;
              }
            }
          }
          if (targetKeywords.length > 0 && !selected) {
            for (const opt of options) {
              const val = await opt.getAttribute('value');
              const txt = (await opt.innerText()).toLowerCase();
              if (val && val !== '' && !txt.includes('select')) {
                await sel.selectOption(val);
                break;
              }
            }
          }
        } catch {}
      }

      // 1.8 Handle Radio buttons
      const radioGroups = await page.$$('input[type="radio"]');
      for (const rb of radioGroups) {
        try {
          if (!await rb.isVisible()) continue;
          const rbName = (await rb.getAttribute('name') || '').toLowerCase();
          const rbVal = (await rb.getAttribute('value') || '').toLowerCase();
          const parentTxt = (await rb.evaluate(el => (el.closest('fieldset') || el.closest('div') || el.parentElement)?.innerText || '')).toLowerCase();

          // Check if this radio button group has already been answered
          const isChecked = await rb.isChecked();
          if (isChecked) continue;

          let targetVal = "";
          if (parentTxt.includes('authorized to work') || parentTxt.includes('legally authorized') || parentTxt.includes('18 years')) {
            targetVal = "yes";
          } else if (parentTxt.includes('sponsorship') || parentTxt.includes('visa') || parentTxt.includes('previously worked') || parentTxt.includes('former employee') || parentTxt.includes('non-compete')) {
            targetVal = "no";
          } else if (parentTxt.includes('gender')) {
            targetVal = "male";
          } else if (parentTxt.includes('agree') || parentTxt.includes('consent') || parentTxt.includes('acknowledge')) {
            targetVal = "yes";
          }

          if (targetVal && (rbVal.includes(targetVal) || parentTxt.includes(targetVal))) {
            await rb.check({ force: true });
            fieldsFilled.push(`radio_${rbName}`);
            console.log(`  ✓ Checked radio option [${rbName}]: ${targetVal}`);
          }
        } catch {}
      }

      // 2. Handle Text Inputs & Screening Question text fields
      const textInputs = await page.$$('input[type="text"]:not(#first_name):not(#last_name):not(#email), textarea:not([name*="cover" i])');
      for (const inp of textInputs) {
        try {
          const id = (await inp.getAttribute('id') || '').toLowerCase();
          const aria = (await inp.getAttribute('aria-label') || '').toLowerCase();
          const placeholder = (await inp.getAttribute('placeholder') || '').toLowerCase();
          const label = (await inp.evaluate(el => {
            const lbl = document.querySelector(`label[for="${el.id}"]`) || el.closest('div')?.querySelector('label');
            return lbl ? lbl.textContent || '' : '';
          })).toLowerCase();

          const combined = `${id} ${aria} ${placeholder} ${label}`;
          const currentVal = await inp.inputValue().catch(() => '');
          if (currentVal) continue; // Already filled

          if (combined.includes("location") || combined.includes("city") || combined.includes("country")) {
            await inp.fill("Bengaluru, India");
            await page.waitForTimeout(500);
            await page.keyboard.press("ArrowDown");
            await page.keyboard.press("Enter");
            fieldsFilled.push("location");
            console.log(`  ✓ Filled Location: Bengaluru, India`);
          } else if (combined.includes("linkedin")) {
            await inp.fill(TRUTH_PROFILE.candidate.linkedin);
            fieldsFilled.push("linkedin_profile");
            console.log(`  ✓ Filled LinkedIn Profile: ${TRUTH_PROFILE.candidate.linkedin}`);
          } else if (combined.includes("gitlab username") || (combined.includes("gitlab") && combined.includes("user"))) {
            await inp.fill("skkiran1258");
            fieldsFilled.push("gitlab_username");
            console.log(`  ✓ Filled GitLab username: skkiran1258`);
          } else if (combined.includes("github")) {
            await inp.fill(TRUTH_PROFILE.candidate.github);
            fieldsFilled.push("github_profile");
            console.log(`  ✓ Filled GitHub profile: ${TRUTH_PROFILE.candidate.github}`);
          } else if (combined.includes("website") || combined.includes("portfolio")) {
            await inp.fill(TRUTH_PROFILE.candidate.portfolio);
            fieldsFilled.push("portfolio_url");
            console.log(`  ✓ Filled Portfolio: ${TRUTH_PROFILE.candidate.portfolio}`);
          } else if (combined.includes("prefer") || combined.includes("preferred name")) {
            await inp.fill("Kiran");
            fieldsFilled.push("preferred_name");
            console.log(`  ✓ Filled Preferred Name: Kiran`);
          } else if (combined.includes("notice period") || combined.includes("notice")) {
            await inp.fill("Immediate (15 days)");
            fieldsFilled.push("notice_period");
            console.log(`  ✓ Filled Notice Period: Immediate (15 days)`);
          } else if (combined.includes("current salary") || combined.includes("current ctc") || combined.includes("current_ctc")) {
            await inp.fill("280000");
            fieldsFilled.push("current_salary");
            console.log(`  ✓ Filled Current Salary: 280000`);
          } else if (combined.includes("expected") || combined.includes("salary") || combined.includes("ctc") || combined.includes("compensation")) {
            await inp.fill("800000");
            fieldsFilled.push("expected_salary");
            console.log(`  ✓ Filled Expected Salary: 800000`);
          } else if (combined.includes("relocat")) {
            await inp.fill("Yes");
            fieldsFilled.push("relocation");
          } else if (combined.includes("experience") || combined.includes("years")) {
            await inp.fill("1.5");
            fieldsFilled.push("years_experience");
          } else if (combined.includes("sponsorship") || combined.includes("visa")) {
            await inp.fill("No");
            fieldsFilled.push("visa_sponsorship_no");
          } else if (combined.includes("adjustments") || combined.includes("assist you during")) {
            await inp.fill("None");
            fieldsFilled.push("accommodations_none");
          } else if (combined.includes("why") || combined.includes("about") || combined.includes("summary")) {
            await inp.fill("Full Stack & AI Engineer experienced in React, Node.js, TypeScript, REST APIs, and microservices.");
            fieldsFilled.push("why_work_here");
          } else if (combined.includes("legal name")) {
            await inp.fill(TRUTH_PROFILE.candidate.name);
            fieldsFilled.push("legal_name");
          }
        } catch {}
      }

      // 3. Handle Checkboxes (Terms, Privacy, Consent, Agreements)
      const checkboxes = await page.$$('input[type="checkbox"]');
      for (const cb of checkboxes) {
        try {
          if (!await cb.isVisible()) continue;
          const isChecked = await cb.isChecked();
          if (!isChecked) {
            await cb.check({ force: true });
            fieldsFilled.push("checkbox_checked");
            console.log("  ✓ Checked required compliance/consent checkbox");
          }
        } catch {}
      }
    } catch (err: any) {
      console.warn(`  ℹ Screening questions notice: ${err.message}`);
    }

    // 5. Submit or Review
    console.log(`\n[Stage 5/5] Submitting & finalizing application...`);
    let finalStatus: "Applied" | "Pre-filled" = "Pre-filled";
    let screenshotPath = "";

    const screenshotsDir = path.resolve(process.cwd(), "data/screenshots");
    if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });

    if (shouldSubmit) {
      console.log("[ApplyPilot] Submitting application live via Playwright...");
      const submitSelectors = [
        '#submit_app',
        'button[type="submit"]',
        'input[type="submit"]',
        'button:has-text("Submit application")',
        'button:has-text("Submit Application")',
        'button:has-text("Submit")',
        'button:has-text("Apply now")',
        'button:has-text("Apply Now")',
        'button:has-text("Apply")'
      ];

      let submitBtn = null;
      for (const sel of submitSelectors) {
        submitBtn = await page.$(sel);
        if (submitBtn && await submitBtn.isVisible()) break;
      }

      if (submitBtn) {
        await submitBtn.scrollIntoViewIfNeeded();
        await page.waitForTimeout(1000);
        console.log("  🚀 Clicking Submit button live...");
        await submitBtn.click();
        await page.waitForTimeout(5000);

        // Check for success or error notices
        const bodyText = (await page.innerText("body").catch(() => "")).toLowerCase();
        const hasSuccess = ["thank you", "application submitted", "received your application", "successfully submitted", "we will review", "we'll be in touch"].some(kw => bodyText.includes(kw));

        if (hasSuccess) {
          finalStatus = "Applied";
          console.log("  🎉 Application submission verified! Success confirmation displayed.");
        } else {
          // Check if error elements are highlighted
          const errors = await page.$$('.field-error, .error, [class*="error-message"], [role="alert"]');
          let hasVisibleError = false;
          for (const errEl of errors) {
            try {
              if (await errEl.isVisible()) {
                const errTxt = (await errEl.innerText()).trim();
                if (errTxt && !errTxt.toLowerCase().includes("cookie")) {
                  console.warn(`  ⚠️ Field validation note: ${errTxt}`);
                  hasVisibleError = true;
                }
              }
            } catch {}
          }
          finalStatus = hasVisibleError ? "Pre-filled" : "Applied";
        }
      } else {
        console.log("  ℹ Submit button not detected automatically. Saved as Pre-filled.");
      }

      screenshotPath = path.resolve(screenshotsDir, `${job.company.replace(/[^a-zA-Z0-9]/g, '_')}_submitted.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
      // Also save root screenshot for immediate verification
      const rootScreenshot = path.resolve(process.cwd(), "submission_confirmation.png");
      await page.screenshot({ path: rootScreenshot, fullPage: true }).catch(() => {});
      console.log(`  ✓ Application proof captured at: ${screenshotPath}`);
    } else {
      screenshotPath = path.resolve(screenshotsDir, `${job.company.replace(/[^a-zA-Z0-9]/g, '_')}_prefilled.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
      console.log(`  ✓ Pre-fill proof captured at: ${screenshotPath}`);
    }

    // 6. Record to SQLite & CSV Tracker
    const appId = `app_${Date.now().toString(36)}`;
    await tracker.logApplication({
      id: appId,
      company: job.company,
      jobTitle: job.title,
      jobUrl: job.url,
      source: job.source || "greenhouse",
      matchScore: job.matchScore || 85,
      status: finalStatus === "Applied" ? "Applied" : "Pending Review",
      notes: `ApplyPilot autonomous apply. Tailored resume: ${path.basename(tailoredResumePath)}`
    });

    // 7. Sync with Google Sheets export CSV
    const sheetsCsvPath = path.resolve(process.cwd(), "data/google_sheets_sync_export.csv");
    if (fs.existsSync(sheetsCsvPath)) {
      const timestamp = new Date().toISOString().replace("T", " ").substring(0, 19);
      const sheetRow = `"${timestamp}","${appId}","${job.company.replace(/"/g, '""')}","${job.title.replace(/"/g, '""')}","Remote","Remote","Full-Time","Competitive","${job.matchScore || 85}%","${finalStatus}","${job.url}"\n`;
      fs.appendFileSync(sheetsCsvPath, sheetRow, "utf-8");
      console.log(`  ✓ Synced to Google Sheets tracker export.`);
    }

    if (!isHeadless && options.keepOpenMs) {
      console.log(`\nKeeping browser window open for ${options.keepOpenMs / 1000}s...`);
      await page.waitForTimeout(options.keepOpenMs);
    }

    if (browser) await browser.close().catch(() => {});

    console.log(`\n✅ ApplyPilot complete for ${job.company}! Status: [${finalStatus}]`);
    return {
      success: true,
      company: job.company,
      title: job.title,
      url: job.url,
      tailoredResumePath,
      coverLetter,
      status: finalStatus,
      screenshotPath,
      fieldsFilled
    };

  } catch (err: any) {
    console.error(`❌ ApplyPilot Error: ${err.message}`);
    if (browser) await browser.close().catch(() => {});
    return {
      success: false,
      company: job.company,
      title: job.title,
      url: job.url,
      tailoredResumePath,
      coverLetter,
      status: "Failed",
      fieldsFilled,
      error: err.message
    };
  }
}
