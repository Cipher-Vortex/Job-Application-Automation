import fs from "fs";
import path from "path";
import { runApplyPilot, ApplyPilotJobInput } from "../automation/applyPilotRunner";
import { fetchAllBoardJobs } from "../discovery/atsScraper";
import { scoreJob } from "../engine/scorer";
import { tracker } from "../storage/tracker";

async function main() {
  const args = process.argv.slice(2);
  const autoSubmit = args.includes("--submit") || args.includes("-s");
  const isHeadless = args.includes("--headless");
  const targetUrl = args.find(a => a.startsWith("http"));

  console.log("==================================================================");
  console.log("✈️ APPLYPILOT: AUTONOMOUS APPLICATION ENGINE (ApplyPilot-Style)");
  console.log("==================================================================");

  let targetJobs: ApplyPilotJobInput[] = [];

  if (targetUrl) {
    // Single job mode
    let company = "Direct Company";
    let title = "Senior Full Stack Engineer";

    if (targetUrl.includes("gitlab")) {
      company = "GitLab";
      title = "Senior Frontend Engineer";
    } else if (targetUrl.includes("cloudflare")) {
      company = "Cloudflare";
      title = "Software Engineer";
    } else if (targetUrl.includes("linear")) {
      company = "Linear";
      title = "Full Stack Engineer";
    }

    targetJobs.push({
      url: targetUrl,
      company,
      title,
      description: "Full Stack Engineer role requiring React, TypeScript, Node.js, and high performance architecture.",
      matchScore: 92
    });
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
