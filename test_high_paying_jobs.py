import asyncio
import json
from agents.discovery_agent import discovery_agent

async def main():
    print("=" * 60)
    print("DISCOVERING HIGH-PAYING & UNDERRATED TECH COMPANY JOBS")
    print("=" * 60)
    
    jobs = await discovery_agent.discover_jobs()
    
    target_companies = [
        "Pal", "Palai", "Pal-Ai", "Cloudflare", "Vercel", "Canonical",
        "Supabase", "Sourcegraph", "Datadog", "Gitlab", "Elastic",
        "Figma", "Postman", "Duckduckgo", "Automattic", "Stripe"
    ]
    
    high_paying_jobs = [
        j for j in jobs
        if any(tc.lower() in j.get("company", "").lower() for tc in target_companies)
    ]
    
    print(f"\n[+] Total Discovered Jobs across all streams: {len(jobs)}")
    print(f"[+] High-Paying / Underrated Company Jobs Found: {len(high_paying_jobs)}")
    print("-" * 60)
    
    for idx, job in enumerate(high_paying_jobs, 1):
        print(f"{idx}. {job.get('title')} @ {job.get('company')}")
        print(f"   Location: {job.get('location')} | Source: {job.get('source')} / {job.get('ats_platform')}")
        print(f"   URL: {job.get('url')}\n")

if __name__ == "__main__":
    asyncio.run(main())
