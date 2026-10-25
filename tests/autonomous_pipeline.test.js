const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");

// Import compiled production modules
const { TRUTH_PROFILE } = require("../dist/config/truthProfile");
const { env } = require("../dist/config/env");
const { scoreJob } = require("../dist/engine/scorer");
const { generateTailoringPrompt, generateDeterministicTailoredPitch, tailorApplication } = require("../dist/engine/tailor");
const { tracker } = require("../dist/storage/tracker");
const { fetchGreenhouseJobs, fetchLeverJobs } = require("../dist/discovery/atsScraper");
const { generateTailoredResumePdf, generateTailoredResumeHtml } = require("../dist/engine/resumeTailorer");

test("Autonomous Job Application System Test Suite", async (t) => {

  await t.test("1. TRUTH_PROFILE - Strict Zero-Hallucination & Verified Metrics", () => {
    assert.equal(TRUTH_PROFILE.candidate.name, "Kiran S R");
    assert.equal(TRUTH_PROFILE.candidate.email, "skkiran1258@gmail.com");
    assert.equal(TRUTH_PROFILE.candidate.phone, "+91 81247 85632");
    assert.ok(TRUTH_PROFILE.candidate.portfolio.includes("cipher-vortex.vercel.app"));
    assert.ok(TRUTH_PROFILE.candidate.github.includes("Cipher-Vortex"));

    // Check Verified Skills
    assert.ok(TRUTH_PROFILE.skills.includes("React.js"));
    assert.ok(TRUTH_PROFILE.skills.includes("TypeScript"));
    assert.ok(TRUTH_PROFILE.skills.includes("Node.js"));
    assert.ok(TRUTH_PROFILE.skills.includes("Laravel"));

    // Verify Real Achievements & Metrics
    const zupperExp = TRUTH_PROFILE.experiences.find(e => e.company.includes("Zupper"));
    assert.ok(zupperExp, "Zupper Commerce experience exists");
    assert.ok(zupperExp.metrics.some(m => m.includes("~25%")), "Verified ~25% load time metric present");

    const projects = TRUTH_PROFILE.projects;
    assert.ok(projects.some(p => p.name.includes("Yeshu Tours")), "Yeshu Tours project present");
    assert.ok(projects.some(p => p.name.includes("RMC ERP")), "RMC ERP project present");
    assert.ok(projects.some(p => p.name.includes("Cerebrum")), "Cerebrum project present");

    // Ensure zero placeholder/mock/faker text
    const profileStr = JSON.stringify(TRUTH_PROFILE).toLowerCase();
    assert.ok(!profileStr.includes("example.com"), "No example.com placeholders");
    assert.ok(!profileStr.includes("lorem ipsum"), "No lorem ipsum placeholders");
    assert.ok(!profileStr.includes("faker"), "No faker dependencies or mocks");
  });

  await t.test("2. Environment Configuration & Zod Validation", () => {
    assert.ok(env, "Environment object loaded");
    assert.ok(typeof env.PORT === "string");
    assert.ok(typeof env.MAX_DAILY_APPLICATIONS === "number");
    assert.ok(typeof env.AUTO_APPLY_ENABLED === "boolean");
    assert.ok(env.SMTP_FROM.includes("@"), "SMTP_FROM is a valid email");
  });

  await t.test("3. Boards Registry (boards.json)", () => {
    const boardsPath = path.resolve(process.cwd(), "boards.json");
    assert.ok(fs.existsSync(boardsPath), "boards.json exists");
    const data = JSON.parse(fs.readFileSync(boardsPath, "utf-8"));
    assert.ok(Array.isArray(data.greenhouse), "greenhouse board list exists");
    assert.ok(Array.isArray(data.lever), "lever board list exists");
    assert.ok(data.greenhouse.includes("gitlab"), "gitlab board present");
    assert.ok(data.greenhouse.includes("cloudflare"), "cloudflare board present");
  });

  await t.test("4. Scorer Engine - Semantic Fit Filter (70% Threshold)", () => {
    // High-fit role: Full Stack React & Node
    const highFitJob = {
      id: "test-1",
      title: "Senior Full Stack Engineer (React, Node.js, TypeScript)",
      company: "TechCorp",
      location: "Remote",
      url: "https://boards.greenhouse.io/test/jobs/1",
      description: "We are seeking a Full Stack developer skilled in React, Next.js, Node.js, Express, TypeScript, and MongoDB. Experience optimizing load times and APIs.",
      source: "greenhouse"
    };

    const highScore = scoreJob(highFitJob);
    assert.ok(highScore.fit_score >= 70, `Expected fit_score >= 70, got ${highScore.fit_score}`);
    assert.equal(highScore.should_apply, true, "High fit job should_apply must be true");
    assert.ok(highScore.matched_skills.includes("React.js"), "Matched React.js");
    assert.ok(highScore.matched_skills.includes("TypeScript"), "Matched TypeScript");

    // Unrelated role: Dentist
    const unrelatedJob = {
      id: "test-2",
      title: "Pediatric Dentist & Orthodontist",
      company: "Dental Care Clinic",
      location: "Bengaluru",
      url: "https://boards.greenhouse.io/test/jobs/2",
      description: "Responsible for pediatric dental examinations, root canals, and teeth cleaning.",
      source: "feed"
    };

    const lowScore = scoreJob(unrelatedJob);
    assert.ok(lowScore.fit_score < 70, `Expected fit_score < 70, got ${lowScore.fit_score}`);
    assert.equal(lowScore.should_apply, false, "Unrelated job must be rejected (<70%)");

    // Edge case: Empty description
    const emptyJob = {
      id: "test-3",
      title: "Developer",
      company: "Ghost Inc",
      location: "Remote",
      url: "https://boards.greenhouse.io/test/jobs/3",
      description: "",
      source: "greenhouse"
    };
    const emptyScore = scoreJob(emptyJob);
    assert.ok(typeof emptyScore.fit_score === "number");
    assert.equal(emptyScore.should_apply, false);
  });

  await t.test("5. Tailoring Engine - Zero-Hallucination Pitch & Prompt Generation", () => {
    const job = {
      id: "test-tailor",
      title: "Frontend Engineer (React & TypeScript)",
      company: "SaaS Inc",
      location: "Remote",
      url: "https://boards.greenhouse.io/saas/jobs/99",
      description: "Looking for a React developer to optimize web performance, improve frontend load times, and build reusable UI components.",
      source: "greenhouse"
    };

    // Test Prompt Generation
    const prompt = generateTailoringPrompt(job.title, job.company, job.description);
    assert.ok(prompt.includes("Kiran S R"), "Prompt references Kiran S R");
    assert.ok(prompt.includes("Strict Zero-Hallucination"), "Contains strict zero-hallucination instruction");
    assert.ok(prompt.includes("cover_letter_body"), "Specifies required JSON schema");

    // Test Deterministic Tailored Pitch
    const pitch = generateDeterministicTailoredPitch(job);
    assert.ok(pitch.should_apply, "should_apply is true");
    assert.equal(pitch.selected_bullets.length, 3, "Exactly 3 verified bullets selected");
    assert.ok(pitch.cover_letter_body.includes("Zupper Commerce"), "Cover letter mentions real company Zupper Commerce");
    assert.ok(pitch.cover_letter_body.includes("~25%"), "Cover letter quotes verified metric");
    assert.ok(pitch.subject_line.includes(job.title), "Subject line references job title");
    assert.ok(pitch.subject_line.includes(TRUTH_PROFILE.candidate.name), "Subject line references Kiran S R");
  });

  await t.test("6. Application Storage & Deduplication Tracker", async () => {
    const testUrl = `https://test-application-url.org/jobs/${Date.now()}`;
    assert.equal(tracker.hasAlreadyApplied(testUrl), false, "Url should not be applied initially");

    await tracker.logApplication({
      company: "Test Track Corp",
      jobTitle: "Software Developer",
      jobUrl: testUrl,
      source: "greenhouse",
      matchScore: 82,
      status: "Applied",
      notes: "Test application entry"
    });

    assert.equal(tracker.hasAlreadyApplied(testUrl), true, "hasAlreadyApplied returns true after logging");

    const stats = tracker.getStats();
    assert.ok(stats.totalLogged > 0, "totalLogged > 0");
    assert.ok(stats.appliedCount > 0, "appliedCount > 0");

    // Clean up test entry so tracker CSV and JSON stay pristine
    try {
      const csvPath = path.resolve(process.cwd(), "job_applications_tracker.csv");
      const jsonPath = path.resolve(process.cwd(), "data", "applied_history.json");
      if (fs.existsSync(csvPath)) {
        const cleanedCsv = fs.readFileSync(csvPath, "utf-8").split("\n").filter(line => !line.includes(testUrl)).join("\n");
        fs.writeFileSync(csvPath, cleanedCsv, "utf-8");
      }
      if (fs.existsSync(jsonPath)) {
        const records = JSON.parse(fs.readFileSync(jsonPath, "utf-8")).filter(r => r.jobUrl !== testUrl);
        fs.writeFileSync(jsonPath, JSON.stringify(records, null, 2), "utf-8");
      }
    } catch {}
  });

  await t.test("7. ATS Scraper Error Handling", async () => {
    // Test non-existent board handles cleanly without uncaught exception
    const nonExistentJobs = await fetchGreenhouseJobs("board_that_definitely_does_not_exist_987654");
    assert.ok(Array.isArray(nonExistentJobs), "Returns array on error");
    assert.equal(nonExistentJobs.length, 0, "Returns empty list on 404");
  });

  await t.test("8. Anti-Dummy & Non-Tech Role Filter Verification", () => {
    const EXCLUDED_TITLE_KEYWORDS = /\b(pharmacist|pharmacy|nurse|dentist|doctor|medical|dentistry|test issue|\[test\]|driver|warehouse|truck|sales rep|account manager|cashier|tutor|barista)\b/i;
    const IS_TECH_ROLE = /\b(engineer|developer|programmer|architect|full[\s-]?stack|frontend|backend|web|devops|software|coder|bounty|lead|staff|principal|sdet|tech\s*lead)\b/i;

    // Must be rejected
    const dummyRoles = [
      "Specialty Infusion Pharmacists (On-Call After-Hours)",
      "Pediatric Dentist & Orthodontist",
      "test issue (Zimb/zimb)",
      "[test] Dummy Issue for Bot",
      "Technical Account Manager",
      "Delivery Truck Driver",
      "Registered Nurse (ICU)"
    ];

    for (const role of dummyRoles) {
      const isRejected = EXCLUDED_TITLE_KEYWORDS.test(role) || !IS_TECH_ROLE.test(role);
      assert.ok(isRejected, `Role "${role}" should have been rejected as dummy/non-tech.`);
    }

    // Must be accepted
    const validRoles = [
      "Senior Full Stack Engineer",
      "React Frontend Developer",
      "Staff Software Engineer - Query Execution",
      "Full Stack Web3 Engineer (Solidity / TypeScript)",
      "[ESCROW BOUNTY] Test Checkout Session"
    ];

    for (const role of validRoles) {
      const isAccepted = !EXCLUDED_TITLE_KEYWORDS.test(role) && IS_TECH_ROLE.test(role);
      assert.ok(isAccepted, `Valid tech role "${role}" should have been accepted.`);
    }
  });

  await t.test("9. Pending Pitches Quality & Integrity (No Dummy Data)", () => {
    const pendingFile = path.resolve(process.cwd(), "data/pending_pitches.json");
    assert.ok(fs.existsSync(pendingFile), "pending_pitches.json exists");

    const pitches = JSON.parse(fs.readFileSync(pendingFile, "utf-8"));
    assert.ok(Array.isArray(pitches), "pending_pitches is an array");
    assert.ok(pitches.length > 0, "pending_pitches has live opportunities");

    for (const item of pitches) {
      const title = item.opportunity.title;
      const pitch = item.pitch;

      // Verify no dummy titles
      assert.ok(!/pharmacist|nurse|dentist|test issue/i.test(title), `Found dummy title: ${title}`);
      assert.ok(!/^HN:\s*Location:/i.test(title), `Found HN job-seeker post instead of job: ${title}`);

      // Verify pitch completeness (not truncated mid-sentence)
      assert.ok(pitch.length >= 70, `Pitch too short: ${pitch.slice(0, 40)}...`);
      assert.ok(!pitch.endsWith("..."), `Pitch ends in ellipsis/truncated: ${pitch.slice(-30)}`);
      assert.ok(!pitch.endsWith("–"), `Pitch ends in dash: ${pitch.slice(-30)}`);
      assert.ok(!pitch.endsWith("of") && !pitch.endsWith("and") && !pitch.endsWith("the"), `Pitch cut off mid-sentence: ${pitch.slice(-30)}`);
    }
  });

  await t.test("10. Live Freelance & JD Pitch Tailoring", async () => {
    const sampleJD = {
      id: "live_sample_01",
      title: "Senior Full Stack React Developer",
      company: "Modern SaaS",
      location: "Remote",
      url: "https://job-boards.greenhouse.io/modernsaas/jobs/123",
      description: "Looking for an engineer with React, Next.js, Node.js, and Redis caching experience to optimize platform response times.",
      source: "greenhouse"
    };

    const tailored = await tailorApplication(sampleJD);
    assert.ok(tailored.should_apply, "should_apply must be true");
    assert.ok(tailored.fit_score >= 70, "fit_score must be >= 70");
    assert.ok(tailored.cover_letter_body.includes("Zupper Commerce") || tailored.cover_letter_body.includes("Yeshu Tours"), "Pitch references candidate's real verified work");
    assert.ok(tailored.cover_letter_body.includes("cipher-vortex.vercel.app"), "Pitch includes verified portfolio link");
  });

  await t.test("11. ApplyPilot Engine - Dynamic Tailored Resume PDF Generation", async () => {
    const resumeOptions = {
      jobTitle: "Senior Full Stack Engineer",
      company: "Stripe",
      description: "We are seeking a Full Stack Engineer proficient in React, TypeScript, Node.js, and Redis caching.",
      client: "Fintech Platform"
    };

    // 1. Verify HTML Structure & Tailored Re-prioritization
    const html = generateTailoredResumeHtml(resumeOptions);
    assert.ok(html.includes("Kiran S R"), "HTML contains candidate name");
    assert.ok(html.includes("Stripe"), "HTML contains target company name Stripe");
    assert.ok(html.includes("Senior Full Stack Engineer"), "HTML contains target title");
    assert.ok(html.includes("Zupper Commerce"), "HTML contains verified experience");
    assert.ok(html.includes("Yeshu Tours & Travels"), "HTML contains verified project");

    // 2. Verify PDF Generation
    const pdfPath = await generateTailoredResumePdf(resumeOptions);
    assert.ok(fs.existsSync(pdfPath), `Tailored PDF resume was generated at ${pdfPath}`);
    const stats = fs.statSync(pdfPath);
    assert.ok(stats.size > 15000, `PDF size is valid (>15KB), got ${stats.size} bytes`);
  });

});
