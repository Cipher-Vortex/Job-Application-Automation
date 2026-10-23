import fs from "fs";
import path from "path";
import JobModel from "../models/Job";

export interface ApplicationRecord {
  id?: string;
  company: string;
  jobTitle: string;
  jobUrl: string;
  source: string;
  matchScore: number;
  status: "Discovered" | "Tailored" | "Applied" | "Pending Review" | "Skipped";
  appliedDate?: string;
  notes?: string;
}

export class ApplicationTracker {
  private csvPath: string;
  private jsonPath: string;

  constructor() {
    this.csvPath = path.resolve(process.cwd(), "job_applications_tracker.csv");
    this.jsonPath = path.resolve(process.cwd(), "data", "applied_history.json");
    this.initStorage();
  }

  private initStorage() {
    // Ensure CSV header exists if file doesn't exist
    if (!fs.existsSync(this.csvPath)) {
      const header = "Date,Company,Job Title,Match Score,Source,Job URL,Status,Notes\n";
      fs.writeFileSync(this.csvPath, header, "utf-8");
    }

    const dataDir = path.dirname(this.jsonPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    if (!fs.existsSync(this.jsonPath)) {
      fs.writeFileSync(this.jsonPath, "[]", "utf-8");
    }
  }

  public async logApplication(record: ApplicationRecord): Promise<void> {
    const timestamp = record.appliedDate || new Date().toISOString().split("T")[0];
    const notes = (record.notes || "").replace(/"/g, '""');
    const companyClean = record.company.replace(/"/g, '""');
    const titleClean = record.jobTitle.replace(/"/g, '""');

    // 1. Append to CSV
    const csvLine = `"${timestamp}","${companyClean}","${titleClean}",${record.matchScore},"${record.source}","${record.jobUrl}","${record.status}","${notes}"\n`;
    try {
      fs.appendFileSync(this.csvPath, csvLine, "utf-8");
    } catch (e: any) {
      console.warn(`[Tracker] Failed writing to CSV: ${e.message}`);
    }

    // 2. Append to JSON
    try {
      const existing: ApplicationRecord[] = JSON.parse(fs.readFileSync(this.jsonPath, "utf-8"));
      existing.push({
        ...record,
        appliedDate: timestamp
      });
      fs.writeFileSync(this.jsonPath, JSON.stringify(existing, null, 2), "utf-8");
    } catch (e: any) {
      console.warn(`[Tracker] Failed writing to JSON: ${e.message}`);
    }

    // 3. Sync to MongoDB if connected
    try {
      await JobModel.findOneAndUpdate(
        { jobUrl: record.jobUrl },
        {
          company: record.company,
          jobTitle: record.jobTitle,
          jobUrl: record.jobUrl,
          source: record.source,
          matchScore: record.matchScore,
          status: record.status === "Applied" ? "Applied" : "Pending Approval"
        },
        { upsert: true, returnDocument: "after" }
      );
    } catch {
      // MongoDB might not be running locally, graceful fallback
    }

    console.log(`[Tracker] Logged application for "${record.jobTitle}" at ${record.company} (${record.status}).`);
  }

  public hasAlreadyApplied(jobUrl: string): boolean {
    if (!fs.existsSync(this.jsonPath)) return false;
    try {
      const records: ApplicationRecord[] = JSON.parse(fs.readFileSync(this.jsonPath, "utf-8"));
      return records.some(r => r.jobUrl === jobUrl && r.status === "Applied");
    } catch {
      return false;
    }
  }

  public getStats() {
    if (!fs.existsSync(this.jsonPath)) return { totalLogged: 0, appliedCount: 0 };
    try {
      const records: ApplicationRecord[] = JSON.parse(fs.readFileSync(this.jsonPath, "utf-8"));
      return {
        totalLogged: records.length,
        appliedCount: records.filter(r => r.status === "Applied").length,
        pendingReviewCount: records.filter(r => r.status === "Pending Review" || r.status === "Tailored").length
      };
    } catch {
      return { totalLogged: 0, appliedCount: 0 };
    }
  }
}

export const tracker = new ApplicationTracker();
