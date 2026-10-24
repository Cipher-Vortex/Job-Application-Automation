import axios from "axios";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { generateTailoredPitch, OpportunityInfo } from "./pitchGenerator";
import { notifyOpportunity } from "./telegramNotifier";

dotenv.config();

const SEEN_FILE = path.resolve(process.cwd(), "data/seen_opportunities.json");

const KEYWORDS = /\b(react|next\.?js|node|typescript|javascript|laravel|vue|mern|full[\s-]?stack|frontend|backend|web\s*developer|software\s*engineer|tailwind|mongodb|express|bounty)\b/i;

export class ScoutEngine {
  private seenIds: Set<string>;

  constructor() {
    this.seenIds = this.loadSeenIds();
  }

  private loadSeenIds(): Set<string> {
    try {
      const dir = path.dirname(SEEN_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      if (fs.existsSync(SEEN_FILE)) {
        const raw = fs.readFileSync(SEEN_FILE, "utf-8");
        const list = JSON.parse(raw);
        if (Array.isArray(list)) return new Set(list);
      }
    } catch (e: any) {
      console.warn(`[ScoutEngine] Could not load seen opportunities: ${e.message}`);
    }
    return new Set<string>();
  }

  private persistSeenIds() {
    try {
      const dir = path.dirname(SEEN_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(SEEN_FILE, JSON.stringify([...this.seenIds], null, 2));
    } catch (e: any) {
      console.warn(`[ScoutEngine] Could not save seen opportunities: ${e.message}`);
    }
  }

  // 1. Hunt Paid Freelance Gigs on Reddit r/forhire (JSON + RSS Failover)
  public async huntFreelanceGigs(): Promise<OpportunityInfo[]> {
    console.log("[Scout] 🔍 Scanning Reddit r/forhire for new [Hiring] gigs...");
    const discovered: OpportunityInfo[] = [];

    // Attempt 1: Reddit JSON API
    try {
      const res = await axios.get("https://www.reddit.com/r/forhire/new.json?limit=25", {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
          "Accept": "application/json",
        },
        timeout: 8000,
      });

      const posts = res.data?.data?.children || [];
      for (const item of posts) {
        const post = item.data;
        const id = `reddit_${post.id}`;
        if (this.seenIds.has(id)) continue;

        const title = post.title || "";
        const body = post.selftext || "";
        const combined = `${title} ${body}`;

        const isHiring = /\[hiring\]/i.test(title) && !/\[for hire\]/i.test(title);
        if (isHiring && KEYWORDS.test(combined)) {
          this.seenIds.add(id);
          // Try to extract budget
          const budgetMatch = combined.match(/\$[\d,]+(?:\s*-\s*\$[\d,]+)?(?:\s*\/(?:hr|hour|flat|project))?/i) ||
                              combined.match(/₹[\d,]+|budget:\s*[^,\n\.]+/i);
          const opp: OpportunityInfo = {
            id,
            type: "freelance",
            title: title.replace(/^\[hiring\]\s*/i, "").trim(),
            companyOrClient: `Reddit u/${post.author}`,
            budgetOrSalary: budgetMatch ? budgetMatch[0].trim() : "Quoted per project",
            url: `https://reddit.com${post.permalink}`,
            description: body.slice(0, 1000) || title,
          };
          discovered.push(opp);
        }
      }
      if (posts.length > 0) return discovered;
    } catch (err: any) {
      console.log(`[Scout] Reddit JSON returned ${err.response?.status || err.message}, switching to RSS feed...`);
    }

    // Attempt 2: Reddit RSS Feed fallback
    try {
      const rssRes = await axios.get("https://www.reddit.com/r/forhire/new.rss", {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        timeout: 8000,
      });

      const xml = rssRes.data as string;
      const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
      let match;

      while ((match = entryRegex.exec(xml)) !== null) {
        const entry = match[1];
        const idMatch = entry.match(/<id>(.*?)<\/id>/);
        const titleMatch = entry.match(/<title>([\s\S]*?)<\/title>/);
        const linkMatch = entry.match(/<link\s+href="([^"]+)"/);
        const contentMatch = entry.match(/<content[^>]*>([\s\S]*?)<\/content>/);

        if (!idMatch || !titleMatch || !linkMatch) continue;

        const rawId = idMatch[1];
        const id = `reddit_rss_${rawId.split("/").pop() || rawId}`;
        if (this.seenIds.has(id)) continue;

        const title = titleMatch[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
        const url = linkMatch[1];
        const body = (contentMatch ? contentMatch[1] : "").replace(/<[^>]+>/g, " ").slice(0, 1000);
        const combined = `${title} ${body}`;

        const isHiring = /\[hiring\]/i.test(title) && !/\[for hire\]/i.test(title);
        if (isHiring && KEYWORDS.test(combined)) {
          this.seenIds.add(id);
          const budgetMatch = combined.match(/\$[\d,]+(?:\s*-\s*\$[\d,]+)?(?:\s*\/(?:hr|hour|flat|project))?/i) ||
                              combined.match(/₹[\d,]+|budget:\s*[^,\n\.]+/i);

          const opp: OpportunityInfo = {
            id,
            type: "freelance",
            title: title.replace(/^\[hiring\]\s*/i, "").trim(),
            companyOrClient: "Reddit r/forhire Client",
            budgetOrSalary: budgetMatch ? budgetMatch[0].trim() : "Quoted per project",
            url,
            description: body || title,
          };
          discovered.push(opp);
        }
      }
    } catch (rssErr: any) {
      console.warn(`[Scout] Reddit RSS fallback error: ${rssErr.message}`);
    }

    return discovered;
  }

  // 2. Hunt Paid GitHub Bounties
  public async huntGitHubBounties(): Promise<OpportunityInfo[]> {
    console.log("[Scout] 💎 Scanning GitHub API for paid issues & bounties...");
    const discovered: OpportunityInfo[] = [];

    const queries = [
      'label:bounty language:TypeScript state:open',
      'label:bounty language:JavaScript state:open',
      '"💎 Bounty" state:open',
    ];

    for (const q of queries) {
      try {
        const queryEncoded = encodeURIComponent(q);
        const res = await axios.get(
          `https://api.github.com/search/issues?q=${queryEncoded}&sort=created&order=desc&per_page=10`,
          {
            headers: {
              "User-Agent": "JobScout-App/1.0",
              "Accept": "application/vnd.github.v3+json",
            },
            timeout: 10000,
          }
        );

        for (const issue of res.data?.items || []) {
          const id = `gh_bounty_${issue.id}`;
          if (this.seenIds.has(id)) continue;

          this.seenIds.add(id);

          const title = issue.title;
          const body = issue.body || "";
          const repoUrl = issue.repository_url || "";
          const repoName = repoUrl.split("/").slice(-2).join("/");

          // Extract bounty value if present
          const bountyMatch = (title + " " + body).match(/\$[\d,]+(?:\s*USDC|\s*USD)?/i) ||
                              (title + " " + body).match(/[\d,]+\s*USDC/i);

          discovered.push({
            id,
            type: "bounty",
            title: `${title} (${repoName || "Open Source"})`,
            companyOrClient: repoName ? `GitHub: ${repoName}` : "GitHub Open Source",
            budgetOrSalary: bountyMatch ? bountyMatch[0].trim() : "Paid Bounty",
            url: issue.html_url,
            description: body.slice(0, 1000) || title,
          });
        }
      } catch (err: any) {
        console.warn(`[Scout] GitHub bounty query error: ${err.message}`);
      }
    }

    return discovered;
  }

  // 3. Hunt Remote Developer Jobs on RemoteOK & Himalayas
  public async huntRemoteJobs(): Promise<OpportunityInfo[]> {
    console.log("[Scout] 🚀 Scanning RemoteOK & Remote APIs for developer jobs...");
    const discovered: OpportunityInfo[] = [];

    // RemoteOK API
    try {
      const res = await axios.get("https://remoteok.com/api", {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) JobScout/1.0" },
        timeout: 10000,
      });

      const items = Array.isArray(res.data) ? res.data.slice(1) : [];
      for (const job of items.slice(0, 40)) {
        const id = `rok_${job.id}`;
        if (this.seenIds.has(id)) continue;

        const role = job.position || "";
        const tags = Array.isArray(job.tags) ? job.tags.join(" ") : "";
        const combined = `${role} ${tags}`;

        if (KEYWORDS.test(combined)) {
          this.seenIds.add(id);
          const salary = job.salary_min && job.salary_max 
            ? `$${job.salary_min}k - $${job.salary_max}k` 
            : (job.salary || "Competitive Market Rate");

          discovered.push({
            id,
            type: "remote_job",
            title: role,
            companyOrClient: job.company || "Remote Company",
            budgetOrSalary: salary,
            url: job.apply_url || job.url ? (job.url.startsWith("http") ? job.url : `https://remoteok.com${job.url}`) : "https://remoteok.com",
            description: (job.description || "").replace(/<[^>]+>/g, " ").slice(0, 1000),
            tags: job.tags,
          });
        }
      }
    } catch (err: any) {
      console.warn(`[Scout] RemoteOK API error: ${err.message}`);
    }

    // Himalayas API
    try {
      const res = await axios.get("https://himalayas.app/jobs/api", {
        headers: { "User-Agent": "JobScout-App/1.0" },
        timeout: 10000,
      });

      const jobs = Array.isArray(res.data?.jobs) ? res.data.jobs : [];
      for (const job of jobs.slice(0, 30)) {
        const id = `him_${job.id || job.slug}`;
        if (this.seenIds.has(id)) continue;

        const role = job.title || "";
        const desc = job.excerpt || job.description || "";
        const combined = `${role} ${desc}`;

        if (KEYWORDS.test(combined)) {
          this.seenIds.add(id);
          const salary = job.minSalary && job.maxSalary 
            ? `$${Math.round(job.minSalary / 1000)}k - $${Math.round(job.maxSalary / 1000)}k` 
            : "Competitive";

          discovered.push({
            id,
            type: "remote_job",
            title: role,
            companyOrClient: job.companyName || "Himalayas Tech",
            budgetOrSalary: salary,
            url: job.applicationLink || `https://himalayas.app/jobs/${job.slug || ""}`,
            description: desc.slice(0, 1000),
          });
        }
      }
    } catch (err: any) {
      console.warn(`[Scout] Himalayas API error: ${err.message}`);
    }

    return discovered;
  }

  // 4. Hunt Remote Developer Jobs on We Work Remotely (Front-End & Full-Stack RSS)
  public async huntWeWorkRemotely(): Promise<OpportunityInfo[]> {
    console.log("[Scout] 🌐 Scanning We Work Remotely (WWR) RSS feeds...");
    const discovered: OpportunityInfo[] = [];

    const feeds = [
      "https://weworkremotely.com/categories/remote-front-end-programming-jobs.rss",
      "https://weworkremotely.com/categories/remote-full-stack-programming-jobs.rss"
    ];

    for (const feedUrl of feeds) {
      try {
        const res = await axios.get(feedUrl, {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) JobScout/1.0" },
          timeout: 8000,
        });

        const xml = res.data as string;
        const itemRegex = /<item>([\s\S]*?)<\/item>/g;
        let match;

        while ((match = itemRegex.exec(xml)) !== null) {
          const item = match[1];
          const titleMatch = item.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) || item.match(/<title>([\s\S]*?)<\/title>/);
          const linkMatch = item.match(/<link>([\s\S]*?)<\/link>/);
          const descMatch = item.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) || item.match(/<description>([\s\S]*?)<\/description>/);
          const guidMatch = item.match(/<guid[^>]*>([\s\S]*?)<\/guid>/);

          if (!titleMatch || !linkMatch) continue;

          const rawTitle = titleMatch[1].trim();
          const url = linkMatch[1].trim();
          const rawId = guidMatch ? guidMatch[1].trim() : url;
          const id = `wwr_${rawId.split("/").pop() || rawId}`;

          if (this.seenIds.has(id)) continue;

          // Title format on WWR is typically: "Company: Position"
          let company = "WWR Remote Company";
          let position = rawTitle;
          if (rawTitle.includes(":")) {
            const parts = rawTitle.split(":");
            company = parts[0].trim();
            position = parts.slice(1).join(":").trim();
          }

          const desc = (descMatch ? descMatch[1] : "").replace(/<[^>]+>/g, " ").slice(0, 1000);
          const combined = `${rawTitle} ${desc}`;

          if (KEYWORDS.test(combined)) {
            this.seenIds.add(id);
            discovered.push({
              id,
              type: "remote_job",
              title: position,
              companyOrClient: company,
              budgetOrSalary: "Top Tier Remote Salary",
              url,
              description: desc || rawTitle,
            });
          }
        }
      } catch (err: any) {
        console.warn(`[Scout] WWR feed notice: ${err.message}`);
      }
    }

    return discovered;
  }

  // 5. Hunt Hacker News Monthly "Who is Hiring?" Thread
  public async huntHackerNewsHiring(): Promise<OpportunityInfo[]> {
    console.log("[Scout] 📰 Scanning Hacker News 'Who is Hiring?' threads...");
    const discovered: OpportunityInfo[] = [];

    const queries = ["hiring react", "hiring full stack", "hiring typescript"];

    for (const q of queries) {
      try {
        const res = await axios.get(
          `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(q)}&tags=comment&numericFilters=created_at_i>${Math.floor(Date.now() / 1000) - 86400 * 30}`,
          { timeout: 8000 }
        );

        for (const hit of res.data?.hits || []) {
          const id = `hn_${hit.objectID}`;
          if (this.seenIds.has(id)) continue;

          const text = (hit.comment_text || "").replace(/<[^>]+>/g, " ");
          if (KEYWORDS.test(text) && /(remote|contract|full.?time)/i.test(text)) {
            this.seenIds.add(id);

            // First line or snippet as title
            const lines = text.split("\n").map((l: string) => l.trim()).filter(Boolean);
            const titleSnippet = lines[0] ? lines[0].slice(0, 80) : "Hacker News Hiring Posting";

            discovered.push({
              id,
              type: "freelance",
              title: `HN: ${titleSnippet}`,
              companyOrClient: "Hacker News YC / Startup Founder",
              budgetOrSalary: "Direct Contract / Competitive",
              url: `https://news.ycombinator.com/item?id=${hit.objectID}`,
              description: text.slice(0, 1000),
            });
          }
        }
      } catch (err: any) {
        console.warn(`[Scout] HN API notice: ${err.message}`);
      }
    }

    return discovered;
  }

  // Master execution loop
  public async runScoutCycle(): Promise<{ found: number; notified: number }> {
    console.log(`\n======================================================`);
    console.log(`📡 [AGENT SCOUT] Initiating Multi-Channel Hunt Cycle...`);
    console.log(`Timestamp: ${new Date().toLocaleString()}`);
    console.log(`Seen opportunities tracked: ${this.seenIds.size}`);
    console.log(`Channels: Reddit | GitHub Bounties | RemoteOK | Himalayas | WWR | HackerNews`);
    console.log(`======================================================`);

    const [freelanceGigs, bounties, remoteJobs, wwrJobs, hnHiring] = await Promise.all([
      this.huntFreelanceGigs(),
      this.huntGitHubBounties(),
      this.huntRemoteJobs(),
      this.huntWeWorkRemotely(),
      this.huntHackerNewsHiring(),
    ]);

    const allNewOpportunities = [
      ...freelanceGigs,
      ...bounties,
      ...remoteJobs,
      ...wwrJobs,
      ...hnHiring,
    ];
    console.log(`\n🎯 New matching opportunities discovered: ${allNewOpportunities.length}`);

    let notifiedCount = 0;
    for (const opp of allNewOpportunities) {
      try {
        console.log(`⚡ Generating tailored pitch for: "${opp.title}"...`);
        const pitch = await generateTailoredPitch(opp);
        await notifyOpportunity(opp, pitch);
        notifiedCount++;
        this.persistSeenIds();
      } catch (err: any) {
        console.warn(`[Scout] Failed to process opportunity ${opp.id}: ${err.message}`);
      }
    }

    this.persistSeenIds();
    console.log(`✅ Hunt cycle complete. Processed ${notifiedCount} new pitches.`);
    return { found: allNewOpportunities.length, notified: notifiedCount };
  }
}
