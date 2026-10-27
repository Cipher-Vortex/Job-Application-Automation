import "dotenv/config";
import path from "path";
import express from "express";
import cors from "cors";
import { connectDB } from "./config/db";
import JobModel from "./models/Job";
import { TRUTH_PROFILE } from "./config/truthProfile";
import { env } from "./config/env";
import { fetchAllBoardJobs, JobPosting } from "./discovery/atsScraper";
import { fetchAllRemoteFeeds } from "./discovery/remoteFeeds";
import { scoreJob, ScoreResult } from "./engine/scorer";
import { tailorApplication, TailoredPitch } from "./engine/tailor";
import { prefillApplication } from "./automation/formFiller";
import { tracker } from "./storage/tracker";

console.log("=================================================");
console.log(" Autonomous Job Application System (JobPilot AI)");
console.log(` Candidate: ${TRUTH_PROFILE.candidate.name} (${TRUTH_PROFILE.candidate.title})`);
console.log("=================================================");

export interface ScoredJob extends JobPosting {
  score: ScoreResult;
  tailored?: TailoredPitch;
}

/**
 * Main Autonomous Orchestration Cycle
 */
export async function runAutonomousCycle(options: {
  maxApplications?: number;
  openPrefillBrowser?: boolean;
} = {}): Promise<ScoredJob[]> {
  const maxApps = options.maxApplications ?? 5;
  const shouldOpenBrowser = options.openPrefillBrowser ?? false;

  console.log("\n[Phase 1] Discovering live opportunities across ATS boards & remote feeds...");
  
  const [boardJobs, remoteJobs] = await Promise.all([
    fetchAllBoardJobs(),
    fetchAllRemoteFeeds()
  ]);

  const rawJobs: JobPosting[] = [...boardJobs, ...remoteJobs];
  console.log(`[Phase 1 Complete] Collected ${rawJobs.length} total potential roles.`);

  console.log("\n[Phase 2] Filtering and scoring candidates against verified TRUTH_PROFILE...");
  const qualifiedJobs: ScoredJob[] = [];

  for (const job of rawJobs) {
    if (tracker.hasAlreadyApplied(job.url)) {
      continue;
    }

    const score = scoreJob(job);
    // Strict Fit Filter: Reject < 70% match
    if (score.should_apply && score.fit_score >= 70) {
      qualifiedJobs.push({ ...job, score });
    }
  }

  // Sort by highest fit score
  qualifiedJobs.sort((a, b) => b.score.fit_score - a.score.fit_score);
  console.log(`[Phase 2 Complete] Found ${qualifiedJobs.length} jobs with >= 70% fit.`);

  const targetBatch = qualifiedJobs.slice(0, maxApps);
  console.log(`\n[Phase 3] Tailoring high-confidence applications (Top ${targetBatch.length})...`);

  for (let i = 0; i < targetBatch.length; i++) {
    const item = targetBatch[i];
    console.log(`\n--- [Match #${i + 1}] ${item.title} at ${item.company} (${item.score.fit_score}% Fit) ---`);
    console.log(`URL: ${item.url}`);
    console.log(`Matched Skills: ${item.score.matched_skills.join(", ")}`);

    const tailored = await tailorApplication(item);
    item.tailored = tailored;

    // Log to tracker
    await tracker.logApplication({
      company: item.company,
      jobTitle: item.title,
      jobUrl: item.url,
      source: item.source,
      matchScore: item.score.fit_score,
      status: "Tailored",
      notes: `Matched: ${item.score.matched_skills.slice(0, 3).join(", ")}`
    });

    console.log(`Selected Verified Bullets:`);
    tailored.selected_bullets.forEach(b => console.log(`  * ${b}`));

    if (shouldOpenBrowser && i === 0) {
      console.log(`\n[Phase 4] Opening Playwright browser for interactive review...`);
      try {
        await prefillApplication(item.url, env.RESUME_PATH, {
          headless: false,
          coverLetter: tailored.cover_letter_body
        });
      } catch (err: any) {
        console.warn(`[Phase 4 Warning] Browser prefill skipped: ${err.message}`);
      }
    }
  }

  const stats = tracker.getStats();
  console.log("\n=================================================");
  console.log(` CYCLE COMPLETE: Processed ${targetBatch.length} Top Applications.`);
  console.log(` Total Tracked: ${stats.totalLogged} | Form Fill Reviewed: ${stats.appliedCount}`);
  console.log("=================================================\n");

  return targetBatch;
}

/**
 * Start Express HTTP Server for Web Dashboard & APIs
 */
export async function startServer() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(express.static(path.join(__dirname, "../frontend")));

  try {
    await connectDB();
  } catch {
    console.log("[DB] Running in standalone SQLite/CSV mode (MongoDB not connected).");
  }

  // Dashboard APIs
  app.get("/api/profile", (req, res) => {
    res.json(TRUTH_PROFILE);
  });

  app.get("/api/stats", (req, res) => {
    res.json(tracker.getStats());
  });

  app.post("/api/orchestrate", async (req, res) => {
    try {
      const results = await runAutonomousCycle({ maxApplications: req.body.limit || 5 });
      res.json({ success: true, count: results.length, jobs: results });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/prefill", async (req, res) => {
    const { url, coverLetter } = req.body;
    if (!url) return res.status(400).json({ error: "Missing url parameter" });
    try {
      await prefillApplication(url, env.RESUME_PATH, { headless: false, coverLetter });
      res.json({ success: true, message: "Browser launched for prefill." });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  const PORT = parseInt(env.PORT as string || "3000", 10);
  app.listen(PORT, () => {
    console.log(`[JobPilot AI Server] Listening at http://localhost:${PORT}`);
  });
}

// CLI Execution Router
const args = process.argv.slice(2);

if (args.includes("--cli") || args.includes("--run")) {
  const withBrowser = args.includes("--browser");
  runAutonomousCycle({ maxApplications: 5, openPrefillBrowser: withBrowser }).then(() => {
    console.log("[CLI] Run finished.");
    process.exit(0);
  }).catch(err => {
    console.error("[CLI Error]", err);
    process.exit(1);
  });
} else if (args.includes("--cron")) {
  console.log("[Cron Mode] Running autonomous orchestrator every 4 hours...");
  runAutonomousCycle();
  setInterval(() => {
    console.log("\n[Cron Trigger] Running periodic discovery and scoring...");
    runAutonomousCycle();
  }, 4 * 60 * 60 * 1000);
} else {
  // Default: Start Server & perform initial discovery check
  startServer();
}
