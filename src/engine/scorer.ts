import { TRUTH_PROFILE } from "../config/truthProfile";
import { JobPosting } from "../discovery/atsScraper";

export interface ScoreResult {
  fit_score: number;
  should_apply: boolean;
  match_reason: string;
  matched_skills: string[];
  missing_skills: string[];
}

export function scoreJob(job: JobPosting): ScoreResult {
  const jdText = `${job.title} ${job.description}`.toLowerCase();
  
  // Keyword banks from verified profile
  const verifiedSkills = TRUTH_PROFILE.skills.map(s => s.toLowerCase());
  const roleKeywords = ["software", "developer", "engineer", "frontend", "full stack", "fullstack", "react", "node", "web"];

  // 1. Role / Title Match (up to 30 points)
  let titleScore = 0;
  const titleLower = job.title.toLowerCase();
  if (titleLower.includes("full stack") || titleLower.includes("fullstack")) {
    titleScore = 30;
  } else if (titleLower.includes("frontend") || titleLower.includes("react") || titleLower.includes("web developer")) {
    titleScore = 28;
  } else if (titleLower.includes("software engineer") || titleLower.includes("software developer")) {
    titleScore = 25;
  } else if (roleKeywords.some(kw => titleLower.includes(kw))) {
    titleScore = 18;
  }

  // 2. Skill Overlap Match (up to 50 points)
  const matchedSkills: string[] = [];
  const missingSkills: string[] = [];

  for (const skill of TRUTH_PROFILE.skills) {
    const sLower = skill.toLowerCase();
    // Normalize punctuation
    const cleanSkill = sLower.replace(".js", "");
    if (jdText.includes(sLower) || jdText.includes(cleanSkill)) {
      matchedSkills.push(skill);
    }
  }

  const skillCoverage = verifiedSkills.length > 0 ? (matchedSkills.length / Math.min(verifiedSkills.length, 8)) : 0;
  const skillScore = Math.min(50, Math.round(skillCoverage * 50));

  // 3. Experience & Stack Synergy (up to 20 points)
  let synergyScore = 0;
  if (jdText.includes("react") || jdText.includes("next")) synergyScore += 6;
  if (jdText.includes("node") || jdText.includes("express") || jdText.includes("rest api")) synergyScore += 5;
  if (jdText.includes("typescript") || jdText.includes("javascript")) synergyScore += 5;
  if (jdText.includes("mongodb") || jdText.includes("mysql") || jdText.includes("redis")) synergyScore += 4;
  synergyScore = Math.min(20, synergyScore);

  const totalScore = Math.min(100, titleScore + skillScore + synergyScore);
  const shouldApply = totalScore >= 70;

  let reason = "";
  if (shouldApply) {
    reason = `Strong alignment with ${matchedSkills.slice(0, 4).join(", ")} and role focus (${totalScore}% fit).`;
  } else {
    reason = `Low alignment (${totalScore}% fit). Insufficient verified skill overlap or out of scope.`;
  }

  return {
    fit_score: totalScore,
    should_apply: shouldApply,
    match_reason: reason,
    matched_skills: matchedSkills,
    missing_skills: missingSkills
  };
}
