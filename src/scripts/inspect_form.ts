import { chromium } from "playwright";

async function inspectGitLab() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage();
  const targetUrl = "https://job-boards.greenhouse.io/gitlab/jobs/8826965002";
  console.log("Navigating to:", targetUrl);
  await page.goto(targetUrl, { waitUntil: "networkidle", timeout: 30000 });
  console.log("Page title:", await page.title());
  
  const fields = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll("input, select, textarea, [role='combobox']"));
    return inputs.map(el => {
      const parentLabel = el.closest('div')?.querySelector('label')?.textContent?.trim() || "";
      const directLabel = document.querySelector(`label[for="${el.id}"]`)?.textContent?.trim() || "";
      const label = directLabel || parentLabel;
      return {
        id: el.id,
        name: el.getAttribute("name"),
        type: el.getAttribute("type"),
        tag: el.tagName.toLowerCase(),
        required: el.hasAttribute("required") || el.getAttribute("aria-required") === "true",
        label: label.replace(/\s+/g, ' ').slice(0, 100)
      };
    }).filter(f => f.required || /name|email|phone|resume|country|legal|visa|gender|race|notice/i.test(f.label) || f.id);
  });

  console.log("Form fields count:", fields.length);
  console.log("Form Fields:", JSON.stringify(fields, null, 2));

  await browser.close();
}

inspectGitLab();
