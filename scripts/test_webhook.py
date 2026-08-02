import urllib.request
import urllib.parse
import json

url = "https://script.google.com/macros/s/AKfycbzUDcKTGNds4k7OxELbO5OccAieRARcBRUemx736rK04DwnwIDwF3dhubcQ_xiDVak/exec"

data = {
    "spreadsheet_id": "1CjpYCVydPHoEy3zxW1DDV4eHk83qcq0VdFGxiMKbaN0",
    "timestamp": "2026-08-02 15:23:00",
    "id": "job_999",
    "company": "SaaSify Technologies",
    "title": "Full Stack Engineer (React & Node.js)",
    "location": "Bengaluru, India",
    "remoteType": "Remote",
    "jobType": "Full-Time",
    "salaryRaw": "$120,000 - $180,000 USD",
    "matchScore": "94.5%",
    "status": "Applied",
    "url": "https://boards.greenhouse.io/saasify/jobs/401928"
}

encoded_data = json.dumps(data).encode("utf-8")
req = urllib.request.Request(url, data=encoded_data, headers={"Content-Type": "application/json"})

print(f"Posting to Webhook URL: {url}")
try:
    with urllib.request.urlopen(req, timeout=15) as response:
        res_body = response.read().decode("utf-8")
        print("Response Code:", response.getcode())
        print("Response Body:", res_body)
except Exception as e:
        print("Webhook Request Exception:", e)
