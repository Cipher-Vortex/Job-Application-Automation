import axios from "axios";
import fs from "fs";
import TelegramBot from "node-telegram-bot-api";
import { config } from "dotenv";

config();

const SEEN_FILE = "./seen_opportunities.json";
const seenIds: Set<string> = new Set(
  fs.existsSync(SEEN_FILE) ? JSON.parse(fs.readFileSync(SEEN_FILE, "utf-8")) : []
);

const KEYWORDS = /react|next\.?js|node|typescript|javascript|laravel|vue|mern|full.?stack|frontend|website|api|tailwind/i;

const botToken = process.env.TELEGRAM_BOT_TOKEN || "";
const chatId = process.env.TELEGRAM_CHAT_ID || "";

const bot = botToken ? new (TelegramBot as any)(botToken, { polling: false }) : null;

async function generatePitch(title: string, description: string): Promise<string> {
    const prompt = `Write a 4-line pitch for a freelance gig or job: "${title}". Strictly use my real experience (Yeshu Tours & Travels, RMC ERP, Zupper Commerce).`;

    // Fallback if no LLM is configured.
    return `Hi, I saw your post for "${title}". I'm a developer with experience building real-world applications like Yeshu Tours & Travels, RMC ERP, and Zupper Commerce. I'd love to help you with this project! Let's connect.`;
}

async function notifyTelegram(type: string, title: string, url: string, pitch: string) {
    if (bot && chatId) {
        const message = `*${type}*\n\n*Title:* ${title}\n\n*Pitch:*\n\`${pitch}\`\n\n*URL:* ${url}`;
        await bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
    }
}

// 1. Hunt Paid Freelance Gigs on Reddit r/forhire
async function huntFreelanceGigs() {
  try {
      const { data } = await axios.get("https://www.reddit.com/r/forhire/new.json?limit=25", {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) JobScout/1.0" }
      });
      const posts = data?.data?.children || [];
      for (const item of posts) {
        const post = item.data;
        if (
          !seenIds.has(post.id) &&
          /\[hiring\]/i.test(post.title) &&
          KEYWORDS.test(`${post.title} ${post.selftext}`)
        ) {
          seenIds.add(post.id);
          console.log(`\n💰 [FREELANCE GIG] ${post.title}`);
          const url = `https://reddit.com${post.permalink}`;
          console.log(`🔗 URL: ${url}`);
          const pitch = await generatePitch(post.title, post.selftext);
          await notifyTelegram("💰 FREELANCE GIG", post.title, url, pitch);
        }
      }
  } catch (error) {
      console.error("Error fetching Reddit jobs:", error);
  }
}

// 2. Hunt Paid Open-Source Bounties on GitHub (TypeScript / React)
async function huntGitHubBounties() {
  try {
      const query = encodeURIComponent('label:bounty,"💎 Bounty" language:TypeScript state:open');
      const { data } = await axios.get(`https://api.github.com/search/issues?q=${query}&sort=created&order=desc&per_page=10`);
      for (const issue of data.items || []) {
        const id = `gh-bounty-${issue.id}`;
        if (!seenIds.has(id)) {
          seenIds.add(id);
          console.log(`\n💎 [GITHUB BOUNTY] ${issue.title}`);
          const url = issue.html_url;
          console.log(`🔗 URL: ${url}`);
          const pitch = await generatePitch(issue.title, issue.body || "");
          await notifyTelegram("💎 GITHUB BOUNTY", issue.title, url, pitch);
        }
      }
  } catch (error) {
      console.error("Error fetching GitHub bounties:", error);
  }
}

// 3. Hunt Remote Engineering Jobs on RemoteOK API
async function huntRemoteJobs() {
  try {
      const { data } = await axios.get("https://remoteok.com/api");
      const jobs = Array.isArray(data) ? data.slice(1) : [];
      for (const job of jobs.slice(0, 20)) {
        const id = `rok-${job.id}`;
        if (!seenIds.has(id) && KEYWORDS.test(`${job.position} ${job.tags?.join(" ")}`)) {
          seenIds.add(id);
          console.log(`\n🚀 [REMOTE JOB] ${job.position} @ ${job.company}`);
          const url = job.apply_url || job.url;
          console.log(`🔗 Apply: ${url}`);
          const pitch = await generatePitch(job.position, job.description || "");
          await notifyTelegram("🚀 REMOTE JOB", `${job.position} @ ${job.company}`, url, pitch);
        }
      }
  } catch (error) {
      console.error("Error fetching RemoteOK jobs:", error);
  }
}

async function runAgent() {
  console.log("Running Agent Scout...");
  await huntFreelanceGigs();
  await huntGitHubBounties();
  await huntRemoteJobs();
  fs.writeFileSync(SEEN_FILE, JSON.stringify([...seenIds], null, 2));
  console.log("Agent Scout complete.");
}

if (require.main === module) {
  runAgent();
}

export { runAgent, huntFreelanceGigs, huntGitHubBounties, huntRemoteJobs };
