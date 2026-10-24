import axios from "axios";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

export interface LocalLead {
  businessName: string;
  category: "Travel Operator" | "Homestay/Resort" | "Clinic" | "Packers/Movers";
  locality: string;
  phone: string;
  website?: string;
  websiteStatus: "MISSING" | "NEEDS_REVAMP" | "HEALTHY";
  pitchOffer: string;
  whatsappDirectLink: string;
}

const LEADS_FILE = path.resolve(process.cwd(), "data/local_business_leads.json");

// Curated high-potential target niches in Bengaluru
const BENGALURU_NICHES = [
  {
    category: "Travel Operator" as const,
    locality: "Majestic / Koramangala / Indiranagar",
    sampleBusinesses: [
      { name: "Sri Manjunatha Tour Travels", phone: "+91 98451 23456", website: "" },
      { name: "Cauvery Cabs & Outstation Travels", phone: "+91 99002 34567", website: "http://cauverycabs.tripod.com" },
      { name: "Bengaluru City Taxi & Holiday Tours", phone: "+91 94480 87654", website: "" }
    ]
  },
  {
    category: "Homestay/Resort" as const,
    locality: "Sakleshpur / Coorg / Nandi Hills Outskirts",
    sampleBusinesses: [
      { name: "Nandi Misty Valley Homestay", phone: "+91 98800 11223", website: "" },
      { name: "Green Mist Retreat & Stay", phone: "+91 97412 33445", website: "http://greenmistretreat.wordpress.com" }
    ]
  },
  {
    category: "Clinic" as const,
    locality: "HSR Layout / Whitefield",
    sampleBusinesses: [
      { name: "Apex Smile Dental Care", phone: "+91 98450 99887", website: "" },
      { name: "Kiran Physiotherapy & Rehab", phone: "+91 99801 22334", website: "" }
    ]
  }
];

export async function checkWebsiteHealth(url?: string): Promise<"MISSING" | "NEEDS_REVAMP" | "HEALTHY"> {
  if (!url || url.trim() === "") return "MISSING";
  if (url.includes("tripod.com") || url.includes("wordpress.com") || url.includes("blogspot.com")) {
    return "NEEDS_REVAMP";
  }
  try {
    const res = await axios.get(url, { timeout: 5000, validateStatus: () => true });
    if (res.status >= 400) return "NEEDS_REVAMP";
    return "HEALTHY";
  } catch {
    return "NEEDS_REVAMP";
  }
}

export function generateLocalPitch(name: string, category: string, locality: string, status: string): string {
  if (category === "Travel Operator") {
    return `Namaste ${name} team! 🙏\n\nI came across your travel listing in ${locality}. I noticed you don't have a dedicated mobile booking website yet (most tourists today prefer checking cab prices and booking directly on WhatsApp from their phone).\n\nI am a local software developer here in Bengaluru. I recently built and launched yeshutoursandtravels.com—a high-speed booking website with one-tap WhatsApp inquiry integration.\n\nI can deploy a professional, mobile-first booking website for ${name} in 4 days for a one-time fee of ₹8,000, or manage your web presence for ₹2,000/month.\n\nWould you like me to send a 1-minute video demo of how it works for your business?\n\nBest regards,\nKiran S R\nBengaluru | https://cipher-vortex.vercel.app`;
  }

  if (category === "Homestay/Resort") {
    return `Hello ${name} management! 🌿\n\nI saw your stay in ${locality}. Did you know homestays lose 15-20% in platform commissions on Airbnb/MakeMyTrip when guests can't book directly?\n\nI built yeshutoursandtravels.com and can launch a direct WhatsApp booking site with photo galleries and room rates for ${name} in 4 days for ₹8,000 (one-time fee).\n\nCan I send you a free mockup preview today?\n\nRegards,\nKiran S R | https://cipher-vortex.vercel.app`;
  }

  return `Hello ${name} team,\n\nI noticed patients in ${locality} looking for your services don't have a fast mobile appointment page. I can create a clean appointment booking site with WhatsApp integration in 3 days for ₹8,000.\n\nLet me know if you would like to see a sample.\n\nRegards,\nKiran S R | https://cipher-vortex.vercel.app`;
}

export async function runLocalBusinessLeadGen() {
  console.log("==================================================================");
  console.log("🎯 BENGALURU LOCAL BUSINESS LEAD HUNTER (₹8k Sites / ₹2k Retainers)");
  console.log("Targeting: Travel Operators, Homestays, and Clinics in Bengaluru");
  console.log("==================================================================");

  const leads: LocalLead[] = [];

  for (const niche of BENGALURU_NICHES) {
    console.log(`\n🔎 Evaluating Niche: ${niche.category} (${niche.locality})...`);

    for (const biz of niche.sampleBusinesses) {
      const status = await checkWebsiteHealth(biz.website);
      const pitch = generateLocalPitch(biz.name, niche.category, niche.locality, status);
      const cleanPhone = biz.phone.replace(/[^0-9]/g, "");
      const waLink = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(pitch)}`;

      const lead: LocalLead = {
        businessName: biz.name,
        category: niche.category,
        locality: niche.locality,
        phone: biz.phone,
        website: biz.website || undefined,
        websiteStatus: status,
        pitchOffer: pitch,
        whatsappDirectLink: waLink
      };

      leads.push(lead);

      console.log(`\n📍 [${lead.websiteStatus}] ${lead.businessName} (${lead.phone})`);
      console.log(`💬 WhatsApp Outreach Link: ${lead.whatsappDirectLink}`);
      console.log("------------------------------------------------------------------");
      console.log(pitch);
      console.log("------------------------------------------------------------------");
    }
  }

  const dir = path.dirname(LEADS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));

  // Generate interactive HTML Dashboard
  const htmlPath = path.resolve(dir, "leads_dashboard.html");
  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Bengaluru Local Business Leads — ₹8,000 Pitch Pipeline</title>
  <style>
    :root { --bg: #0f172a; --card: #1e293b; --text: #f8fafc; --accent: #10b981; --muted: #94a3b8; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: var(--bg); color: var(--text); padding: 2rem; margin: 0; }
    .header { max-width: 900px; margin: 0 auto 2rem; border-bottom: 1px solid #334155; padding-bottom: 1rem; }
    h1 { color: #38bdf8; margin: 0 0 0.5rem; }
    .lead-grid { display: grid; gap: 1.5rem; max-width: 900px; margin: 0 auto; }
    .card { background: var(--card); border: 1px solid #334155; border-radius: 12px; padding: 1.5rem; }
    .tag { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; }
    .tag-missing { background: #ef444422; color: #f87171; border: 1px solid #ef444455; }
    .tag-revamp { background: #f59e0b22; color: #fbbf24; border: 1px solid #f59e0b55; }
    .pitch-box { background: #0f172a; border-radius: 8px; padding: 1rem; font-family: monospace; font-size: 0.85rem; color: #cbd5e1; white-space: pre-wrap; margin: 1rem 0; }
    .btn { display: inline-flex; align-items: center; gap: 0.5rem; background: #25d366; color: white; padding: 0.6rem 1.2rem; border-radius: 8px; text-decoration: none; font-weight: 600; transition: transform 0.1s; }
    .btn:hover { transform: scale(1.02); }
  </style>
</head>
<body>
  <div class="header">
    <h1>🎯 Bengaluru Local Business Leads (₹8k Sites / ₹2k Retainers)</h1>
    <p style="color: var(--muted); margin: 0;">Clicking "Open WhatsApp Chat" opens WhatsApp Web / mobile with the pre-filled pitch citing <b>yeshutoursandtravels.com</b>.</p>
  </div>
  <div class="lead-grid">
    ${leads.map(l => `
      <div class="card">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <h2 style="margin:0; font-size:1.25rem;">${l.businessName}</h2>
          <span class="tag ${l.websiteStatus === 'MISSING' ? 'tag-missing' : 'tag-revamp'}">${l.websiteStatus}</span>
        </div>
        <p style="color:var(--muted); margin:0.3rem 0;">📍 ${l.locality} &bull; 🏷️ ${l.category} &bull; 📞 ${l.phone}</p>
        <div class="pitch-box">${l.pitchOffer}</div>
        <a class="btn" href="${l.whatsappDirectLink}" target="_blank">💬 Open WhatsApp Chat with Pre-filled Pitch</a>
      </div>
    `).join("")}
  </div>
</body>
</html>`;
  fs.writeFileSync(htmlPath, htmlContent);

  console.log(`\n✅ Generated ${leads.length} high-ticket local business outreach leads.`);
  console.log(`💾 JSON Saved to: ${LEADS_FILE}`);
  console.log(`🌐 Visual HTML Dashboard: ${htmlPath}`);
  console.log(`💡 Pro-tip: Just tap any WhatsApp link above to open chat with pre-filled pitch!`);
}

if (require.main === module) {
  runLocalBusinessLeadGen().catch(console.error);
}
