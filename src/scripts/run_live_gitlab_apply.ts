import { chromium } from "playwright";
import path from "path";
import fs from "fs";
import { TRUTH_PROFILE } from "../config/truthProfile";

async function applyGitLabLive() {
  console.log("=================================================");
  console.log(" EXECUTING LIVE APPLICATION FOR GITLAB");
  console.log(" Role: Staff Frontend Engineer");
  console.log(" URL: https://job-boards.greenhouse.io/gitlab/jobs/8826965002");
  console.log(` Candidate: ${TRUTH_PROFILE.candidate.name}`);
  console.log("=================================================\n");

  const jobUrl = "https://job-boards.greenhouse.io/gitlab/jobs/8826965002";
  const resumePath = path.resolve(process.cwd(), "documents/Kiran S R _ Full Stack Engineer.pdf");

  // Launch visible browser (headed) so the user can see everything being filled live
  const browser = await chromium.launch({
    channel: "chrome",
    headless: false,
    slowMo: 100
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
  });

  const page = await context.newPage();

  console.log("[1/6] Navigating to GitLab job board...");
  await page.goto(jobUrl, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(1000);

  console.log("[2/6] Uploading verified resume PDF...");
  if (fs.existsSync(resumePath)) {
    const resumeInput = await page.$('input#resume, input[type="file"]');
    if (resumeInput) {
      await resumeInput.setInputFiles(resumePath);
      console.log(`  ✓ Attached: ${resumePath}`);
      await page.waitForTimeout(2000);
    }
  }

  console.log("[3/6] Filling personal details & phone...");
  const nameParts = TRUTH_PROFILE.candidate.name.split(" ");
  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(" ");

  await page.fill("#first_name", firstName);
  await page.fill("#last_name", lastName);
  await page.fill("#email", TRUTH_PROFILE.candidate.email);

  // Fill clean 10-digit phone number
  const cleanPhone = TRUTH_PROFILE.candidate.phone.replace(/[^0-9]/g, '').slice(-10);
  await page.fill("#phone", cleanPhone);
  console.log(`  ✓ Name: ${firstName} ${lastName}`);
  console.log(`  ✓ Email: ${TRUTH_PROFILE.candidate.email}`);
  console.log(`  ✓ Phone (Clean): ${cleanPhone}`);

  console.log("[4/6] Filling candidate links & profiles...");
  const linkedinInput = await page.$("#question_38435286002, input[aria-label*='linkedin' i], input[name*='linkedin' i]");
  if (linkedinInput) {
    await linkedinInput.fill(TRUTH_PROFILE.candidate.linkedin);
    console.log(`  ✓ LinkedIn: ${TRUTH_PROFILE.candidate.linkedin}`);
  }

  const preferredName = await page.$("#question_38435287002");
  if (preferredName) {
    await preferredName.fill(firstName);
    console.log(`  ✓ Preferred Name: ${firstName}`);
  }

  const gitlabUser = await page.$("#question_38435291002");
  if (gitlabUser) {
    await gitlabUser.fill("skkiran1258");
    console.log(`  ✓ GitLab Username: skkiran1258`);
  }

  console.log("[5/6] Answering mandatory ATS screening dropdowns...");
  async function selectReactDropdown(inputSelector: string, searchVal: string) {
    try {
      const inp = await page.$(inputSelector);
      if (inp) {
        await inp.scrollIntoViewIfNeeded();
        await inp.click();
        await page.waitForTimeout(300);
        await inp.fill(searchVal);
        await page.waitForTimeout(500);

        const fieldId = inputSelector.replace('#', '');
        // Click the actual option element rendered by React in the menu
        const option = await page.$(`div[id^="react-select-${fieldId}-option"]:has-text("${searchVal}")`)
                    || await page.$(`div[id^="react-select-${fieldId}-option"]`)
                    || await page.$(`.select__option:has-text("${searchVal}")`)
                    || await page.$('.select__option');
        if (option) {
          await option.click();
          console.log(`  ✓ Successfully selected option for ${inputSelector} -> "${searchVal}"`);
        } else {
          await page.keyboard.press("Enter");
          console.log(`  ✓ Enter pressed for ${inputSelector} -> "${searchVal}"`);
        }
        await page.waitForTimeout(400);
      }
    } catch (e: any) {
      console.warn(`  ⚠ Dropdown selection note (${inputSelector}):`, e.message);
    }
  }

  // Country phone code -> India +91
  await selectReactDropdown("#country", "India +91");

  // Current Country of Residence -> India
  await selectReactDropdown("#question_38435293002", "India");

  // Employment restrictions -> No
  await selectReactDropdown("#question_38435288002", "No");

  // Visa sponsorship -> No
  await selectReactDropdown("#question_38435290002", "No");

  // Previously worked at GitLab -> No
  await selectReactDropdown("#question_38435292002", "No");

  // Voluntary EEO self-identification dropdowns
  await selectReactDropdown("#gender", "Male");
  await selectReactDropdown("#hispanic_ethnicity", "No");
  await selectReactDropdown("#veteran_status", "I am not a protected veteran");

  // Save screenshot proof before submission
  const preSubmitProof = path.resolve(process.cwd(), "gitlab_fully_filled_proof.png");
  await page.screenshot({ path: preSubmitProof, fullPage: true });
  console.log(`[Screenshot Saved] Fully filled form captured at: ${preSubmitProof}`);

  console.log("\n[6/6] Submitting live application...");
  const submitButton = await page.$('button[type="submit"], input[type="submit"], #submit_app, button:has-text("Submit application"), button:has-text("Submit Application")');
  if (submitButton) {
    await submitButton.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);
    console.log("  -> Clicking 'Submit application' button live...");
    await submitButton.click();
    await page.waitForTimeout(6000);

    const postSubmitProof = path.resolve(process.cwd(), "gitlab_submission_result.png");
    await page.screenshot({ path: postSubmitProof, fullPage: true });
    console.log(`[Screenshot Saved] Post-submission result captured at: ${postSubmitProof}`);
    console.log("Final Page URL:", page.url());
  }

  console.log("\n=================================================================");
  console.log(" Application filled and executed.");
  console.log(" Browser remains open for 60 seconds so you can verify.");
  console.log("=================================================================\n");

  await page.waitForTimeout(60000);
  await browser.close();
}

applyGitLabLive();
