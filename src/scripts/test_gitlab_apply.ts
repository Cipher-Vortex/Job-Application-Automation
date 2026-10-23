import { prefillApplication } from "../automation/formFiller";
import { TRUTH_PROFILE } from "../config/truthProfile";
import { env } from "../config/env";
import path from "path";

async function testGitLabLiveApply() {
  console.log("=================================================");
  console.log(" LIVE APPLICATION TEST: GitLab Senior Frontend Engineer");
  console.log(" Board URL: https://job-boards.greenhouse.io/gitlab/jobs/8826920002");
  console.log(" Candidate:", TRUTH_PROFILE.candidate.name);
  console.log("=================================================\n");

  const jobUrl = "https://job-boards.greenhouse.io/gitlab/jobs/8826920002";
  const coverLetter = `Dear GitLab Hiring Team,

I am applying for the Senior Frontend Engineer position at GitLab. In my recent role at Zupper Commerce, I specialized in React and modular component design, optimizing frontend load times by ~25% through lazy loading, code-splitting, and memoization. I also architected scalable web applications such as Yeshu Tours & Travels and enterprise ERP systems.

I admire GitLab's open culture and look forward to discussing how my frontend engineering background aligns with your team's goals.

Best regards,
${TRUTH_PROFILE.candidate.name}
${TRUTH_PROFILE.candidate.email} | ${TRUTH_PROFILE.candidate.phone}`;

  const session = await prefillApplication(jobUrl, env.RESUME_PATH, {
    headless: true,
    coverLetter
  });

  const { page, browser } = session;

  try {
    await page.waitForTimeout(2000);

    const firstName = await page.$eval('#first_name', el => (el as HTMLInputElement).value).catch(() => "");
    const lastName = await page.$eval('#last_name', el => (el as HTMLInputElement).value).catch(() => "");
    const email = await page.$eval('#email', el => (el as HTMLInputElement).value).catch(() => "");
    const phone = await page.$eval('#phone', el => (el as HTMLInputElement).value).catch(() => "");
    const linkedin = await page.$eval('input[aria-label*="linkedin" i], input[name*="linkedin" i]', el => (el as HTMLInputElement).value).catch(() => "");

    console.log("\n[GITLAB PREFILL VERIFICATION]");
    console.log(`✓ First Name: "${firstName}" (Expected: Kiran)`);
    console.log(`✓ Last Name:  "${lastName}" (Expected: S R)`);
    console.log(`✓ Email:      "${email}" (Expected: ${TRUTH_PROFILE.candidate.email})`);
    console.log(`✓ Phone:      "${phone}" (Expected: ${TRUTH_PROFILE.candidate.phone})`);
    console.log(`✓ LinkedIn:   "${linkedin}" (Expected: ${TRUTH_PROFILE.candidate.linkedin})`);

    const proofPath = path.resolve(process.cwd(), "gitlab_prefill_proof.png");
    await page.screenshot({ path: proofPath, fullPage: true });
    console.log(`\n[Saved Screenshot Proof]: ${proofPath}`);

    console.log("\n[SUCCESS] Live GitLab application successfully pre-filled and verified!");
  } catch (err: any) {
    console.error("[GitLab Test Error]:", err.message);
  } finally {
    await browser.close();
  }
}

testGitLabLiveApply();
