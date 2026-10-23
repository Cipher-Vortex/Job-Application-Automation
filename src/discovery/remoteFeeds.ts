import axios from "axios";
import { JobPosting } from "./atsScraper";

// RemoteOK Public API
export async function fetchRemoteOkJobs(): Promise<JobPosting[]> {
  try {
    const res = await axios.get("https://remoteok.com/api", {
      timeout: 10000,
      headers: {
        "User-Agent": "JobPilot-Agent-Kiran (skkiran1258@gmail.com)"
      }
    });

    if (!Array.isArray(res.data)) return [];

    // First element in RemoteOK API response is legal disclaimer object
    const jobs = res.data.slice(1);

    return jobs.slice(0, 50).map((job: any) => ({
      id: `remoteok_${job.id || Math.random().toString(36).substring(7)}`,
      title: job.position || "Software Engineer",
      company: job.company || "Remote Company",
      location: job.location || "Worldwide Remote",
      url: job.url ? (job.url.startsWith("http") ? job.url : `https://remoteok.com${job.url}`) : "https://remoteok.com",
      description: job.description || "",
      source: "feed" as const
    }));
  } catch (err: any) {
    console.warn(`[RemoteFeeds] Error fetching RemoteOK jobs: ${err.message}`);
    return [];
  }
}

// Himalayas Public API
export async function fetchHimalayasJobs(): Promise<JobPosting[]> {
  try {
    const res = await axios.get("https://himalayas.app/jobs/api", {
      timeout: 10000,
      headers: { "User-Agent": "JobPilot-AI-Agent/1.0" }
    });

    if (!res.data || !Array.isArray(res.data.jobs)) return [];

    return res.data.jobs.slice(0, 50).map((job: any) => ({
      id: `himalayas_${job.id || Math.random().toString(36).substring(7)}`,
      title: job.title || "Software Developer",
      company: job.companyName || "Remote Tech",
      location: Array.isArray(job.locationRestrictions) && job.locationRestrictions.length > 0 
        ? job.locationRestrictions.join(", ") 
        : "Remote",
      url: job.applicationLink || `https://himalayas.app/jobs/${job.slug || ""}`,
      description: job.excerpt || job.description || "",
      source: "feed" as const
    }));
  } catch (err: any) {
    console.warn(`[RemoteFeeds] Error fetching Himalayas jobs: ${err.message}`);
    return [];
  }
}

// Aggregate remote feeds
export async function fetchAllRemoteFeeds(): Promise<JobPosting[]> {
  console.log("[RemoteFeeds] Pulling live remote developer jobs...");
  const [remoteOkJobs, himalayasJobs] = await Promise.allSettled([
    fetchRemoteOkJobs(),
    fetchHimalayasJobs()
  ]);

  const allJobs: JobPosting[] = [];
  if (remoteOkJobs.status === "fulfilled") allJobs.push(...remoteOkJobs.value);
  if (himalayasJobs.status === "fulfilled") allJobs.push(...himalayasJobs.value);

  console.log(`[RemoteFeeds] Total live remote jobs retrieved: ${allJobs.length}`);
  return allJobs;
}
