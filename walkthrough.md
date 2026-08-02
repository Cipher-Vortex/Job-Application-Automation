# JobPilot AI — Autonomous 24/7 Career Platform Walkthrough

## Summary of Accomplishments

We have designed, engineered, and verified **JobPilot AI** — a production-ready, autonomous open-source 24/7 AI job search, application, and career intelligence platform. 

The application features a **hybrid architecture** combining **Node.js (Express.js)** for high-concurrency API server routing, candidate profile management, and dashboard hosting, alongside **Python 3.12 (FastAPI)** for AI microservices, semantic vector matching, ATS optimization, and Playwright browser automation.

---

## Key Modules Implemented

1. **User Profile Engine (`data/user_profile/`)**:
   - Seeded directly from `Kiran S R _ Full Stack Engineer.pdf`.
   - Structured JSON database: `profile.json`, `experience.json`, `education.json`, `skills.json`, `projects.json`, `resume_master.json`, `portfolio.json`, `linkedin.json`, `github.json`.

2. **Autonomous Multi-Source Discovery Agent (`agents/discovery_agent.py`)**:
   - Continuous scanning across Greenhouse, Lever, Ashby, Workday, SmartRecruiters, LinkedIn, RemoteOK, and RSS feeds with adaptive peak/off-peak frequency.

3. **8-Dimension Semantic Matching Engine (`agents/semantic_matching_agent.py`)**:
   - Evaluates Overall Match, Skill Match, Project Match, Experience Match, Culture Match, Remote Match, Salary Match, and Growth Match scores with transparent justifications.

4. **ATS Optimizer & Resume/Cover Letter Studio (`agents/resume_optimization_agent.py`, `agents/cover_letter_agent.py`)**:
   - Generates target-tailored resume variants (Fullstack, Frontend, Backend, AI Engineer) and custom cover letters based on candidate achievements.

5. **Salary Intelligence & Negotiation Engine (`agents/salary_intelligence_agent.py`)**:
   - Extracts exact JD compensation bounds, benchmarks against Levels.fyi, Glassdoor, and AmbitionBox market data, flags underpaid positions, and generates interview salary negotiation strategies.

6. **Playwright Browser Agent + Human-in-the-Loop Safeguards (`agents/browser_automation_agent.py`)**:
   - Automates form completion and PDF resume attachments.
   - Detects CAPTCHAs or non-automatable workflows and gracefully pauses applications to notify the candidate via the Human-in-the-Loop review queue.

7. **Recruiter CRM, Interview Prep, Skill Gap & Offer Comparison (`agents/recruiter_crm_agent.py`, `agents/interview_prep_agent.py`, `agents/skill_gap_agent.py`, `agents/offer_comparison_agent.py`)**:
   - Manages recruiter contacts, generates company technical interview prep kits, creates free learning roadmaps for missing skills, and compares multi-offer compensation.

8. **Google Sheets Sync & Tracker (`agents/sheets_agent.py`)**:
   - Logs 35+ metadata columns per application to Google Sheets & CSV backup.

9. **Interactive Glassmorphic Web Dashboard (`frontend/`)**:
   - Modern dark-mode UI with tabs for Radar Feed, Review Queue, ATS Studio, Salary Intelligence, Recruiter CRM, and Skill Gap Analysis.

---

## Verification Results

- **Unit Test Suite**: 6/6 tests passing (`tests/test_agents.py`) verifying Job Parser, Semantic Matcher, Salary Intelligence, Resume Optimizer, Cover Letter Generator, and Offer Comparator.
- **CLI Utility**: Executed `python scripts/jobpilot_cli.py evaluate` successfully.

---

## Quickstart Commands

```bash
# 1. Start Node.js Express API & Web Dashboard (Port 3000)
npm start

# 2. Start Python FastAPI AI Microservice Engine (Port 8000)
uvicorn backend.main:app --reload --port 8000

# 3. Access Web UI in browser
http://localhost:3000

# 4. CLI Execution
python scripts/jobpilot_cli.py evaluate
```
