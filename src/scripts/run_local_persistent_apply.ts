import { prefillWithPersistentContext } from "../automation/persistentFormFiller";

async function main() {
  const args = process.argv.slice(2);
  const targetUrl = args[0] || "https://job-boards.greenhouse.io/gitlab/jobs/8476686002";
  const autoSubmit = args.includes("--submit");

  console.log("==================================================================");
  console.log("🚀 LOCAL PLAYWRIGHT PERSISTENT APPLICATION RUNNER");
  console.log(`Target: ${targetUrl}`);
  console.log(`AutoSubmit: ${autoSubmit}`);
  console.log("==================================================================");

  const result = await prefillWithPersistentContext(targetUrl, {
    headless: false,
    autoSubmit,
    userDataDir: "./user-data-dir",
  });

  console.log(`\nForm populated with ${result.fieldsFilled.length} fields.`);
  console.log("Resume attached:", result.resumeAttached);
  console.log("\nPress Ctrl+C in terminal when you are done to close browser.");

  // Keep process alive so browser remains open on user desktop
  await new Promise(() => {});
}

main().catch((err) => {
  console.error("Local apply error:", err);
  process.exit(1);
});
