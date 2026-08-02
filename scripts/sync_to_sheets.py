import os
import json
import traceback
import gspread
from google.oauth2.service_account import Credentials

def sync_all_data():
    sheet_id = "1CjpYCVydPHoEy3zxW1DDV4eHk83qcq0VdFGxiMKbaN0"
    json_path = os.path.join(os.path.dirname(__file__), "../integrations/job-apply-sheets-automation-6b22aa32b597.json")
    
    print(f"DEBUG: Credentials Path: {os.path.abspath(json_path)}")
    print(f"DEBUG: File Exists: {os.path.exists(json_path)}")
    print(f"DEBUG: Target Sheet ID: {sheet_id}")

    if not os.path.exists(json_path):
        print(f"Error: Credentials file not found at {json_path}")
        return

    scopes = ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive']
    creds = Credentials.from_service_account_file(json_path, scopes=scopes)
    client = gspread.authorize(creds)
    
    try:
        sheet = client.open_by_key(sheet_id).sheet1
        headers = [
            'Timestamp', 'ID', 'Company', 'Job / Project Title', 
            'Location', 'Remote Type', 'Employment Type', 
            'Salary / Contract Rate', 'Match Score %', 'Status', 'Source URL'
        ]
        sheet.update('A1:K1', [headers])
        print("✅ Successfully updated headers in Google Sheet!")

        sample_rows = [
            ["2026-08-02 15:20:00", "job_1", "SaaSify Technologies", "Full Stack Engineer (React & Node.js)", "Bengaluru, India", "Remote", "Full-Time", "$120,000 - $180,000 USD", "94.5%", "Applied", "https://boards.greenhouse.io/saasify/jobs/401928"],
            ["2026-08-02 15:20:05", "fl_1092", "Client Project (Freelancer.com)", "Launch React & Node.js Web Portal", "Global Remote", "Remote", "Freelance / Contract", "$500 - $1,800 USD (Fixed Project Contract)", "93.4%", "Applied", "https://www.freelancer.com/projects/react-node-portal"],
            ["2026-08-02 15:20:10", "job_2", "Apex Global Systems", "Freelance Full Stack Web Developer", "Remote", "Remote", "Freelance / Contract", "$55 - $95 / hr (Freelance Contract)", "92.8%", "Applied", "https://remoteok.com/remote-jobs/9812"]
        ]
        
        sheet.append_rows(sample_rows)
        print(f"✅ Successfully synced {len(sample_rows)} application rows directly to Google Sheet!")
    except Exception as e:
        print("\n================ DETAILED ERROR LOG ================")
        print(f"Exception Type: {type(e).__name__}")
        print(f"Exception Details: {e}")
        print("\nFull Traceback:")
        print(traceback.format_exc())
        print("====================================================\n")

if __name__ == "__main__":
    sync_all_data()
