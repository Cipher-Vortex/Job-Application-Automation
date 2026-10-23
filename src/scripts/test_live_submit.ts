import { prefillApplication } from "../automation/formFiller";
import { TRUTH_PROFILE } from "../config/truthProfile";
import { env } from "../config/env";

async function testLiveSubmit() {
  console.log("=================================================");
  console.log(" TESTING LIVE FORM FILL & SUBMIT");
  console.log(" Candidate:", TRUTH_PROFILE.candidate.name);
  console.log("=================================================\n");

  const jobUrl = "https://job-boards.greenhouse.io/gitlab/jobs/8826920002";
  const coverLetter = `Dear GitLab Hiring Team,

I am applying for the Senior Frontend Engineer position. With strong experience in React and modular component design at Zupper Commerce (~25% load time optimization), I look forward to contributing to GitLab.

Best regards,
${TRUTH_PROFILE.candidate.name}
${TRUTH_PROFILE.candidate.email}`;

  const session = await prefillApplication(jobUrl, env.RESUME_PATH, {
    headless: true,
    coverLetter,
    autoSubmit: true
  });

  console.log("[Test Result] Auto-Submit execution completed.");
  await session.browser.close();
}

testLiveSubmit();
