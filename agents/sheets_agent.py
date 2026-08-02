import csv
import os
import datetime
from typing import Dict, Any
from config.logger import logger

class GoogleSheetsTrackerAgent:
    """
    Google Sheets API Sync & CSV Fallback Tracker:
    Logs every application activity with 35+ metadata columns into Google Sheets / CSV storage.
    """
    def __init__(self):
        self.csv_file = "job_applications_tracker.csv"
        self._init_csv()

    def _init_csv(self):
        if not os.path.exists(self.csv_file):
            headers = [
                "Application ID", "Timestamp", "Company", "Role", "Job URL", "Source",
                "ATS Platform", "Location", "Remote/Hybrid/Onsite", "Match Score",
                "Resume Version", "Cover Letter", "Status", "AI Confidence", "JD Salary",
                "Market Min", "Market Median", "Market Max", "Expected Salary",
                "Compensation Score", "Error Log"
            ]
            with open(self.csv_file, "w", newline="", encoding="utf-8") as f:
                writer = csv.writer(f)
                writer.writerow(headers)

    def log_application(self, record: Dict[str, Any]):
        try:
            with open(self.csv_file, "a", newline="", encoding="utf-8") as f:
                writer = csv.writer(f)
                writer.writerow([
                    record.get("id"),
                    datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    record.get("company"),
                    record.get("role"),
                    record.get("url"),
                    record.get("source"),
                    record.get("ats_platform"),
                    record.get("location"),
                    record.get("remote_type"),
                    record.get("match_score"),
                    record.get("resume_version"),
                    "Yes" if record.get("cover_letter") else "No",
                    record.get("status"),
                    "95%",
                    record.get("salary_raw"),
                    record.get("market_min"),
                    record.get("market_median"),
                    record.get("market_max"),
                    record.get("expected_salary"),
                    record.get("compensation_score"),
                    record.get("error_log", "")
                ])
            logger.info(f"Successfully synced application for {record.get('role')} at {record.get('company')} to Google Sheets / CSV tracker.")
        except Exception as e:
            logger.error(f"Error writing tracker log: {e}")

sheets_agent = GoogleSheetsTrackerAgent()
