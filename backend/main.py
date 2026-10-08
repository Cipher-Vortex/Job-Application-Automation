from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
import json
import os
from config.logger import logger

from agents.discovery_agent import discovery_agent
from agents.job_parser_agent import job_parser_agent
from agents.semantic_matching_agent import semantic_matcher
from agents.resume_optimization_agent import resume_optimizer
from agents.cover_letter_agent import cover_letter_agent
from agents.salary_intelligence_agent import salary_intelligence_agent
from agents.browser_automation_agent import browser_agent
from agents.recruiter_crm_agent import recruiter_crm
from agents.interview_prep_agent import interview_prep
from agents.skill_gap_agent import skill_gap_agent
from agents.offer_comparison_agent import offer_comparator
from agents.sheets_agent import sheets_agent

app = FastAPI(title="JobPilot AI Microservice Engine", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def load_candidate_profile():
    base_dir = os.path.join(os.path.dirname(__file__), "../data/user_profile")
    def read_json(fname):
        filepath = os.path.join(base_dir, fname)
        if os.path.exists(filepath):
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
        return {}
    return {
        "profile": read_json("profile.json"),
        "experience": read_json("experience.json"),
        "education": read_json("education.json"),
        "skills": read_json("skills.json"),
        "projects": read_json("projects.json")
    }

class MatchRequest(BaseModel):
    job: Dict[str, Any]

class ApplicationRequest(BaseModel):
    url: str
    company: str
    role: str
    resume_version: Optional[str] = "Master"

@app.get("/")
def read_root():
    return {"status": "online", "service": "JobPilot AI Python Engine", "version": "1.0.0"}

@app.post("/api/ai/match")
def evaluate_match(req: MatchRequest):
    candidate = load_candidate_profile()
    parsed_job = job_parser_agent.parse_job(req.job)
    match_result = semantic_matcher.evaluate(candidate, parsed_job)
    return {"job": parsed_job, "match": match_result}

@app.post("/api/ai/resume/optimize")
def optimize_resume(req: MatchRequest):
    candidate = load_candidate_profile()
    parsed_job = job_parser_agent.parse_job(req.job)
    opt = resume_optimizer.optimize_resume(candidate, parsed_job.get("title", "Full Stack Engineer"), parsed_job)
    return opt

@app.post("/api/ai/cover-letter")
def generate_cover_letter(req: MatchRequest):
    candidate = load_candidate_profile()
    parsed_job = job_parser_agent.parse_job(req.job)
    letter = cover_letter_agent.generate_cover_letter(candidate, parsed_job)
    return {"cover_letter": letter}

@app.post("/api/ai/salary/analyze")
def analyze_salary(req: MatchRequest):
    parsed_job = job_parser_agent.parse_job(req.job)
    analysis = salary_intelligence_agent.analyze_compensation(parsed_job)
    return analysis

@app.get("/api/ai/jobs/live")
async def get_live_jobs():
    """Discover real live online jobs across Greenhouse, Lever, RemoteOK, and Arbeitnow."""
    try:
        candidate_profile_data = load_candidate_profile()
        raw_jobs = await discovery_agent.discover_jobs()
        evaluated_jobs = []
        for raw_j in raw_jobs:
            pj = job_parser_agent.parse_job(raw_j)
            eval_res = semantic_matcher.evaluate(candidate_profile_data, pj)
            evaluated_jobs.append({
                "id": pj["id"],
                "title": pj["title"],
                "company": pj["company"],
                "location": pj["location"],
                "remoteType": pj["remote_type"],
                "url": pj["url"],
                "source": pj["source"],
                "salaryRaw": pj["salary_raw"],
                "techStack": pj["tech_stack"],
                "matchScore": eval_res["overall_match_score"],
                "description": pj["description"]
            })
        return evaluated_jobs
    except Exception as e:
        logger.error(f"Error serving live jobs: {e}")
        return []

@app.get("/api/ai/portals/login-urls")
def get_portal_login_urls():
    """Return Playwright direct login URLs for LinkedIn, Indeed, Internshala, and Unstop."""
    return {
        "login_urls": browser_agent.PORTAL_LOGIN_URLS,
        "persistent_session_dir": browser_agent.user_data_dir,
        "cookies_file": browser_agent.cookies_file
    }

@app.post("/api/ai/apply")
async def execute_application(req: ApplicationRequest):
    candidate = load_candidate_profile()
    result = await browser_agent.submit_application(req.dict(), candidate)
    
    # Log application to Google Sheets / CSV
    sheets_agent.log_application({
        "id": f"app_{os.urandom(4).hex()}",
        "company": req.company,
        "role": req.role,
        "url": req.url,
        "source": "Playwright",
        "ats_platform": "Web Form",
        "location": "Bengaluru",
        "remote_type": "Hybrid",
        "match_score": 92.5,
        "resume_version": req.resume_version,
        "cover_letter": True,
        "status": result.get("status"),
        "salary_raw": "₹12,00,000 - ₹18,00,000",
        "market_min": 750000,
        "market_median": 1200000,
        "market_max": 1800000,
        "expected_salary": 800000,
        "compensation_score": 90.0,
        "error_log": result.get("reason", "")
    })
    return result

@app.get("/api/ai/interview-prep")
def get_interview_prep(company: str = "SaaSify Technologies", role: str = "Full Stack Engineer"):
    return interview_prep.generate_prep_kit(company, role, ["React", "Node.js", "MongoDB", "Grok API"])

@app.get("/api/ai/skill-gap")
def get_skill_gap():
    candidate = load_candidate_profile()
    skills_list = candidate["skills"].get("frontend", []) + candidate["skills"].get("backend", [])
    mock_jobs = [
        {"tech_stack": ["React", "Node.js", "Docker", "Kubernetes", "AWS"]},
        {"tech_stack": ["React", "Node.js", "TypeScript", "Docker", "GraphQL"]},
        {"tech_stack": ["Next.js", "Tailwind", "Docker", "PostgreSQL"]}
    ]
    return skill_gap_agent.analyze_skill_gaps(skills_list, mock_jobs)
