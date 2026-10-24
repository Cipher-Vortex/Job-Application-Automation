import axios from "axios";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { OpportunityInfo } from "./pitchGenerator";

dotenv.config();

const PENDING_FILE = path.resolve(process.cwd(), "data/pending_pitches.json");

export interface PitchNotification {
  opportunity: OpportunityInfo;
  pitch: string;
  createdAt: string;
  deliveredToTelegram: boolean;
}

function ensureDataDir() {
  const dir = path.dirname(PENDING_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function saveLocalPitch(item: PitchNotification) {
  ensureDataDir();
  let list: PitchNotification[] = [];
  if (fs.existsSync(PENDING_FILE)) {
    try {
      list = JSON.parse(fs.readFileSync(PENDING_FILE, "utf-8"));
    } catch {
      list = [];
    }
  }
  list.unshift(item);
  // Keep last 100 pitches
  if (list.length > 100) list = list.slice(0, 100);
  fs.writeFileSync(PENDING_FILE, JSON.stringify(list, null, 2));
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function notifyOpportunity(opp: OpportunityInfo, pitch: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  const icon =
    opp.type === "freelance" ? "💰 [FREELANCE GIG]" :
    opp.type === "bounty" ? "💎 [GITHUB BOUNTY]" : "🚀 [REMOTE JOB]";

  // Console output
  console.log("\n" + "=".repeat(70));
  console.log(`${icon} ${opp.title}`);
  if (opp.companyOrClient) console.log(`🏢 Client/Org: ${opp.companyOrClient}`);
  if (opp.budgetOrSalary) console.log(`💵 Budget/Comp: ${opp.budgetOrSalary}`);
  console.log(`🔗 URL: ${opp.url}`);
  console.log("-".repeat(70));
  console.log("📝 TAILORED PITCH (Ready to Send):");
  console.log(pitch);
  console.log("=".repeat(70) + "\n");

  let delivered = false;

  if (token && chatId && !token.includes("your_") && !chatId.includes("your_")) {
    try {
      const messageHtml = `
<b>${icon}</b>
<b>${escapeHtml(opp.title)}</b>

🏢 <b>Client/Company:</b> ${escapeHtml(opp.companyOrClient || "Direct")}
💵 <b>Budget/Salary:</b> ${escapeHtml(opp.budgetOrSalary || "Competitive")}
🔗 <a href="${escapeHtml(opp.url)}">Open Opportunity Link</a>

<b>📝 Tap-to-Copy Pitch:</b>
<code>${escapeHtml(pitch)}</code>
`.trim();

      const tgUrl = `https://api.telegram.org/bot${token}/sendMessage`;
      await axios.post(tgUrl, {
        chat_id: chatId,
        text: messageHtml,
        parse_mode: "HTML",
        disable_web_page_preview: false,
      }, { timeout: 10000 });

      console.log(`[TelegramNotifier] Alert delivered to Telegram chat (${chatId})`);
      delivered = true;
    } catch (err: any) {
      console.warn(`[TelegramNotifier] Failed to send to Telegram: ${err.response?.data?.description || err.message}`);
    }
  } else {
    console.log(`[TelegramNotifier] Note: TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not configured in .env. Saved to ${PENDING_FILE}`);
  }

  saveLocalPitch({
    opportunity: opp,
    pitch,
    createdAt: new Date().toISOString(),
    deliveredToTelegram: delivered,
  });

  return delivered;
}
