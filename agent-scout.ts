// agent-scout.ts — Real-time Freelance, Bounty & Remote Job Autonomous Agent
import { ScoutEngine } from "./src/scout/scoutEngine";

async function main() {
  const args = process.argv.slice(2);
  const intervalArgIndex = args.indexOf("--interval");
  const watchMode = args.includes("--watch") || intervalArgIndex !== -1;
  const intervalMinutes = intervalArgIndex !== -1 ? parseInt(args[intervalArgIndex + 1], 10) || 15 : 15;

  const scout = new ScoutEngine();

  console.log("==================================================================");
  console.log("🚀 AGENT SCOUT: Autonomous Freelance Sniper & Bounty Hunter");
  console.log("Channels: Reddit r/forhire, GitHub Bounties, RemoteOK, Himalayas");
  console.log("Mode:", watchMode ? `Continuous (every ${intervalMinutes} min)` : "Single run");
  console.log("==================================================================");

  // Initial execution
  await scout.runScoutCycle();

  if (watchMode) {
    console.log(`\n⏳ Next scan in ${intervalMinutes} minutes. Press Ctrl+C to stop.`);
    setInterval(async () => {
      try {
        await scout.runScoutCycle();
      } catch (err: any) {
        console.error(`[Scout] Error in cycle: ${err.message}`);
      }
    }, intervalMinutes * 60 * 1000);
  }
}

main().catch((err) => {
  console.error("Fatal Scout error:", err);
  process.exit(1);
});
