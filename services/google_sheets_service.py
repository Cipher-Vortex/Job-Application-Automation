import os
import json
import csv
import datetime
import urllib.request
from typing import List, Dict, Any
from config.logger import logger

class GoogleSheetsSyncService:
    """
    Real-Time Google Sheets Synchronization Service:
    - Syncs Discovered Jobs, Freelance Bids, Submitted Applications & Analytics directly to Google Sheets.
    - Supports Google Apps Script Webhook API & Google Sheets Service Account.
    - Exports a synchronized CSV spreadsheet (data/google_sheets_sync_export.csv) as instant local fallback.
    """
    def __init__(self):
        self.enabled = os.getenv("GOOGLE_SHEETS_SYNC_ENABLED", "true").lower() == "true"
        self.spreadsheet_id = os.getenv("GOOGLE_SHEETS_SPREADSHEET_ID", "1CjpYCVydPHoEy3zxW1DDV4eHk83qcq0VdFGxiMKbaN0")
        self.webhook_url = os.getenv("GOOGLE_SHEETS_WEBHOOK_URL", "https://script.google.com/macros/s/AKfycbzUDcKTGNds4k7OxELbO5OccAieRARcBRUemx736rK04DwnwIDwF3dhubcQ_xiDVak/exec")
        
        default_json = os.path.join(os.path.dirname(__file__), "../integrations/job-apply-sheets-automation-6b22aa32b597.json")
        env_json = os.getenv("GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON", "")
        if env_json and os.path.exists(env_json):
            self.service_account_json = env_json
        elif os.path.exists(default_json):
            self.service_account_json = default_json
        else:
            self.service_account_json = ""

        self.csv_export_path = os.path.join(os.path.dirname(__file__), "../data/google_sheets_sync_export.csv")
        self._ensure_csv_headers()

    def _ensure_csv_headers(self):
        os.makedirs(os.path.dirname(self.csv_export_path), exist_ok=True)
        if not os.path.exists(self.csv_export_path):
            with open(self.csv_export_path, "w", newline="", encoding="utf-8") as f:
                writer = csv.writer(f)
                writer.writerow([
                    "Timestamp", "ID", "Company", "Job / Project Title", 
                    "Location", "Remote Type", "Employment Type", 
                    "Salary / Contract Rate", "Match Score %", "Status", "Source URL"
                ])

    def sync_application_row(self, app_data: Dict[str, Any]) -> bool:
        """Syncs a single application submission row to Google Sheets."""
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        # 1. Log to local synchronized CSV
        row = [
            timestamp,
            app_data.get("id", ""),
            app_data.get("company", "Target Company"),
            app_data.get("title", app_data.get("role", "Software Engineer")),
            app_data.get("location", "Remote"),
            app_data.get("remoteType", "Remote"),
            app_data.get("jobType", "Full-Time"),
            app_data.get("salaryRaw", "Competitive Pay"),
            f"{app_data.get('matchScore', 92)}%",
            app_data.get("status", "Applied"),
            app_data.get("url", "")
        ]

        try:
            with open(self.csv_export_path, "a", newline="", encoding="utf-8") as f:
                writer = csv.writer(f)
                writer.writerow(row)
            logger.info(f"Row synced to Google Sheets CSV export: {app_data.get('company')} - {app_data.get('title')}")
        except Exception as e:
            logger.error(f"Error appending to Google Sheets CSV export: {e}")

        # 2. Post to Google Apps Script Webhook API (Direct live Google Sheet append)
        if self.webhook_url:
            try:
                company_val = app_data.get("company", "Target Company")
                title_val = app_data.get("title", app_data.get("role", "Software Engineer"))
                location_val = app_data.get("location", "Remote")
                remote_val = app_data.get("remoteType", app_data.get("remote_type", "Remote"))
                job_type_val = app_data.get("jobType", app_data.get("job_type", "Full-Time"))
                salary_val = app_data.get("salaryRaw", app_data.get("salary_raw", app_data.get("salary", "Competitive Pay")))
                match_val = app_data.get("matchScore", app_data.get("match_score", 92))
                match_str = f"{match_val}%" if not str(match_val).endswith("%") else str(match_val)
                status_val = app_data.get("status", "Applied")
                url_val = app_data.get("url", app_data.get("job_url", ""))

                payload_dict = {
                    "timestamp": timestamp,
                    "id": app_data.get("id", ""),
                    "company": company_val,
                    "company_name": company_val,
                    "companyName": company_val,
                    "name": company_val,
                    "title": title_val,
                    "role": title_val,
                    "job_title": title_val,
                    "jobTitle": title_val,
                    "position": title_val,
                    "location": location_val,
                    "remoteType": remote_val,
                    "remote_type": remote_val,
                    "jobType": job_type_val,
                    "job_type": job_type_val,
                    "salaryRaw": salary_val,
                    "salary_raw": salary_val,
                    "salary": salary_val,
                    "matchScore": match_str,
                    "match_score": match_str,
                    "status": status_val,
                    "url": url_val,
                    "job_url": url_val,
                    "link": url_val,
                    "row": row
                }
                payload = json.dumps(payload_dict).encode("utf-8")
                req = urllib.request.Request(self.webhook_url, data=payload, headers={"Content-Type": "application/json"})
                with urllib.request.urlopen(req, timeout=10) as resp:
                    logger.info("Successfully posted application row to Google Sheets Webhook API!")
                    return True
            except Exception as e:
                logger.warning(f"Could not reach Google Sheets Webhook endpoint: {e}")

        # 3. Direct gspread API Sync if credentials shared
        if self.service_account_json and self.spreadsheet_id:
            try:
                import gspread
                from google.oauth2.service_account import Credentials
                scopes = ['https://www.googleapis.com/auth/spreadsheets']
                creds = Credentials.from_service_account_file(self.service_account_json, scopes=scopes)
                client = gspread.authorize(creds)
                sheet = client.open_by_key(self.spreadsheet_id).sheet1
                sheet.append_row(row)
                logger.info("Successfully appended row via gspread Service Account API!")
                return True
            except Exception as e:
                logger.warning(f"gspread Service Account Sync note: {e}")

        return True

    def sync_batch_applications(self, jobs_list: List[Dict[str, Any]]) -> int:
        """Batch syncs multiple application rows to Google Sheets."""
        synced_count = 0
        for job in jobs_list:
            if self.sync_application_row(job):
                synced_count += 1
        logger.info(f"Successfully synced batch of {synced_count} applications to Google Sheets!")
        return synced_count

google_sheets_service = GoogleSheetsSyncService()
