import { chromium } from "playwright";

async function inspectGitLab() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage();
  await page.goto("https://job-boards.greenhouse.io/gitlab/jobs/8826920002", { waitUntil: "domcontentloaded" });
  
  const fields = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll("input, select, textarea"));
    return inputs.map(el => {
      const label = document.querySelector(`label[for="${el.id}"]`)?.textContent?.trim() || "";
      return {
        id: el.id,
        name: el.getAttribute("name"),
        type: el.getAttribute("type"),
        tag: el.tagName.toLowerCase(),
        required: el.hasAttribute("required") || el.getAttribute("aria-required") === "true",
        label: label.slice(0, 80)
      };
    }).filter(f => f.required || f.id);
  });

  console.log("Total fields found:", fields.length);
  console.log("Required fields:", JSON.stringify(fields.filter(f => f.required), null, 2));

  const submitButtons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("button, input[type='submit']")).map(b => ({
      id: b.id,
      type: b.getAttribute("type"),
      text: b.textContent?.trim(),
      tag: b.tagName.toLowerCase()
    })).filter(b => (b.text || "").toLowerCase().includes("submit") || b.type === "submit");
  });

  console.log("Submit button selectors:", JSON.stringify(submitButtons, null, 2));

  await browser.close();
}

inspectGitLab();
