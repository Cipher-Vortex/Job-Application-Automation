import fs from "fs";
import path from "path";
import { chromium, Browser } from "playwright";
import { TRUTH_PROFILE } from "../config/truthProfile";

export interface TailoredResumeOptions {
  jobTitle: string;
  company: string;
  description?: string;
  client?: string;
}

export function generateTailoredResumeHtml(options: TailoredResumeOptions): string {
  const { jobTitle, company, description = "", client } = options;
  const jdLower = (jobTitle + " " + company + " " + description + " " + (client || "")).toLowerCase();

  // Re-prioritize skills based on JD
  const prioritizedSkills = [...TRUTH_PROFILE.skills].sort((a, b) => {
    const aMatch = jdLower.includes(a.toLowerCase()) ? 1 : 0;
    const bMatch = jdLower.includes(b.toLowerCase()) ? 1 : 0;
    return bMatch - aMatch;
  });

  // Tailored Summary targeted to company & role
  let summary = `Results-driven Full Stack Software Engineer with deep expertise in modern web architectures, React.js, TypeScript, and Node.js. Proven track record of reducing frontend load times by ~25% through performance optimization and code splitting at Zupper Commerce, and architecting high-availability booking and enterprise ERP platforms (Yeshu Tours & Travels, RMC ERP). Passionate about delivering high-performance, maintainable software tailored for ${company}.`;

  if (jdLower.includes("vue") || jdLower.includes("laravel")) {
    summary = `Full Stack Engineer specializing in Vue.js, Laravel, TypeScript, and high-throughput systems. Architected enterprise ERP solutions (RMC ERP) handling real-time sensor feeds, batching logs, and dispatch workflows. Experienced in delivering modular architectures and sub-second API performance tailored for ${company}.`;
  } else if (jdLower.includes("node") || jdLower.includes("backend") || jdLower.includes("redis")) {
    summary = `Full Stack Software Engineer with strong backend expertise in Node.js, Express, Redis caching, and RESTful APIs. Built and launched production booking platforms (Yeshu Tours & Travels) and high-speed commerce components (Zupper Commerce). Ready to drive scalable, robust backend services for ${company}.`;
  }

  // HTML Template for clean, ATS-compliant single-page PDF
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    color: #1a202c;
    background: #ffffff;
    line-height: 1.45;
    padding: 30px 40px;
    font-size: 13px;
  }
  .header {
    text-align: center;
    border-bottom: 2px solid #2b6cb0;
    padding-bottom: 12px;
    margin-bottom: 16px;
  }
  .name {
    font-size: 24px;
    font-weight: 700;
    color: #2b6cb0;
    letter-spacing: 0.5px;
  }
  .target-title {
    font-size: 14px;
    font-weight: 600;
    color: #4a5568;
    margin-top: 2px;
  }
  .contact {
    margin-top: 6px;
    font-size: 11.5px;
    color: #4a5568;
  }
  .contact a {
    color: #2b6cb0;
    text-decoration: none;
  }
  .section-title {
    font-size: 13px;
    font-weight: 700;
    text-transform: uppercase;
    color: #2b6cb0;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 3px;
    margin-top: 14px;
    margin-bottom: 8px;
    letter-spacing: 0.5px;
  }
  .summary-text {
    font-size: 12px;
    color: #2d3748;
    text-align: justify;
  }
  .skills-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 4px;
  }
  .skill-pill {
    background: #edf2f7;
    color: #2b6cb0;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11.5px;
  }
  .exp-item, .proj-item {
    margin-bottom: 10px;
  }
  .exp-header {
    display: flex;
    justify-content: space-between;
    font-weight: 600;
    font-size: 12.5px;
    color: #2d3748;
  }
  .exp-role {
    color: #4a5568;
    font-style: italic;
    font-size: 12px;
    margin-bottom: 4px;
  }
  ul {
    padding-left: 18px;
    margin-top: 3px;
  }
  li {
    font-size: 12px;
    color: #333;
    margin-bottom: 2px;
  }
</style>
</head>
<body>

<div class="header">
  <div class="name">${TRUTH_PROFILE.candidate.name}</div>
  <div class="target-title">${jobTitle} (Tailored for ${company})</div>
  <div class="contact">
    ${TRUTH_PROFILE.candidate.location} | 
    <a href="mailto:${TRUTH_PROFILE.candidate.email}">${TRUTH_PROFILE.candidate.email}</a> | 
    ${TRUTH_PROFILE.candidate.phone} | 
    <a href="${TRUTH_PROFILE.candidate.portfolio}">Portfolio</a> | 
    <a href="${TRUTH_PROFILE.candidate.github}">GitHub</a> | 
    <a href="${TRUTH_PROFILE.candidate.linkedin}">LinkedIn</a>
  </div>
</div>

<div class="section-title">Professional Summary</div>
<p class="summary-text">${summary}</p>

<div class="section-title">Core Technical Competencies</div>
<div class="skills-grid">
  ${prioritizedSkills.map(s => `<span class="skill-pill">${s}</span>`).join("")}
</div>

<div class="section-title">Professional Work Experience</div>
${TRUTH_PROFILE.experiences.map(exp => `
  <div class="exp-item">
    <div class="exp-header">
      <span>${exp.company}</span>
      <span>${exp.duration}</span>
    </div>
    <div class="exp-role">${exp.role}</div>
    <ul>
      ${exp.metrics.map(m => `<li>${m}</li>`).join("")}
    </ul>
  </div>
`).join("")}

<div class="section-title">Key Engineering Projects</div>
${TRUTH_PROFILE.projects.map(proj => `
  <div class="proj-item">
    <div class="exp-header">
      <span>${proj.name}</span>
      <span style="font-size: 11px; color: #4a5568;">${proj.stack}</span>
    </div>
    <ul>
      <li>${proj.points}</li>
    </ul>
  </div>
`).join("")}

</body>
</html>`;
}

export async function generateTailoredResumePdf(options: TailoredResumeOptions): Promise<string> {
  const dir = path.resolve(process.cwd(), "data/tailored_resumes");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const safeCompany = options.company.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 30);
  const safeTitle = options.jobTitle.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 30);
  const outPath = path.resolve(dir, `Kiran_SR_${safeCompany}_${safeTitle}.pdf`);

  const html = generateTailoredResumeHtml(options);

  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({
      channel: "chrome",
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });
  } catch {
    try {
      browser = await chromium.launch({
        channel: "msedge",
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"]
      });
    } catch {
      browser = await chromium.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"]
      });
    }
  }

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "domcontentloaded" });
  await page.pdf({
    path: outPath,
    format: "A4",
    printBackground: true,
    margin: {
      top: "10mm",
      bottom: "10mm",
      left: "12mm",
      right: "12mm"
    }
  });

  await browser.close();
  console.log(`[ResumeTailor] Tailored PDF resume generated: ${outPath}`);
  return outPath;
}
