import OpenAI from "openai";
import dotenv from "dotenv";
import { TRUTH_PROFILE } from "../config/truthProfile";

dotenv.config();

export interface OpportunityInfo {
  id: string;
  type: "freelance" | "bounty" | "remote_job";
  title: string;
  companyOrClient?: string;
  budgetOrSalary?: string;
  url: string;
  description: string;
  tags?: string[];
}

function getLLMClient(): { client: OpenAI; model: string } {
  const groqKey = process.env.GROK_API_KEY || process.env.GROQ_API_KEY;
  if (groqKey && groqKey.startsWith("gsk_")) {
    return {
      client: new OpenAI({
        apiKey: groqKey,
        baseURL: "https://api.groq.com/openai/v1",
      }),
      model: "openai/gpt-oss-120b",
    };
  }

  if (process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.includes("dummy")) {
    return {
      client: new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      }),
      model: "gpt-4o-mini",
    };
  }

  // Fallback to Groq with default key if present
  return {
    client: new OpenAI({
      apiKey: groqKey || "dummy_key",
      baseURL: "https://api.groq.com/openai/v1",
    }),
    model: "openai/gpt-oss-120b",
  };
}

export async function generateTailoredPitch(opp: OpportunityInfo): Promise<string> {
  const { client, model } = getLLMClient();

  const prompt = `
You are drafting an immediate, high-converting pitch for Kiran S R, a Full Stack & Frontend Engineer based in Bengaluru, India.

CANDIDATE TRUTH PROFILE:
- Name: Kiran S R (skkiran1258@gmail.com, Portfolio: https://cipher-vortex.vercel.app, GitHub: https://github.com/Cipher-Vortex)
- Core Stack: React.js, Next.js, TypeScript, Node.js, Express, MongoDB, Tailwind CSS, Laravel, Vue 3, Redis, REST APIs.
- Real Projects & Credentials:
  1. "Yeshu Tours & Travels" (https://yeshutoursandtravels.com): Full-scale travel booking engine with customer portal, admin dashboard, Redis caching, and WhatsApp enquiry integration.
  2. "RMC ERP": Enterprise ERP with Laravel, Vue 3, Inertia.js, handling batching logs, sensor feeds, and dispatch workflows.
  3. "Zupper Commerce": Built 20+ reusable React components, reduced page load times by ~25% using memoization and code splitting.
  4. "Cerebrum": AI note-taking platform with Grok API and RAG architecture.

OPPORTUNITY DETAILS:
- Category: ${opp.type.toUpperCase()}
- Title: ${opp.title}
- Client/Company: ${opp.companyOrClient || "Direct Client"}
- Budget/Compensation: ${opp.budgetOrSalary || "Competitive"}
- Description / Context: ${opp.description.slice(0, 1000)}

INSTRUCTIONS:
1. Write a direct, punchy, professional pitch (around 80–120 words).
2. Choose the most relevant project between Yeshu Tours & Travels, RMC ERP, or Zupper Commerce based on the job requirements.
3. Be confident, concise, and focused on delivering results immediately.
4. If it's a Reddit gig or bounty, propose immediate turnaround or PR delivery.
5. End with a polite, direct call to action and Kiran's portfolio link (https://cipher-vortex.vercel.app).
6. Do NOT include placeholder tags like "[Your Name]". Use Kiran S R. Do NOT include markdown headers. Just the pitch text ready to copy.
`;

  try {
    const response = await client.chat.completions.create({
      model: model,
      messages: [
        {
          role: "system",
          content: "You are a professional freelance & developer agent who writes succinct, compelling client pitches based strictly on verified credentials.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.6,
      max_tokens: 300,
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (content) return content;
  } catch (err: any) {
    console.warn(`[PitchGenerator] LLM Error (${err.message}). Using fallback template.`);
  }

  // Graceful deterministic fallback template if LLM is unavailable
  return `Hi there,

I saw your requirement for "${opp.title}" and would love to help you build and ship this.

I'm a Full Stack Engineer specializing in React, Next.js, TypeScript, and Node.js. Recently, I built and deployed Yeshu Tours & Travels (full-scale booking engine with Redis and responsive UI) and engineered modular React systems at Zupper Commerce, optimizing page load times by 25%.

I can deliver clean, modular code with immediate turnaround. You can view my live work at https://cipher-vortex.vercel.app.

Looking forward to connecting!
Best regards,
Kiran S R`;
}
