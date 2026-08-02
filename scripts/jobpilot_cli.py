import sys
import os
import argparse
import asyncio
import json

# Ensure workspace is on sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agents.discovery_agent import discovery_agent
from agents.job_parser_agent import job_parser_agent
from agents.semantic_matching_agent import semantic_matcher
from agents.resume_optimization_agent import resume_optimizer
from agents.cover_letter_agent import cover_letter_agent
from agents.salary_intelligence_agent import salary_intelligence_agent
from agents.browser_automation_agent import browser_agent
from agents.sheets_agent import sheets_agent

def load_candidate():
    base_dir = os.path.join(os.path.dirname(__file__), "../data/user_profile")
    def r(f):
        with open(os.path.join(base_dir, f), "r", encoding="utf-8") as fp:
            return json.load(fp)
    return {
        "profile": r("profile.json"),
        "experience": r("experience.json"),
        "education": r("education.json"),
        "skills": r("skills.json"),
        "projects": r("projects.json")
    }

async def run_discovery():
    print("🚀 [JobPilot AI CLI] Scanning Job Sources (Greenhouse, Lever, Ashby, Workday)...")
    jobs = await discovery_agent.discover_jobs()
    print(f"Found {len(jobs)} jobs:")
    for j in jobs:
        print(f" - {j['title']} at {j['company']} ({j['source']}) -> {j['url']}")

async def run_evaluate():
    print("📊 [JobPilot AI CLI] Evaluating Candidate Profile against Discovered Jobs...")
    candidate = load_candidate()
    jobs = await discovery_agent.discover_jobs()
    for raw_j in jobs:
        pj = job_parser_agent.parse_job(raw_j)
        m = semantic_matcher.evaluate(candidate, pj)
        sal = salary_intelligence_agent.analyze_compensation(pj)
        print(f"\n--- {pj['title']} @ {pj['company']} ---")
        print(f"Match Score: {m['overall_match_score']}% | Skill Match: {m['skill_match']}%")
        print(f"Salary Classification: {sal['classification']} ({sal['confidence_score']})")
        print(f"Rationale: {m['rationale']}")

async def run_apply_all():
    print("⚡ [JobPilot AI CLI] Running Autonomous Application Engine...")
    candidate = load_candidate()
    jobs = await discovery_agent.discover_jobs()
    for raw_j in jobs:
        pj = job_parser_agent.parse_job(raw_j)
        res = await browser_agent.submit_application(pj, candidate)
        print(f"Applied to {pj['title']} @ {pj['company']}: Status={res['status']}")

def main():
    parser = argparse.ArgumentParser(description="JobPilot AI CLI Management Tool")
    parser.add_argument("command", choices=["discover", "evaluate", "apply", "all"], help="Command to execute")
    args = parser.parse_args()

    if args.command == "discover":
        asyncio.run(run_discovery())
    elif args.command == "evaluate":
        asyncio.run(run_evaluate())
    elif args.command == "apply":
        asyncio.run(run_apply_all())
    elif args.command == "all":
        asyncio.run(run_discovery())
        asyncio.run(run_evaluate())
        asyncio.run(run_apply_all())

if __name__ == "__main__":
    main()
