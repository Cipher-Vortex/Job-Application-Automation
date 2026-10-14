import os
import sys
import json
import csv
import traceback
import urllib.request
import gspread
from google.oauth2.service_account import Credentials

SPREADSHEET_ID = os.getenv("GOOGLE_SHEETS_SPREADSHEET_ID", "1CjpYCVydPHoEy3zxW1DDV4eHk83qcq0VdFGxiMKbaN0")
WEBHOOK_URL = os.getenv("GOOGLE_SHEETS_WEBHOOK_URL", "https://script.google.com/macros/s/AKfycbzUDcKTGNds4k7OxELbO5OccAieRARcBRUemx736rK04DwnwIDwF3dhubcQ_xiDVak/exec")
SERVICE_ACCOUNT_JSON = os.path.join(os.path.dirname(__file__), "../integrations/job-apply-sheets-automation-6b22aa32b597.json")
CSV_EXPORT_PATH = os.path.join(os.path.dirname(__file__), "../data/google_sheets_sync_export.csv")

HEADERS = [
    "Timestamp", "ID", "Company", "Job / Project Title", 
    "Location", "Remote Type", "Employment Type", 
    "Salary / Contract Rate", "Match Score %", "Status", "Source URL"
]

def load_local_csv_rows(limit=100):
    rows = []
    if os.path.exists(CSV_EXPORT_PATH):
        try:
            with open(CSV_EXPORT_PATH, "r", encoding="utf-8") as f:
                reader = csv.reader(f)
                header = next(reader, None)
                for r in reader:
                    if r and len(r) >= 5:
                        rows.append(r)
        except Exception as e:
            print(f"Notice reading CSV export: {e}")
    return rows[:limit]

def sync_via_service_account():
    print("\n--- 1. Testing Direct Google Sheets API via Service Account ---")
    if not os.path.exists(SERVICE_ACCOUNT_JSON):
        print(f"Service Account credentials not found at {SERVICE_ACCOUNT_JSON}")
        return False

    scopes = ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive']
    creds = Credentials.from_service_account_file(SERVICE_ACCOUNT_JSON, scopes=scopes)
    client = gspread.authorize(creds)
    sa_email = creds.service_account_email
    print(f"Service Account Email: {sa_email}")

    try:
        sh = client.open_by_key(SPREADSHEET_ID)
        sheet = sh.sheet1
        print(f"Connected to Google Sheet: '{sh.title}'")

        # 1. Update Header Row
        sheet.update('A1:K1', [HEADERS])
        sheet.format('A1:K1', {
            "backgroundColor": {"red": 0.06, "green": 0.09, "blue": 0.16},
            "horizontalAlignment": "CENTER",
            "textFormat": {
                "foregroundColor": {"red": 0.22, "green": 0.74, "blue": 0.97},
                "bold": True
            }
        })
        sheet.freeze(rows=1)
        print("Updated and formatted header row A1:K1!")

        # 2. Sync real records
        rows = load_local_csv_rows(50)
        if rows:
            # Clear rows below header and re-append fresh rows
            sheet.batch_clear(["A2:K500"])
            sheet.append_rows(rows)
            print(f"Successfully synced {len(rows)} real application rows to Google Sheet!")
        else:
            sample_rows = [
                ["2026-08-02 15:20:00", "job_1", "SaaSify Technologies", "Full Stack Engineer (React & Node.js)", "Bengaluru, India", "Remote", "Full-Time", "$120,000 - $180,000 USD", "94.5%", "Applied", "https://boards.greenhouse.io/saasify/jobs/401928"],
                ["2026-08-02 15:20:05", "fl_1092", "Client Project (Freelancer.com)", "Launch React & Node.js Web Portal", "Global Remote", "Remote", "Freelance / Contract", "$500 - $1,800 USD (Fixed Project Contract)", "93.4%", "Applied", "https://www.freelancer.com/projects/react-node-portal"]
            ]
            sheet.append_rows(sample_rows)
            print(f"Appended {len(sample_rows)} sample rows.")

        return True
    except gspread.exceptions.APIError as e:
        print(f"Service Account permission status: {e}")
        if "403" in str(e):
            print("\nAction Needed for Service Account:")
            print(f"1. Open https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit")
            print(f"2. Click the 'Share' button in the top right")
            print(f"3. Paste this service account email: {sa_email}")
            print("4. Grant 'Editor' access, uncheck 'Notify', and click 'Share'.")
        return False
    except Exception as e:
        print(f"Service Account Sync Error: {e}")
        return False

def sync_via_webhook():
    print("\n--- 2. Testing Google Apps Script Webhook API ---")
    if not WEBHOOK_URL:
        print("No Webhook URL configured.")
        return False

    sample_job = {
        "spreadsheet_id": SPREADSHEET_ID,
        "timestamp": "2026-10-14 22:15:00",
        "id": "app_live_101",
        "company": "Modash",
        "title": "Senior Full-Stack Engineer (React, Node.js)",
        "location": "Global Remote",
        "remoteType": "Remote",
        "jobType": "Full-Time",
        "salaryRaw": "$110,000 - $145,000 USD",
        "matchScore": "96.4%",
        "status": "Applied",
        "url": "https://modash.recruitee.com/o/fullstack-engineer"
    }

    try:
        payload = json.dumps(sample_job).encode("utf-8")
        req = urllib.request.Request(WEBHOOK_URL, data=payload, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            body = resp.read().decode("utf-8")
            print(f"Webhook Status Code: {resp.getcode()}")
            print(f"Webhook Response Body: {body}")
            return True
    except Exception as e:
        print(f"Webhook Sync Error: {e}")
        return False

if __name__ == "__main__":
    sa_success = sync_via_service_account()
    if not sa_success:
        print("\nFalling back to Webhook sync...")
        sync_via_webhook()
