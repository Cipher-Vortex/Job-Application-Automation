from fastapi import FastAPI, HTTPException, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
import json
import os
import asyncio
import time
from collections import deque
from datetime import datetime
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
from agents.rag_database import rag_db

app = FastAPI(title="JobPilot AI Microservice Engine", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global Auto-Apply state
AUTO_APPLY_STATE = {
    "enabled": False,
    "last_run": None,
    "total_auto_applied": 0,
    "is_running": False,
    "message": "Auto-apply is disabled by default. Use Telegram to find jobs and prepare drafts for manual review."
}

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
    source: Optional[str] = "Autonomous Agent"
    match_score: Optional[float] = 92.5
    salary_raw: Optional[str] = "Competitive Market Pay"

class GroomRequest(BaseModel):
    job: Dict[str, Any]
    role: Optional[str] = None

class RAGQueryRequest(BaseModel):
    query: str
    top_k: Optional[int] = 4

class ResolveReviewRequest(BaseModel):
    id: str
    decision: Optional[str] = "Approved"
    user_notes: Optional[str] = ""

class AdditionalInfoRequest(BaseModel):
    id: str
    additional_info: Dict[str, Any]

@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "JobPilot AI Python Engine + RAG Database",
        "version": "2.0.0",
        "rag_stats": rag_db.get_rag_stats()
    }

# ================= RAG & GROOMING ENDPOINTS =================

@app.get("/api/ai/rag/status")
def get_rag_status():
    """Returns RAG memory metrics, indexed chunks, and application history."""
    return rag_db.get_rag_stats()

@app.post("/api/ai/rag/query")
def query_rag_memory(req: RAGQueryRequest):
    """Semantic context query against master resume & past application experience."""
    chunks = rag_db.query_context(req.query, top_k=req.top_k)
    return {"query": req.query, "retrieved_chunks": chunks}

@app.post("/api/ai/resume/groom")
def groom_resume_and_cv(req: GroomRequest):
    """
    Applies the JD keyword injection & company intelligence trick:
    - Extracts company current projects & services
    - Extracts high-priority JD keywords
    - Returns tailored resume markdown, executive summary, and cover letter CV
    """
    candidate = load_candidate_profile()
    parsed_job = job_parser_agent.parse_job(req.job)
    target_role = req.role or parsed_job.get("title", "Full Stack Engineer")
    
    groomed = resume_optimizer.optimize_resume(candidate, target_role, parsed_job)
    return groomed

@app.post("/api/ai/match")
def evaluate_match(req: MatchRequest):
    candidate = load_candidate_profile()
    parsed_job = job_parser_agent.parse_job(req.job)
    match_result = semantic_matcher.evaluate(candidate, parsed_job)
    return {"job": parsed_job, "match": match_result}

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

# ================= 100% REMOTE JOBS DISCOVERY =================

@app.get("/api/ai/jobs/live")
async def get_live_jobs(remote_only: bool = True, force_refresh: bool = False):
    """
    Discover real live 100% remote positions across:
    - Greenhouse (Stripe, GitLab, Cloudflare, Vercel, Supabase)
    - Lever (Figma, Postman, Metabase)
    - Ashby (Linear, Modal Labs, Sentry, Replit, Zapier, Buffer)
    - RemoteOK & Arbeitnow Remote streams
    - Freelancer.com live client projects
    - LinkedIn, Indeed, Internshala, Unstop
    """
    try:
        cache_path = os.path.join(os.path.dirname(__file__), "../data/live_scraped_jobs.json")
        if not force_refresh and os.path.exists(cache_path):
            try:
                with open(cache_path, "r", encoding="utf-8") as f:
                    cdata = json.load(f)
                    if isinstance(cdata, dict) and "jobs" in cdata and len(cdata["jobs"]) > 0:
                        # Check cache freshness (refresh if older than 15 minutes)
                        last_scraped_str = cdata.get("lastScraped")
                        if last_scraped_str:
                            last_scraped_dt = datetime.fromisoformat(last_scraped_str.replace("Z", "+00:00"))
                            now_dt = datetime.now(last_scraped_dt.tzinfo)
                            if (now_dt - last_scraped_dt).total_seconds() < 900:
                                return cdata["jobs"]
            except Exception as ce:
                logger.warning(f"Cache read note: {ce}")

        logger.info("[FastAPI Live Scan] Initiating autonomous live multi-portal discovery...")
        candidate_profile_data = load_candidate_profile()
        raw_jobs = await discovery_agent.discover_jobs()
        evaluated_jobs = []
        
        for raw_j in raw_jobs:
            pj = job_parser_agent.parse_job(raw_j)
            eval_res = semantic_matcher.evaluate(candidate_profile_data, pj)
            
            # Fetch company intelligence for preview
            intel = rag_db.get_company_intel(pj["company"], pj["description"])
            
            evaluated_jobs.append({
                "id": pj["id"],
                "title": pj["title"],
                "roleCategory": pj.get("role_category", "Full Stack"),
                "company": pj["company"],
                "department": pj.get("department", f"{pj.get('role_category', 'Engineering')} Team"),
                "location": pj["location"],
                "remoteType": pj["remote_type"],
                "is100Remote": True,
                "url": pj["url"],
                "source": pj["source"],
                "atsPlatform": pj.get("ats_platform", pj["source"]),
                "jobType": pj.get("job_type", "Full-Time"),
                "salaryRaw": pj["salary_raw"],
                "salaryMin": pj.get("salary_min", 1800000),
                "techStack": pj["tech_stack"],
                "matchScore": eval_res["overall_match_score"],
                "description": pj["description"],
                "companyDomain": intel.get("domain", f"{pj['company']} Cloud Platform"),
                "companyProjects": intel.get("current_projects", f"{pj['title']} Engineering"),
                "companyServices": intel.get("services", "Modern Distributed Software")
            })
            
        if evaluated_jobs:
            try:
                os.makedirs(os.path.dirname(cache_path), exist_ok=True)
                with open(cache_path, "w", encoding="utf-8") as f:
                    json.dump({
                        "lastScraped": datetime.now().isoformat(),
                        "total": len(evaluated_jobs),
                        "jobs": evaluated_jobs
                    }, f, indent=2)
            except Exception as swe:
                logger.warning(f"Failed to write live scraped jobs cache: {swe}")

        return evaluated_jobs
    except Exception as e:
        logger.error(f"Error serving live jobs: {e}")
        return []

@app.post("/api/ai/jobs/scan")
async def scan_live_jobs_now(background_tasks: BackgroundTasks):
    """Explicitly triggers real-time discovery and updates live job radar."""
    return await get_live_jobs(remote_only=True, force_refresh=True)


# Telegram integration diagnostics. Keep a bounded in-memory log; never log secrets.
TELEGRAM_LOGS = deque(maxlen=300)

def telegram_log(level: str, message: str, **fields):
    entry = {"timestamp": datetime.now().isoformat(), "level": level.upper(),
             "message": message, "details": fields}
    TELEGRAM_LOGS.append(entry)
    getattr(logger, level.lower(), logger.info)(f"[Telegram API] {message} | {fields}")

def require_telegram_api_key(request: Request):
    expected = os.getenv("JOB_ENGINE_API_KEY", "").strip()
    if expected:
        supplied = request.headers.get("Authorization", "")
        if supplied != f"Bearer {expected}":
            raise HTTPException(status_code=401, detail="Unauthorized")

def job_accepts_india(job: Dict[str, Any]) -> bool:
    countries = job.get("eligible_countries") or job.get("eligibleCountries") or []
    if isinstance(countries, str):
        countries = [countries]
    locations = job.get("locations") or []
    if isinstance(locations, str):
        locations = [locations]
    explicit = " ".join(str(x) for x in countries + locations)
    explicit += " " + str(job.get("location", ""))
    normalized = explicit.lower()
    return any(term in normalized for term in ("india", "worldwide", "anywhere", "global"))

@app.get("/api/telegram/logs")
def get_telegram_logs(limit: int = 100, request: Request = None):
    if request is not None:
        require_telegram_api_key(request)
    limit = max(1, min(limit, 300))
    return {"logs": list(TELEGRAM_LOGS)[-limit:], "count": min(len(TELEGRAM_LOGS), limit)}

@app.post("/api/telegram/search")
async def telegram_search(payload: Dict[str, Any], request: Request):
    require_telegram_api_key(request)
    started = time.monotonic()
    try:
        filters = payload.get("filters") or {}
        jobs = await get_live_jobs(remote_only=True, force_refresh=bool(filters.get("force_refresh", False)))
        selected = []
        seen = set()
        for job in jobs:
            url = str(job.get("url", "")).strip()
            if not url or url in seen or not job.get("is100Remote", False):
                continue
            if filters.get("accepts_india_based_applicants", True) and not job_accepts_india(job):
                continue
            seen.add(url)
            selected.append(job)
            if len(selected) >= min(int(filters.get("max_results", 20)), 50):
                break
        telegram_log("info", "Job search completed", returned=len(selected),
                     discovered=len(jobs), elapsed_seconds=round(time.monotonic()-started, 2))
        return {"jobs": selected, "count": len(selected), "source": "live_job_discovery"}
    except Exception as exc:
        telegram_log("exception", "Job search failed", error_type=type(exc).__name__)
        raise HTTPException(status_code=502, detail=f"Job search failed ({type(exc).__name__})")

@app.post("/api/telegram/drafts")
def telegram_drafts(payload: Dict[str, Any], request: Request):
    require_telegram_api_key(request)
    candidate = payload.get("candidate_profile") or load_candidate_profile()
    max_drafts = max(1, min(int(payload.get("max_drafts", 5)), 5))
    try:
        # Draft generation is intentionally limited to explicit, publicly verified
        # recruiter/contact email fields. Never guess email addresses.
        cache_path = os.path.join(os.path.dirname(__file__), "../data/live_scraped_jobs.json")
        with open(cache_path, "r", encoding="utf-8") as handle:
            cache = json.load(handle)
        jobs = cache.get("jobs", []) if isinstance(cache, dict) else []
        drafts, skipped = [], []
        for job in jobs:
            if len(drafts) >= max_drafts:
                break
            if not job.get("is100Remote") or not job_accepts_india(job):
                continue
            email = str(job.get("public_contact_email") or job.get("recruiter_email") or "").strip()
            if not email or not job.get("contact_email_publicly_verified", False):
                skipped.append({"job": job.get("id"), "reason": "No publicly verified contact email"})
                continue
            parsed = job_parser_agent.parse_job(job)
            role = parsed.get("title") or job.get("title") or "Full Stack Engineer"
            tailored = resume_optimizer.optimize_resume(candidate, role, parsed)
            letter = cover_letter_agent.generate_cover_letter(candidate, parsed)
            body = str(letter or "").strip()
            if not body:
                skipped.append({"job": job.get("id"), "reason": "Cover-letter generator returned empty content"})
                continue
            drafts.append({
                "to": email,
                "subject": f"Application interest: {role} at {job.get('company', 'your team')}",
                "body": body[:5000],
                "job": job,
                "tailored_resume_markdown": tailored.get("tailored_resume_markdown", ""),
                "tailored_cv": tailored.get("tailored_cv", "")
            })
        telegram_log("info", "Draft generation completed", drafts=len(drafts), skipped=len(skipped))
        return {"drafts": drafts, "count": len(drafts), "skipped": skipped,
                "note": "Drafts only; no applications or emails were submitted."}
    except FileNotFoundError:
        telegram_log("warning", "Draft generation skipped; live jobs cache does not exist")
        return {"drafts": [], "count": 0, "skipped": [], "note": "Run job search first."}
    except Exception as exc:
        telegram_log("exception", "Draft generation failed", error_type=type(exc).__name__)
        raise HTTPException(status_code=502, detail=f"Draft generation failed ({type(exc).__name__})")

@app.get("/api/telegram/report")
def telegram_report(request: Request):
    require_telegram_api_key(request)
    return {"engine": "online", "auto_apply_enabled": AUTO_APPLY_STATE["enabled"],
            "applications": rag_db.get_applications(), "auto_apply": AUTO_APPLY_STATE}

@app.get("/api/telegram/sent")
def telegram_sent(request: Request):
    require_telegram_api_key(request)
    return {"sent": [], "note": "Email sending is managed by Gmail in the Telegram controller; this engine does not send email."}

@app.get("/api/telegram/stats")
def telegram_stats(request: Request):
    require_telegram_api_key(request)
    apps = rag_db.get_applications()
    return {"applications": len(apps), "auto_applied": AUTO_APPLY_STATE["total_auto_applied"],
            "auto_apply_enabled": AUTO_APPLY_STATE["enabled"], "recent_log_entries": len(TELEGRAM_LOGS)}

@app.post("/api/telegram/control/pause")
def telegram_pause(request: Request):
    require_telegram_api_key(request)
    AUTO_APPLY_STATE["enabled"] = False
    AUTO_APPLY_STATE["message"] = "Paused by Telegram controller."
    telegram_log("warning", "Auto-apply paused through Telegram")
    return {"ok": True, "paused": True, "auto_apply": AUTO_APPLY_STATE}

@app.post("/api/telegram/control/resume")
def telegram_resume(request: Request):
    require_telegram_api_key(request)
    # Resume enables the internal auto-apply scheduler. Telegram's outreach
    # search/draft actions remain approval-based; default is safely disabled.
    AUTO_APPLY_STATE["enabled"] = False
    AUTO_APPLY_STATE["message"] = "Outreach resumed; automatic applications remain disabled."
    telegram_log("info", "Outreach resumed; auto-apply remains disabled")
    return {"ok": True, "paused": False, "auto_apply_enabled": False,
            "message": AUTO_APPLY_STATE["message"]}

@app.on_event("startup")
async def engine_startup_diagnostics():
    logger.info("[Startup] JobPilot engine initializing; waiting 10 seconds before dependency warm-up.")
    await asyncio.sleep(10)
    logger.info("[Startup] Environment loaded: JOB_ENGINE_API_KEY configured=%s",
                bool(os.getenv("JOB_ENGINE_API_KEY", "").strip()))
    logger.info("[Startup] Job discovery agent ready; auto-apply default=%s", AUTO_APPLY_STATE["enabled"])


# ================= APPLICATION PIPELINE & RAG MEMORY =================

BLACKLISTED_EMPLOYERS = [
    "onemodo", "onemodo technologies", "onemodo technologies services", 
    "onemodo technologies services pvt ltd", "onemodo technologies services private limited"
]

def is_blacklisted_employer(company_name: str) -> bool:
    if not company_name:
        return False
    c = company_name.lower().strip()
    return any(b in c for b in BLACKLISTED_EMPLOYERS)

@app.post("/api/ai/apply")
async def execute_application(req: ApplicationRequest):
    """
    Executes real application submission:
    1. Grooms candidate resume and cover letter with JD keywords & company projects trick
    2. Submits via Playwright or safe API fallback
    3. Persists to RAG Database memory and Google Sheets CSV
    """
    if is_blacklisted_employer(req.company):
        logger.warning(f"BLOCKED application attempt to excluded employer: {req.company}")
        raise HTTPException(
            status_code=400,
            detail="Safeguard Active: Cannot apply to Onemodo Technologies Services Pvt Ltd (Current Employer Exclusion Policy)."
        )

    candidate = load_candidate_profile()
    
    # 1. Groom resume specifically for this company & JD
    groomed = resume_optimizer.optimize_resume(
        candidate, 
        req.role, 
        {"company": req.company, "title": req.role, "url": req.url, "source": req.source}
    )
    
    # 2. Browser submission execution
    app_dict = req.dict()
    app_dict["tailored_resume_markdown"] = groomed["tailored_resume_markdown"]
    app_dict["tailored_cv"] = groomed["tailored_cv"]
    result = await browser_agent.submit_application(app_dict, candidate)
    
    app_status = result.get("status", "Applied")
    if result.get("human_review_needed") or "CAPTCHA" in result.get("reason", ""):
        app_status = "Review_Required"
        
    app_id = f"app_{os.urandom(4).hex()}"
    app_record = {
        "id": app_id,
        "company": req.company,
        "role": req.role,
        "url": req.url,
        "source": req.source or "Autonomous Agent",
        "ats_platform": "Web Form",
        "location": "Global Remote",
        "remote_type": "Remote",
        "match_score": req.match_score or groomed["ats_score"],
        "resume_version": "Tailored (Keywords + Company Projects)",
        "cover_letter": True,
        "status": app_status,
        "salary_raw": req.salary_raw or "Competitive Remote Pay",
        "appliedAt": datetime.now().isoformat(),
        "tailored_summary": groomed["tailored_summary"],
        "details": result.get("confirmation_message") or result.get("reason") or "Application processed.",
        "screening_qa": {"autofilled_by_rag": True}
    }

    # 3. Save to RAG Database
    rag_db.record_application(app_record)

    # 4. Log application to Google Sheets CSV sync
    sheets_agent.log_application({
        "id": app_id,
        "company": req.company,
        "role": req.role,
        "url": req.url,
        "source": req.source or "Autonomous Agent",
        "ats_platform": "Web Form",
        "location": "Global Remote",
        "remote_type": "Remote",
        "match_score": req.match_score or groomed["ats_score"],
        "resume_version": "Tailored (Keywords + Company Projects)",
        "cover_letter": True,
        "status": app_status,
        "salary_raw": req.salary_raw or "Competitive Remote Pay",
        "market_min": 850000,
        "market_median": 1300000,
        "market_max": 2000000,
        "expected_salary": 900000,
        "compensation_score": 94.0,
        "error_log": result.get("reason", "")
    })
    
    return {
        **result,
        "application_id": app_id,
        "status": app_status,
        "groomed_preview": {
            "ats_score": groomed["ats_score"],
            "injected_keywords": groomed["injected_jd_keywords"][:6],
            "company_projects": groomed["company_current_projects"],
            "tailored_summary": groomed["tailored_summary"]
        }
    }

# ================= APPLICATION TRACKER & STATUS FILTERS =================

@app.get("/api/ai/applications")
def get_applications(status: Optional[str] = None):
    """
    Returns applications stored in RAG memory.
    Supports filtering by: 'Applied', 'Review_Required', 'Needs_Info', or None for all.
    """
    apps = rag_db.get_applications(status_filter=status if status and status != "all" else None)
    return apps

@app.post("/api/ai/applications/resolve-review")
def resolve_review_application(req: ResolveReviewRequest):
    """User reviews and confirms an application paused for verification/CAPTCHA."""
    success = rag_db.update_application_status(
        req.id, 
        "Applied", 
        notes=f"Manually reviewed & confirmed by user. {req.user_notes}".strip()
    )
    if not success:
        raise HTTPException(status_code=404, detail="Application not found")
    return {"success": True, "id": req.id, "status": "Applied", "message": "Application review resolved and approved."}

@app.post("/api/ai/applications/submit-info")
def submit_additional_info(req: AdditionalInfoRequest):
    """User provides additional screening information or portfolio answers."""
    notes_str = f"Additional information provided: {json.dumps(req.additional_info)}"
    success = rag_db.update_application_status(req.id, "Applied", notes=notes_str)
    if not success:
        raise HTTPException(status_code=404, detail="Application not found")
    return {"success": True, "id": req.id, "status": "Applied", "message": "Additional information saved; application submitted!"}

# ================= 24/7 INSTANT AUTO-APPLY ENGINE =================

@app.get("/api/ai/auto-apply/status")
def get_auto_apply_status():
    return AUTO_APPLY_STATE

@app.post("/api/ai/auto-apply/toggle")
def toggle_auto_apply(enable: Optional[bool] = None):
    if enable is not None:
        AUTO_APPLY_STATE["enabled"] = enable
    else:
        AUTO_APPLY_STATE["enabled"] = not AUTO_APPLY_STATE["enabled"]
    state_str = "ENABLED (24/7 Autonomous)" if AUTO_APPLY_STATE["enabled"] else "PAUSED"
    AUTO_APPLY_STATE["message"] = f"Instant auto-apply monitor is now {state_str}."
    return AUTO_APPLY_STATE

async def _run_autonomous_batch_apply():
    """Background task to discover new 100% remote jobs and instantly auto-apply."""
    if not AUTO_APPLY_STATE["enabled"] or AUTO_APPLY_STATE["is_running"]:
        return
        
    AUTO_APPLY_STATE["is_running"] = True
    try:
        logger.info("Autonomous Instant Apply: Running discovery pass for top 100% remote jobs...")
        remote_jobs = await discovery_agent.discover_jobs()
        candidate = load_candidate_profile()
        
        # Get already applied URLs
        existing_apps = rag_db.get_applications()
        applied_urls = {a.get("url") for a in existing_apps if a.get("url")}
        
        applied_count = 0
        for job in remote_jobs:
            job_url = job.get("url")
            if not job_url or job_url in applied_urls:
                continue

            if is_blacklisted_employer(job.get("company", "")):
                logger.info(f"Safeguard: Skipped blacklisted employer {job.get('company')}")
                continue
                
            # Evaluate match score
            pj = job_parser_agent.parse_job(job)
            eval_res = semantic_matcher.evaluate(candidate, pj)
            score = eval_res.get("overall_match_score", 90.0)
            
            # Apply to jobs matching threshold (>= 85%)
            if score >= 85.0:
                logger.info(f"Auto-Applying via browser agent to: {pj['title']} at {pj['company']} (Match: {score}%)...")
                
                # Groom with company trick
                groomed = resume_optimizer.optimize_resume(candidate, pj["title"], pj)
                
                app_dict = {
                    "id": pj["id"],
                    "url": pj["url"],
                    "company": pj["company"],
                    "role": pj["title"],
                    "source": pj["source"],
                    "ats_platform": pj.get("ats_platform", "Auto"),
                    "match_score": score,
                    "tailored_resume_markdown": groomed["tailored_resume_markdown"],
                    "tailored_cv": groomed["tailored_cv"]
                }
                
                # Execute real submission attempt via Playwright
                submit_res = await browser_agent.submit_application(app_dict, candidate)
                app_status = submit_res.get("status", "Applied")
                
                app_id = f"auto_{os.urandom(4).hex()}"
                app_record = {
                    "id": app_id,
                    "company": pj["company"],
                    "role": pj["title"],
                    "url": pj["url"],
                    "source": pj["source"],
                    "status": app_status,
                    "matchScore": score,
                    "appliedAt": datetime.now().isoformat(),
                    "tailored_summary": groomed["tailored_summary"],
                    "notes": submit_res.get("confirmation_message") or submit_res.get("reason") or f"Autonomous Application (Match: {score}%)."
                }
                
                rag_db.record_application(app_record)
                sheets_agent.log_application({
                    "id": app_id,
                    "company": pj["company"],
                    "role": pj["title"],
                    "url": pj["url"],
                    "source": pj["source"],
                    "ats_platform": pj.get("ats_platform", "Auto"),
                    "location": "Global Remote",
                    "remote_type": "Remote",
                    "match_score": score,
                    "resume_version": "Autonomous Tailored (PDF)",
                    "cover_letter": True,
                    "status": app_status,
                    "salary_raw": pj.get("salary_raw", "Competitive"),
                    "market_min": 900000,
                    "market_median": 1400000,
                    "market_max": 2000000,
                    "expected_salary": 950000,
                    "compensation_score": 95.0,
                    "error_log": submit_res.get("reason", "")
                })
                
                applied_urls.add(job_url)
                applied_count += 1
                AUTO_APPLY_STATE["total_auto_applied"] += 1
                
                # Rate limit safety
                if applied_count >= 5:
                    break
                    
        AUTO_APPLY_STATE["last_run"] = datetime.now().isoformat()
        AUTO_APPLY_STATE["message"] = f"Successfully auto-applied to {applied_count} remote positions on latest cycle."
        logger.info(AUTO_APPLY_STATE["message"])
    except Exception as e:
        logger.error(f"Error during autonomous auto-apply run: {e}")
    finally:
        AUTO_APPLY_STATE["is_running"] = False

@app.post("/api/ai/auto-apply/run-now")
async def trigger_auto_apply_now(background_tasks: BackgroundTasks):
    """Triggers instant discovery & auto-apply cycle immediately."""
    background_tasks.add_task(_run_autonomous_batch_apply)
    return {
        "status": "triggered",
        "message": "Instant auto-apply cycle initiated. Scanning for latest 100% remote jobs...",
        "state": AUTO_APPLY_STATE
    }

@app.get("/api/ai/portals/login-urls")
def get_portal_login_urls():
    return {
        "login_urls": browser_agent.PORTAL_LOGIN_URLS,
        "persistent_session_dir": browser_agent.user_data_dir,
        "cookies_file": browser_agent.cookies_file
    }

@app.get("/api/ai/interview-prep")
def get_interview_prep(company: str = "SaaSify Technologies", role: str = "Full Stack Engineer"):
    return interview_prep.generate_prep_kit(company, role, ["React", "Node.js", "MongoDB", "Grok API"])

@app.get("/api/ai/skill-gap")
def get_skill_gap():
    candidate = load_candidate_profile()
    skills_list = candidate["skills"].get("frontend", []) + candidate["skills"].get("backend", [])
    real_jobs = []
    cache_path = os.path.join(os.path.dirname(__file__), "../data/live_scraped_jobs.json")
    if os.path.exists(cache_path):
        try:
            with open(cache_path, "r", encoding="utf-8") as f:
                cdata = json.load(f)
                if isinstance(cdata, dict) and "jobs" in cdata:
                    real_jobs = [{"tech_stack": j.get("techStack", [])} for j in cdata["jobs"] if j.get("techStack")]
        except Exception as e:
            logger.warning(f"Error reading live scraped jobs for skill gap: {e}")
    if not real_jobs:
        real_jobs = [
            {"tech_stack": ["React", "Next.js", "TypeScript", "Node.js", "Docker", "REST APIs", "PostgreSQL", "AI / LLMs"]},
            {"tech_stack": ["Vue.js", "Laravel", "MySQL", "Docker", "Redis", "Cloud & DevOps"]}
        ]
    return skill_gap_agent.analyze_skill_gaps(skills_list, real_jobs)
