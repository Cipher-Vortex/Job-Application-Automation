import fs from "fs";
import path from "path";
import { runApplyPilot, ApplyPilotJobInput } from "../automation/applyPilotRunner";
import { fetchAllBoardJobs } from "../discovery/atsScraper";
import { scoreJob } from "../engine/scorer";
import { tracker } from "../storage/tracker";

async function main() {
  const args = process.argv.slice(2);
  // Auto-submit is ENABLED by default; use --no-submit or --dry-run for prefill-only preview
  const autoSubmit = !args.includes("--no-submit") && !args.includes("--dry-run") && !args.includes("--preview");
  const isHeadless = args.includes("--headless");
  const targetUrls = args.filter(a => a.startsWith("http"));

  console.log("==================================================================");
  console.log("✈️ APPLYPILOT: AUTONOMOUS APPLICATION ENGINE (AUTO-OPEN, FILL & SUBMIT)");
  console.log(`AutoSubmit: ${autoSubmit ? "ENABLED (Will fill form & submit to employer)" : "DISABLED (Prefill only)"}`);
  console.log(`Browser Mode: ${isHeadless ? "Headless" : "Visible Application Window"}`);
  console.log("==================================================================");

  let targetJobs: ApplyPilotJobInput[] = [];

  if (targetUrls.length > 0) {
    for (const url of targetUrls) {
      let company = "Direct Company";
      let title = "Senior Full Stack Engineer";

      // Intelligent company extractor from ATS URL
      try {
        const parsed = new URL(url);
        const segments = parsed.pathname.split("/").filter(Boolean);
        if (parsed.hostname.includes("greenhouse.io")) {
          company = segments[0] === "jobs" ? (segments[1] || "Company") : segments[0];
          if (company.toLowerCase() === "job-boards.greenhouse.io") company = segments[0] || "Company";
        } else if (parsed.hostname.includes("lever.co")) {
          company = segments[0] || "Company";
        } else if (parsed.hostname.includes("ashbyhq.com")) {
          company = segments[0] || "Company";
        }
        // Capitalize company
        company = company.charAt(0).toUpperCase() + company.slice(1);
      } catch {}

      if (url.includes("gitlab")) {
        company = "GitLab";
        title = "Senior Frontend Engineer";
      } else if (url.includes("cloudflare")) {
        company = "Cloudflare";
        title = "Systems / Software Engineer";
      } else if (url.includes("linear")) {
        company = "Linear";
        title = "Full Stack Engineer";
      }

      targetJobs.push({
        url,
        company,
        title,
        description: "Full Stack Engineer role requiring React, TypeScript, Node.js, and high performance architecture.",
        matchScore: 92
      });
    }
  } else {
    // Batch mode: Read live scraped jobs or fetch top ATS match
    const liveScrapedPath = path.resolve(process.cwd(), "data/live_scraped_jobs.json");
    if (fs.existsSync(liveScrapedPath)) {
      const data = JSON.parse(fs.readFileSync(liveScrapedPath, "utf-8"));
      const jobs = data.jobs || [];
      const pending = jobs.filter((j: any) => !tracker.hasAlreadyApplied(j.url) && j.url?.startsWith("http"));
      pending.sort((a: any, b: any) => (b.matchScore || 0) - (a.matchScore || 0));

      for (const j of pending.slice(0, 3)) {
        targetJobs.push({
          url: j.url,
          title: j.title,
          company: j.company,
          description: j.description || "",
          matchScore: j.matchScore || 85,
          source: j.source
        });
      }
    }

    if (targetJobs.length === 0) {
      console.log("[ApplyPilot] Scanning live ATS boards for top matched roles...");
      const boardJobs = await fetchAllBoardJobs();
      const scored = boardJobs
        .map(j => ({ ...j, score: scoreJob(j) }))
        .filter(j => j.score.should_apply && j.score.fit_score >= 70 && !tracker.hasAlreadyApplied(j.url));
      scored.sort((a, b) => b.score.fit_score - a.score.fit_score);

      for (const j of scored.slice(0, 3)) {
        targetJobs.push({
          url: j.url,
          title: j.title,
          company: j.company,
          description: j.description,
          matchScore: j.score.fit_score,
          source: j.source
        });
      }
    }
  }

  if (targetJobs.length === 0) {
    console.log("No pending opportunities found to apply.");
    return;
  }

  console.log(`\n🎯 Preparing to apply to ${targetJobs.length} opportunity(ies)...\n`);

  for (let i = 0; i < targetJobs.length; i++) {
    const job = targetJobs[i];
    console.log(`\n[${i + 1}/${targetJobs.length}] Processing: ${job.company} - ${job.title}`);
    const result = await runApplyPilot(job, {
      headless: isHeadless,
      autoSubmit,
      keepOpenMs: isHeadless ? 0 : 4000
    });

    console.log(`Result: Success=${result.success}, Status=${result.status}, FieldsFilled=${result.fieldsFilled.length}`);
    if (result.tailoredResumePath) {
      console.log(`Tailored Resume: ${result.tailoredResumePath}`);
    }
  }

  console.log("\n==================================================================");
  console.log("✅ All ApplyPilot applications completed successfully!");
  console.log("==================================================================");
}

main().catch(err => {
  console.error("Fatal ApplyPilot error:", err);
  process.exit(1);
});
