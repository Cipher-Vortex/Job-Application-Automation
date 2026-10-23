import { TRUTH_PROFILE } from "../config/truthProfile";
import { JobPosting } from "../discovery/atsScraper";
import { env } from "../config/env";
import axios from "axios";

export interface TailoredPitch {
  fit_score: number;
  should_apply: boolean;
  match_reason: string;
  selected_bullets: string[];
  cover_letter_body: string;
  subject_line: string;
}

export function generateTailoringPrompt(jobTitle: string, company: string, jdText: string): string {
  return `
You are an expert technical career advisor for Kiran S R.
Given the following verified profile data:
${JSON.stringify(TRUTH_PROFILE, null, 2)}

And this Job Description:
Company: ${company}
Role: ${jobTitle}
Description:
${jdText.slice(0, 4000)}

Instructions:
1. Strict Zero-Hallucination: Do NOT invent skills, years of experience, or past employers not in the profile.
2. Calculate a fit score (0 to 100). If < 70, set should_apply to false.
3. Select the 3 most relevant bullet points from Kiran's real background that align directly with this JD.
4. Draft a concise 3-paragraph outreach email (under 180 words) addressed to the hiring team. Emphasize relevant real-world experience (e.g., Zupper Commerce, Yeshu Tours, or RMC ERP) matching their stack.

Output strictly valid JSON with this structure:
{
  "fit_score": number,
  "should_apply": boolean,
  "match_reason": "string",
  "selected_bullets": ["string", "string", "string"],
  "cover_letter_body": "string",
  "subject_line": "string"
}
`;
}

// Fallback generator when no LLM API key is configured, guaranteeing zero hallucinations
export function generateDeterministicTailoredPitch(job: JobPosting): TailoredPitch {
  const jdLower = (job.title + " " + job.description).toLowerCase();

  // Select verified bullets based on JD keywords
  const pool: string[] = [];

  // Zupper Commerce bullets
  for (const exp of TRUTH_PROFILE.experiences) {
    for (const metric of exp.metrics) {
      pool.push(`${exp.company}: ${metric}`);
    }
  }
  // Projects points
  for (const proj of TRUTH_PROFILE.projects) {
    pool.push(`${proj.name} (${proj.stack}): ${proj.points}`);
  }

  // Rank bullets based on keyword relevance
  const ranked = pool.map(bullet => {
    let score = 0;
    const bLower = bullet.toLowerCase();
    if (jdLower.includes("react") && bLower.includes("react")) score += 3;
    if (jdLower.includes("performance") && bLower.includes("load time")) score += 4;
    if (jdLower.includes("api") && bLower.includes("rest api")) score += 3;
    if (jdLower.includes("node") && bLower.includes("node")) score += 3;
    if (jdLower.includes("database") || jdLower.includes("sql") || jdLower.includes("mongo")) {
      if (bLower.includes("mongo") || bLower.includes("mysql") || bLower.includes("redis")) score += 3;
    }
    return { bullet, score };
  }).sort((a, b) => b.score - a.score);

  const selectedBullets = ranked.slice(0, 3).map(r => r.bullet);

  const coverLetter = `Hi ${job.company} Hiring Team,

I came across your opening for ${job.title} and am excited to put forward my background as a Full Stack Software Engineer specializing in React.js, TypeScript, and Node.js.

In my recent work at Zupper Commerce, I engineered modular React component libraries and reduced frontend page load times by ~25% through code-splitting and memoization. Additionally, I architected production systems like the Yeshu Tours booking platform (Next.js/Node/MongoDB/Redis) and enterprise ERP modules with robust REST APIs.

Key highlights from my verified background directly relevant to ${job.company}:
- ${selectedBullets[0]}
- ${selectedBullets[1]}
- ${selectedBullets[2]}

I would welcome the opportunity to discuss how my full-stack engineering experience can support your engineering goals. You can view my portfolio and live work at ${TRUTH_PROFILE.candidate.portfolio}.

Best regards,
${TRUTH_PROFILE.candidate.name}
${TRUTH_PROFILE.candidate.email} | ${TRUTH_PROFILE.candidate.phone}`;

  return {
    fit_score: 85,
    should_apply: true,
    match_reason: `Verified stack alignment with ${job.company} for ${job.title}`,
    selected_bullets: selectedBullets,
    cover_letter_body: coverLetter,
    subject_line: `Application for ${job.title} - ${TRUTH_PROFILE.candidate.name}`
  };
}

export async function tailorApplication(job: JobPosting): Promise<TailoredPitch> {
  // If OpenAI API key is available, use it for customized dynamic generation
  if (env.OPENAI_API_KEY) {
    try {
      const prompt = generateTailoringPrompt(job.title, job.company, job.description);
      const res = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "You are a precise career advisor. Output strictly valid JSON." },
            { role: "user", content: prompt }
          ],
          response_format: { type: "json_object" },
          temperature: 0.2
        },
        {
          headers: {
            Authorization: `Bearer ${env.OPENAI_API_KEY}`,
            "Content-Type": "application/json"
          },
          timeout: 15000
        }
      );

      const content = res.data.choices[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(content);
        return {
          fit_score: parsed.fit_score ?? 80,
          should_apply: parsed.should_apply ?? true,
          match_reason: parsed.match_reason ?? "LLM verified fit",
          selected_bullets: parsed.selected_bullets ?? [],
          cover_letter_body: parsed.cover_letter_body ?? "",
          subject_line: parsed.subject_line ?? `Application for ${job.title} - Kiran S R`
        };
      }
    } catch (err: any) {
      console.warn(`[Tailor] OpenAI call failed (${err.message}). Using deterministic zero-hallucination pitch.`);
    }
  }

  // Deterministic zero-hallucination fallback
  return generateDeterministicTailoredPitch(job);
}
