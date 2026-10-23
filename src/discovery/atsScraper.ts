import axios from "axios";
import fs from "fs";
import path from "path";

export interface JobPosting {
  id: string;
  title: string;
  company: string;
  location: string;
  url: string;
  description: string;
  source: "greenhouse" | "lever" | "feed";
}

// Greenhouse Public Board API
export async function fetchGreenhouseJobs(boardToken: string): Promise<JobPosting[]> {
  try {
    const res = await axios.get(`https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs?content=true`, {
      timeout: 10000,
      headers: { "User-Agent": "JobPilot-AI-Agent/1.0" }
    });
    if (!res.data || !Array.isArray(res.data.jobs)) return [];
    return res.data.jobs.map((job: any) => ({
      id: String(job.id),
      title: job.title || "Untitled Role",
      company: boardToken,
      location: job.location?.name || "Remote",
      url: job.absolute_url,
      description: job.content || "",
      source: "greenhouse" as const
    }));
  } catch (err: any) {
    console.warn(`[Greenhouse] Skipped or failed board ${boardToken}: ${err.message}`);
    return [];
  }
}

// Lever Public Postings API
export async function fetchLeverJobs(company: string): Promise<JobPosting[]> {
  try {
    const res = await axios.get(`https://api.lever.co/v0/postings/${company}?mode=json`, {
      timeout: 10000,
      headers: { "User-Agent": "JobPilot-AI-Agent/1.0" }
    });
    if (!res.data || !Array.isArray(res.data)) return [];
    return res.data.map((job: any) => ({
      id: String(job.id),
      title: job.text || "Untitled Role",
      company: company,
      location: job.categories?.location || "Remote",
      url: job.hostedUrl,
      description: job.descriptionPlain || job.description || "",
      source: "lever" as const
    }));
  } catch (err: any) {
    console.warn(`[Lever] Skipped or failed board ${company}: ${err.message}`);
    return [];
  }
}

// Discover across all boards from boards.json
export async function fetchAllBoardJobs(customBoardsPath?: string): Promise<JobPosting[]> {
  const filePath = customBoardsPath || path.resolve(process.cwd(), "boards.json");
  if (!fs.existsSync(filePath)) {
    console.warn(`[ATS] boards.json not found at ${filePath}`);
    return [];
  }

  const boardsData = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  const greenhouseBoards: string[] = boardsData.greenhouse || [];
  const leverBoards: string[] = boardsData.lever || [];

  const allJobs: JobPosting[] = [];

  console.log(`[ATS] Fetching from ${greenhouseBoards.length} Greenhouse boards and ${leverBoards.length} Lever boards...`);

  const ghPromises = greenhouseBoards.map(board => fetchGreenhouseJobs(board));
  const leverPromises = leverBoards.map(board => fetchLeverJobs(board));

  const results = await Promise.allSettled([...ghPromises, ...leverPromises]);

  for (const res of results) {
    if (res.status === "fulfilled" && Array.isArray(res.value)) {
      allJobs.push(...res.value);
    }
  }

  console.log(`[ATS] Total jobs collected from ATS boards: ${allJobs.length}`);
  return allJobs;
}
