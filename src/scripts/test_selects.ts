import { chromium } from "playwright";
import fs from "fs";
import path from "path";

async function inspectDropdowns() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage();
  await page.goto("https://job-boards.greenhouse.io/gitlab/jobs/8826965002", { waitUntil: "networkidle" });

  const info = await page.evaluate(() => {
    const results: any[] = [];
    const labels = Array.from(document.querySelectorAll("label"));
    for (const label of labels) {
      const text = label.textContent?.trim() || "";
      const forAttr = label.getAttribute("for");
      const parent = label.closest(".field, div");
      const inputs = parent ? Array.from(parent.querySelectorAll("input, select, textarea, button, [role='combobox']")) : [];
      results.push({
        label: text.replace(/\s+/g, ' ').slice(0, 80),
        forAttr,
        inputs: inputs.map(i => ({
          tag: i.tagName.toLowerCase(),
          id: i.id,
          type: i.getAttribute("type"),
          role: i.getAttribute("role"),
          className: i.className
        }))
      });
    }
    return results;
  });

  console.log(JSON.stringify(info.filter(i => i.label.length > 0), null, 2));
  await browser.close();
}

inspectDropdowns();
