# 🚀 JobPilot AI — Autonomous 24/7 Career & Job Application Platform

**JobPilot AI** is an open-source, self-hosted autonomous AI career platform designed to continuously monitor company career portals (Greenhouse, Lever, Ashby, Workday, SmartRecruiters, LinkedIn, Indeed), score semantic candidate-job match, tailor ATS resumes and cover letters, automate form submissions via Playwright (with Human-in-the-Loop CAPTCHA pause safeguards), calculate market salary benchmarks, track every application in Google Sheets / SQLite, and provide interview prep kits & skill gap roadmaps.

---

## 🌟 Core Features

- 📡 **Autonomous 24/7 Discovery & Parser**: Scans Greenhouse, Lever, Ashby, Workday, SmartRecruiters, and remote job feeds with adaptive scheduling.
- 🧬 **8-Dimension Semantic Match Engine**: Scores Overall Match, Skill Match, Project Match, Experience Match, Culture Match, Remote Match, Salary Match, and Growth Match.
- 📄 **ATS Optimizer & Tailor Studio**: Generates target-tailored resume variants (Fullstack, Frontend, Backend, AI Engineer) and custom cover letters.
- 💰 **Salary Intelligence & Negotiation Engine**: Benchmarks JD compensation against Levels.fyi, Glassdoor, and AmbitionBox. Identifies underpaid roles and generates interview salary negotiation strategies.
- 🛡️ **Playwright Browser Agent + Human-in-the-Loop**: Fills multi-step web forms and uploads resumes while gracefully pausing for manual review when CAPTCHAs or MFA are encountered.
- 🤝 **Recruiter CRM & Technical Interview Prep**: Manages recruiter touchpoints and generates custom company system design / coding prep kits.
- 🎯 **Skill Gap Analyzer & Free Learning Roadmap**: Identifies top missing skills across job descriptions and outputs free learning paths.
- 📊 **Glassmorphic Web Dashboard**: Modern UI showing real-time job radar, review queue, salary insights, and application statistics.

---

## 🛠️ Hybrid Technology Stack

- **Server Backend**: Node.js + Express.js (REST APIs, Static Dashboard hosting, Profile Management)
- **AI Microservices**: Python 3.12 + FastAPI (Embeddings, Vector Store, Matching, ATS Scorer, Salary Intel)
- **Browser Automation**: Playwright (Headless / Persistent Context)
- **Database & Storage**: SQLite / PostgreSQL (SQLAlchemy) + CSV / Google Sheets Sync
- **UI Styling**: Vanilla CSS3 (Glassmorphism, CSS Variables, Responsive Dark Mode)

---

## 🚀 Quickstart Guide

### 1. Installation

```bash
# Clone repository
git clone https://github.com/user/jobpilot-ai.git
cd jobpilot-ai

# Install Node.js dependencies
npm install

# Install Python dependencies
pip install -r requirements.txt

# Install Playwright browser drivers
playwright install chromium
```

### 2. Running Locally

```bash
# Start Node.js Express Backend & Web Dashboard (Port 3000)
npm start

# In a separate terminal, start Python AI Microservice Engine (Port 8000)
uvicorn backend.main:app --reload --port 8000
```

Access the Web Dashboard at: `http://localhost:3000`

---

## 💻 CLI Usage (`jobpilot_cli.py`)

JobPilot AI includes a full-featured CLI tool for command-line automation:

```bash
# Discover open positions across job boards
python scripts/jobpilot_cli.py discover

# Evaluate semantic match scores & salary benchmarks
python scripts/jobpilot_cli.py evaluate

# Execute autonomous application pipeline
python scripts/jobpilot_cli.py apply

# Run full end-to-end autonomous flow
python scripts/jobpilot_cli.py all
```

---

## 🧪 Running Unit Tests

```bash
pytest tests/
```

---

## 🐳 Docker Deployment

```bash
docker-compose up --build -d
```

---

## 📜 License

MIT License. Open-source & free to self-host forever.
