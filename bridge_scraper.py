import asyncio
import requests
import json
from agents.discovery_agent import discovery_agent

async def main():
    print("Fetching REAL LIVE JOBS using discovery_agent...")
    jobs = await discovery_agent.discover_jobs()
    
    print(f"Found {len(jobs)} jobs. Bridging to new TS backend...")
    
    success_count = 0
    for job in jobs:
        # Standardize format for TS API
        payload = {
            "title": job.get("title", ""),
            "company": job.get("company", ""),
            "url": job.get("url", ""),
            "location": job.get("location", "Remote"),
            "source": job.get("source", "") + " " + job.get("ats_platform", ""),
            "description": job.get("description", "No description provided format via ATS"),
            "salary": job.get("salary", "Unknown")
        }
        
        try:
            res = requests.post("http://localhost:3000/api/jobs/seed", json=payload)
            if res.status_code == 200:
                success_count += 1
        except Exception as e:
            print(f"Failed to submit {job.get('company')}: {e}")
            
    print(f"Successfully bridged {success_count} jobs to the Node.js Queue System.")

if __name__ == "__main__":
    asyncio.run(main())
