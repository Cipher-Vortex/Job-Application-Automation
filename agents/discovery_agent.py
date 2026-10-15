import asyncio
import urllib.request
import json
import uuid
import re
import html
from typing import List, Dict, Any
from config.logger import logger

class JobDiscoveryAgent:
    """
    Autonomous Discovery Engine scanning:
    - Freelancer.com Live Active Projects API
    - RemoteOK Freelance & Contract Stream
    - Arbeitnow Tech & Freelance Jobs API
    - Greenhouse Public ATS Endpoints (Stripe, GitLab, Cloudflare, Vercel, Canonical)
    - Lever Public ATS Endpoints (Figma, Postman)
    """
    def __init__(self):
        # Curated list of high-growth, remote-first & innovative engineering hubs (underrated & top-tier)
        self.greenhouse_companies = [
            "10up", "modash", "posthog", "mattermost", "calcom", "supabase", "sourcegraph",
            "canonical", "vercel", "stripe", "gitlab", "cloudflare", "elastic"
        ]
        self.lever_companies = ["postman", "duckduckgo", "automattic", "clevertech", "metabase", "ghost"]
        self.ashby_companies = ["zapier", "buffer", "resend", "modal", "replit", "sentry", "vanta"]

    def _clean_text(self, text: str) -> str:
        if not text:
            return ""
        text = html.unescape(text)
        text = re.sub(r'<[^>]+>', ' ', text)
        text = re.sub(r'[^\x00-\x7F]+', ' ', text)
        return re.sub(r'\s+', ' ', text).strip()

    def _categorize_role(self, title: str, description: str = "") -> str:
        """Categorize job into specific technical role domain for intelligent multi-role matching."""
        text = f"{title} {description}".lower()
        if any(k in text for k in ["ai ", "ai/", "artificial intelligence", "rag", "llm", "machine learning", "nlp", "grok", "deep learning", "langchain", "prompt"]):
            return "AI / LLM"
        if any(k in text for k in ["frontend", "front-end", "react", "vue", "next.js", "nextjs", "angular", "ui/ux", "ui developer", "web designer"]):
            return "Frontend"
        if any(k in text for k in ["backend", "back-end", "node", "express", "api engineer", "fastapi", "django", "laravel", "golang", "java ", "microservice"]):
            return "Backend"
        if any(k in text for k in ["product engineer", "product developer", "growth engineer", "founding engineer"]):
            return "Product"
        if any(k in text for k in ["devops", "cloud", "sre", "site reliability", "infrastructure", "platform engineer", "kubernetes", "aws", "docker"]):
            return "Cloud & DevOps"
        if any(k in text for k in ["erp", "sap", "crm", "netsuite", "odoo", "enterprise solutions"]):
            return "ERP & Enterprise"
        return "Full Stack"

    def _fetch_url(self, url: str) -> Any:
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
            with urllib.request.urlopen(req, timeout=10) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except Exception as e:
            logger.warning(f"Could not fetch live data from {url}: {e}")
            return None

    def fetch_freelancer_com_projects(self) -> List[Dict[str, Any]]:
        logger.info("Fetching real active freelance & contract projects (<30 days old) from Freelancer.com API across multiple roles...")
        import time
        cutoff = time.time() - (30 * 86400) # 30 days ago
        queries = [
            "react%20node%20fullstack", "vue%20laravel%20erp", "fullstack%20developer", 
            "ai%20rag%20web", "frontend%20engineer", "backend%20developer", 
            "product%20engineer", "cloud%20devops", "web%20application"
        ]
        seen_ids = set()
        parsed_projects = []

        for q in queries:
            url = f"https://www.freelancer.com/api/projects/0.1/projects/active/?query={q}&limit=25"
            data = self._fetch_url(url)
            if not data or not isinstance(data, dict):
                continue
            
            projects = data.get("result", {}).get("projects", [])
            for p in projects:
                p_id = p.get("id")
                if not p_id or p_id in seen_ids:
                    continue
                seen_ids.add(p_id)

                submitted = p.get("time_submitted")
                if submitted and isinstance(submitted, (int, float)) and submitted < cutoff:
                    continue

                title = self._clean_text(p.get("title", ""))
                if not title:
                    continue
                
                budget = p.get("budget", {})
                min_b = budget.get("minimum", 100)
                max_b = budget.get("maximum", 1500)
                
                sal_str = f"${min_b} - ${max_b} USD (Fixed Project Contract)" if min_b and max_b else "$50 - $90 / hr (Freelance)"
                seo_url = p.get("seo_url")
                link = f"https://www.freelancer.com/projects/{seo_url}" if seo_url else f"https://www.freelancer.com/projects/{p_id}"
                
                desc = self._clean_text(p.get("preview_description", p.get("description", "")))
                haystack = f"{title} {desc}".lower()
                tech_stack = ["Full Stack", "Web Development"]
                if "react" in haystack: tech_stack.append("React")
                if "node" in haystack: tech_stack.append("Node.js")
                if "vue" in haystack: tech_stack.append("Vue.js")
                if "laravel" in haystack: tech_stack.append("Laravel")
                if "erp" in haystack: tech_stack.append("ERP Systems")
                if "ai" in haystack or "rag" in haystack: tech_stack.append("AI / RAG")
                if "mysql" in haystack: tech_stack.append("MySQL")
                if "mongo" in haystack: tech_stack.append("MongoDB")

                role_cat = self._categorize_role(title, desc)

                parsed_projects.append({
                    "id": f"fl_{p_id}",
                    "title": title,
                    "role_category": role_cat,
                    "company": "Client Project (Freelancer.com)",
                    "department": f"{role_cat} Gig",
                    "location": "Global Remote",
                    "remote_type": "Remote",
                    "job_type": "Freelance / Contract",
                    "url": link,
                    "source": "Freelancer.com",
                    "ats_platform": "Freelancer API",
                    "salary_raw": sal_str,
                    "salary_min": min_b * 83 if min_b else 800000,
                    "salary_max": max_b * 83 if max_b else 1500000,
                    "experience_required": "All Levels",
                    "tech_stack": tech_stack,
                    "description": desc
                })
        return parsed_projects

    def fetch_remoteok_jobs(self) -> List[Dict[str, Any]]:
        logger.info("Fetching live jobs & freelance contracts (<30 days old) from RemoteOK API across roles...")
        data = self._fetch_url("https://remoteok.com/api")
        if not data or not isinstance(data, list):
            return []
        
        from datetime import datetime, timezone, timedelta
        cutoff_dt = datetime.now(timezone.utc) - timedelta(days=30)
        parsed_jobs = []
        for item in data[1:35]:
            if not isinstance(item, dict) or not item.get("position"):
                continue
            
            date_str = item.get("date")
            if date_str:
                try:
                    dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
                    if dt < cutoff_dt:
                        continue
                except Exception:
                    pass

            position = self._clean_text(item.get("position", ""))
            company = self._clean_text(item.get("company", "Tech Company"))
            tags = [self._clean_text(t) for t in item.get("tags", [])]
            location = self._clean_text(item.get("location") or "Remote")
            url = item.get("url") or f"https://remoteok.com/remote-jobs/{item.get('id')}"
            salary_min = item.get("salary_min")
            salary_max = item.get("salary_max")
            
            desc_raw = item.get("description", "")
            desc_lower = desc_raw.lower()
            tags_lower = [t.lower() for t in tags]
            
            is_contract = any(k in tags_lower or k in desc_lower for k in ["contract", "freelance", "hourly", "gig", "consultant", "project"])
            job_type = "Freelance / Contract" if is_contract else "Full-Time"
            
            if is_contract and salary_min and salary_max:
                hourly_min = round(salary_min / 2000, 1)
                hourly_max = round(salary_max / 2000, 1)
                sal_str = f"${hourly_min} - ${hourly_max} / hr (Freelance Contract)"
            elif salary_min and salary_max:
                sal_str = f"${salary_min:,.0f} - ${salary_max:,.0f} USD"
            else:
                sal_str = "$45 - $90 / hr (Project Contract)" if is_contract else "Competitive Market Rate"
            
            role_cat = self._categorize_role(position, f"{' '.join(tags)} {desc_raw[:300]}")

            parsed_jobs.append({
                "id": f"rok_{item.get('id', uuid.uuid4().hex[:6])}",
                "title": position,
                "role_category": role_cat,
                "company": company,
                "department": f"{role_cat} Engineering",
                "location": location if location else "Remote",
                "remote_type": "Remote",
                "job_type": job_type,
                "url": url,
                "source": "RemoteOK",
                "ats_platform": "RemoteOK API",
                "salary_raw": sal_str,
                "salary_min": salary_min * 83 if salary_min else (750000 if is_contract else 900000),
                "salary_max": salary_max * 83 if salary_max else (1400000 if is_contract else 1600000),
                "experience_required": "1+ Years",
                "tech_stack": [t.title() for t in tags[:6]] if tags else ["React", "Node.js", "Full Stack"],
                "description": self._clean_text(desc_raw)[:400]
            })
        return parsed_jobs

    def fetch_arbeitnow_jobs(self) -> List[Dict[str, Any]]:
        logger.info("Fetching live tech jobs (<30 days old) from Arbeitnow API...")
        data = self._fetch_url("https://www.arbeitnow.com/api/job-board-api")
        if not data or not isinstance(data, dict):
            return []
        
        import time
        cutoff = time.time() - (30 * 86400)
        raw_items = data.get("data", [])
        parsed_jobs = []
        for item in raw_items[:120]:
            created_at = item.get("created_at")
            if created_at and isinstance(created_at, (int, float)) and created_at < cutoff:
                continue

            title = self._clean_text(item.get("title", ""))
            company = self._clean_text(item.get("company_name", "Software Inc"))
            tags = item.get("tags", [])
            location = self._clean_text(item.get("location", "Remote / Hybrid"))
            url = item.get("url", "")
            remote = "Remote" if item.get("remote") else "Hybrid"
            
            is_contract = any(k in title.lower() for k in ["freelance", "contract", "interim", "consultant"])
            job_type = "Freelance / Contract" if is_contract else "Full-Time"
            role_cat = self._categorize_role(title, item.get("description", ""))
            
            parsed_jobs.append({
                "id": f"an_{uuid.uuid4().hex[:6]}",
                "title": title,
                "role_category": role_cat,
                "company": company,
                "department": f"{role_cat} Engineering",
                "location": location,
                "remote_type": remote,
                "job_type": job_type,
                "url": url,
                "source": "Arbeitnow",
                "ats_platform": "Direct Portal",
                "salary_raw": "Competitive Contract / Full-Time Pay",
                "salary_min": 850000,
                "salary_max": 1500000,
                "experience_required": "1+ Years",
                "tech_stack": [self._clean_text(t).title() for t in tags[:6]] if tags else ["Software Development", "Web"],
                "description": self._clean_text(item.get("description", ""))[:400]
            })
        return parsed_jobs

    def fetch_greenhouse_jobs(self) -> List[Dict[str, Any]]:
        parsed_jobs = []
        for comp in self.greenhouse_companies:
            logger.info(f"Scanning live Greenhouse career board for {comp} across technical roles...")
            url = f"https://boards-api.greenhouse.io/v1/boards/{comp}/jobs?content=true"
            data = self._fetch_url(url)
            if not data or not isinstance(data, dict):
                continue
            
            jobs = data.get("jobs", [])
            for j in jobs:
                title = self._clean_text(j.get("title", ""))
                # Broaden to all software, web, AI, cloud, frontend, backend, and product roles
                if any(k in title.lower() for k in [
                    "engineer", "developer", "software", "full stack", "fullstack", "frontend", "backend",
                    "ai", "machine learning", "product", "cloud", "devops", "platform", "solutions",
                    "architect", "web", "data", "technical", "consultant", "erp", "ui", "ux", "systems"
                ]):
                    loc = self._clean_text(j.get("location", {}).get("name", "Remote"))
                    is_contract = "contract" in title.lower()
                    role_cat = self._categorize_role(title, f"{title} {loc}")
                    parsed_jobs.append({
                        "id": f"gh_{j.get('id')}",
                        "title": title,
                        "role_category": role_cat,
                        "company": comp.title(),
                        "department": f"{role_cat} Engineering",
                        "location": loc,
                        "remote_type": "Remote" if "remote" in loc.lower() else "Hybrid",
                        "job_type": "Freelance / Contract" if is_contract else "Full-Time",
                        "url": j.get("absolute_url"),
                        "source": "Greenhouse",
                        "ats_platform": "Greenhouse ATS",
                        "salary_raw": "Market Leading Compensation + Equity",
                        "salary_min": 1200000,
                        "salary_max": 2200000,
                        "experience_required": "1-3 Years",
                        "tech_stack": ["React", "TypeScript", "Node.js", "REST APIs", "Cloud Infrastructure"],
                        "description": f"Live position at {comp.title()}: {title} in {loc}."
                    })
        return parsed_jobs

    def fetch_lever_jobs(self) -> List[Dict[str, Any]]:
        parsed_jobs = []
        for comp in self.lever_companies:
            logger.info(f"Scanning live Lever career board for {comp} across technical roles...")
            url = f"https://api.lever.co/v0/postings/{comp}?mode=json"
            data = self._fetch_url(url)
            if not data or not isinstance(data, list):
                continue
            
            for j in data:
                title = self._clean_text(j.get("text", ""))
                categories = j.get("categories", {})
                loc = self._clean_text(categories.get("location", "Remote"))
                team = self._clean_text(categories.get("team", "Engineering"))
                
                if any(k in title.lower() or k in team.lower() for k in [
                    "engineer", "developer", "software", "full stack", "fullstack", "frontend", "backend",
                    "ai", "machine learning", "product", "cloud", "devops", "platform", "solutions",
                    "architect", "web", "data", "technical", "consultant", "erp", "ui", "ux", "systems"
                ]):
                    is_contract = "contract" in title.lower()
                    role_cat = self._categorize_role(title, f"{title} {team}")
                    parsed_jobs.append({
                        "id": f"lev_{j.get('id', uuid.uuid4().hex[:6])}",
                        "title": title,
                        "role_category": role_cat,
                        "company": comp.title(),
                        "department": team or f"{role_cat} Engineering",
                        "location": loc,
                        "remote_type": "Remote" if "remote" in loc.lower() or "remote" in j.get("workplaceType", "").lower() else "Hybrid",
                        "job_type": "Freelance / Contract" if is_contract else "Full-Time",
                        "url": j.get("hostedUrl"),
                        "source": "Lever",
                        "ats_platform": "Lever ATS",
                        "salary_raw": "Market Leading Compensation + Benefits",
                        "salary_min": 1300000,
                        "salary_max": 2500000,
                        "experience_required": "1-3 Years",
                        "tech_stack": ["React", "TypeScript", "Node.js", "Python", "Cloud"],
                        "description": f"Live position at {comp.title()}: {title} in {loc}."
                    })
        return parsed_jobs

    def fetch_linkedin_jobs(self) -> List[Dict[str, Any]]:
        logger.info("Scanning live LinkedIn Jobs stream across Software, AI, Frontend, Backend & Product positions...")
        try:
            import requests
            from bs4 import BeautifulSoup
            queries = [
                "software%20developer", "full%20stack%20developer", 
                "frontend%20engineer", "backend%20developer", 
                "ai%20engineer", "product%20engineer"
            ]
            headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
            parsed_jobs = []
            seen_links = set()

            for q in queries:
                url = f"https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords={q}&location=India"
                try:
                    resp = requests.get(url, headers=headers, timeout=8)
                    if resp.status_code != 200:
                        continue
                    soup = BeautifulSoup(resp.text, "html.parser")
                    cards = soup.find_all("li")
                    for c in cards[:6]:
                        title_elem = c.find("h3", class_="base-search-card__title")
                        comp_elem = c.find("h4", class_="base-search-card__subtitle")
                        loc_elem = c.find("span", class_="job-search-card__location")
                        link_elem = c.find("a", class_="base-card__full-link")
                        if not title_elem or not link_elem:
                            continue
                        job_url = link_elem.get("href", "").split("?")[0]
                        if job_url in seen_links:
                            continue
                        seen_links.add(job_url)

                        title = self._clean_text(title_elem.text)
                        company = self._clean_text(comp_elem.text if comp_elem else "LinkedIn Enterprise")
                        location = self._clean_text(loc_elem.text if loc_elem else "India")
                        role_cat = self._categorize_role(title, f"{title} {q}")

                        parsed_jobs.append({
                            "id": f"li_{uuid.uuid4().hex[:6]}",
                            "title": title,
                            "role_category": role_cat,
                            "company": company,
                            "department": f"{role_cat} Engineering",
                            "location": location,
                            "remote_type": "Remote" if "remote" in location.lower() else "Hybrid",
                            "job_type": "Full-Time",
                            "url": job_url,
                            "source": "LinkedIn",
                            "ats_platform": "LinkedIn Easy Apply",
                            "salary_raw": "₹12,00,000 - ₹20,00,000 INR",
                            "salary_min": 1200000,
                            "salary_max": 2000000,
                            "experience_required": "1-3 Years",
                            "tech_stack": ["React", "Node.js", "TypeScript", "REST APIs", "SQL"],
                            "description": f"Live LinkedIn listing for {title} at {company} in {location}."
                        })
                except Exception:
                    continue

            logger.info(f"Successfully scraped {len(parsed_jobs)} real live LinkedIn postings across multiple roles.")
            return parsed_jobs
        except Exception as e:
            logger.warning(f"Error fetching live LinkedIn jobs: {e}")
            return []

    def fetch_indeed_jobs(self) -> List[Dict[str, Any]]:
        logger.info("Scanning live Indeed Jobs stream across technical roles...")
        try:
            import requests
            from bs4 import BeautifulSoup
            queries = ["software+developer", "full+stack+developer", "frontend+engineer", "backend+developer", "ai+engineer"]
            headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
            parsed_jobs = []
            seen_links = set()

            for q in queries:
                url = f"https://www.indeed.com/rss?q={q}&l=India"
                try:
                    resp = requests.get(url, headers=headers, timeout=8)
                    if resp.status_code != 200:
                        continue
                    soup = BeautifulSoup(resp.text, "html.parser")
                    items = soup.find_all("item")
                    for item in items[:4]:
                        title = self._clean_text(item.find("title").text if item.find("title") else "")
                        link = item.find("link").text if item.find("link") else ""
                        desc = self._clean_text(item.find("description").text if item.find("description") else "")
                        if not title or not link or link in seen_links:
                            continue
                        seen_links.add(link)
                        role_cat = self._categorize_role(title, desc)

                        parsed_jobs.append({
                            "id": f"ind_{uuid.uuid4().hex[:6]}",
                            "title": title,
                            "role_category": role_cat,
                            "company": "Tech Company (Indeed)",
                            "department": f"{role_cat} Engineering",
                            "location": "India / Remote",
                            "remote_type": "Remote",
                            "job_type": "Full-Time",
                            "url": link,
                            "source": "Indeed",
                            "ats_platform": "Indeed Apply",
                            "salary_raw": "₹10,00,000 - ₹16,00,000 INR",
                            "salary_min": 1000000,
                            "salary_max": 1600000,
                            "experience_required": "1+ Years",
                            "tech_stack": ["Node.js", "Express.js", "MongoDB", "React", "REST APIs"],
                            "description": desc if desc else f"Live Indeed {role_cat} job listing."
                        })
                except Exception:
                    continue

            logger.info(f"Successfully scraped {len(parsed_jobs)} real live Indeed postings across roles.")
            return parsed_jobs
        except Exception as e:
            logger.warning(f"Error fetching live Indeed jobs: {e}")
            return []

    def fetch_internshala_jobs(self) -> List[Dict[str, Any]]:
        logger.info("Scanning live Internshala stream for Developer Jobs & High-Paid Internships...")
        try:
            import requests
            from bs4 import BeautifulSoup
            url = "https://internshala.com/jobs/full-stack-development-jobs/"
            headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
            resp = requests.get(url, headers=headers, timeout=10)
            if resp.status_code != 200:
                return []
            
            soup = BeautifulSoup(resp.text, "html.parser")
            cards = soup.find_all("div", class_="individual_internship")
            parsed_jobs = []
            for c in cards:
                title_elem = c.find("h3", class_="job-internship-name") or c.find("div", class_="heading_4_5")
                comp_elem = c.find("p", class_="company-name") or c.find("div", class_="heading_6_company_name")
                loc_elem = c.find("a", class_="location_link") or c.find("span", class_="location")
                
                if not title_elem:
                    continue
                
                title = self._clean_text(title_elem.text)
                company = self._clean_text(comp_elem.text if comp_elem else "Tech Startup")
                location = self._clean_text(loc_elem.text if loc_elem else "Remote / India")
                link = "https://internshala.com" + c.get("data-href", "/jobs")
                role_cat = self._categorize_role(title)
                
                parsed_jobs.append({
                    "id": f"is_{uuid.uuid4().hex[:6]}",
                    "title": title,
                    "role_category": role_cat,
                    "company": company,
                    "department": f"{role_cat} Engineering",
                    "location": location,
                    "remote_type": "Remote" if "work from home" in location.lower() or "remote" in location.lower() else "Hybrid",
                    "job_type": "Full-Time / Paid Internship",
                    "url": link,
                    "source": "Internshala",
                    "ats_platform": "Internshala Quick Apply",
                    "salary_raw": "₹8,00,000 - ₹12,00,000 INR",
                    "salary_min": 800000,
                    "salary_max": 1200000,
                    "experience_required": "0-2 Years",
                    "tech_stack": ["React", "Node.js", "JavaScript", "Express", "MongoDB"],
                    "description": f"Live Internshala opportunity for {title} at {company}."
                })
            logger.info(f"Successfully scraped {len(parsed_jobs)} real live Internshala postings.")
            return parsed_jobs
        except Exception as e:
            logger.warning(f"Error fetching live Internshala jobs: {e}")
            return []

    def fetch_unstop_jobs(self) -> List[Dict[str, Any]]:
        logger.info("Scanning live Unstop stream for Engineering Jobs & Hiring Challenges...")
        try:
            url = "https://unstop.com/api/public/opportunity/search-result?opportunity=jobs&searchTerm=developer"
            data = self._fetch_url(url)
            if not data or not isinstance(data, dict):
                return []
            
            raw_data = data.get("data", {}).get("data", [])
            parsed_jobs = []
            for item in raw_data:
                title = self._clean_text(item.get("title", ""))
                comp_name = self._clean_text(item.get("organisation", {}).get("name", "Unstop Partner"))
                seo_url = item.get("seo_url") or item.get("id")
                link = f"https://unstop.com/jobs/{seo_url}" if seo_url else "https://unstop.com/jobs"
                
                job_detail = item.get("job_detail", {})
                sal_min = job_detail.get("min_salary") or 900000
                sal_max = job_detail.get("max_salary") or 1800000
                role_cat = self._categorize_role(title, item.get("description", ""))
                
                parsed_jobs.append({
                    "id": f"un_{item.get('id', uuid.uuid4().hex[:6])}",
                    "title": title,
                    "role_category": role_cat,
                    "company": comp_name,
                    "department": f"{role_cat} Engineering",
                    "location": "India / Remote",
                    "remote_type": "Hybrid",
                    "job_type": "Full-Time",
                    "url": link,
                    "source": "Unstop",
                    "ats_platform": "Unstop Direct",
                    "salary_raw": f"₹{sal_min:,.0f} - ₹{sal_max:,.0f} INR" if sal_min and sal_max else "₹12,00,000 - ₹20,00,000 INR",
                    "salary_min": sal_min if isinstance(sal_min, (int, float)) else 900000,
                    "salary_max": sal_max if isinstance(sal_max, (int, float)) else 1800000,
                    "experience_required": "0-2 Years",
                    "tech_stack": ["React", "Node.js", "Java", "SQL", "Full Stack"],
                    "description": self._clean_text(item.get("description", "")) or f"Live Unstop posting: {title}."
                })
            logger.info(f"Successfully scraped {len(parsed_jobs)} real live Unstop postings.")
            return parsed_jobs
        except Exception as e:
            logger.warning(f"Error fetching live Unstop jobs: {e}")
            return []

    def fetch_naukri_jobs(self) -> List[Dict[str, Any]]:
        logger.info("Scanning live Naukri stream across Frontend, Backend, AI, ERP, and Full Stack...")
        try:
            import requests
            from bs4 import BeautifulSoup
            parsed_jobs = []
            queries = [
                "full-stack-developer", "vue-js-developer", "laravel-developer", 
                "react-developer", "ai-engineer", "frontend-engineer", "backend-developer"
            ]
            for q in queries:
                url = f"https://www.naukri.com/{q}-jobs-in-bengaluru-chennai?k={q}&l=bengaluru%2C%20chennai%2C%20remote"
                headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
                try:
                    resp = requests.get(url, headers=headers, timeout=6)
                    if resp.status_code == 200:
                        soup = BeautifulSoup(resp.text, "html.parser")
                        title_elems = soup.find_all("a", class_="title")
                        for t in title_elems[:3]:
                            t_text = self._clean_text(t.text)
                            job_link = t.get("href", "")
                            if t_text and job_link:
                                role_cat = self._categorize_role(t_text)
                                parsed_jobs.append({
                                    "id": f"nk_{uuid.uuid4().hex[:6]}",
                                    "title": t_text,
                                    "role_category": role_cat,
                                    "company": "Naukri Partner Company",
                                    "department": f"{role_cat} Engineering",
                                    "location": "Bengaluru / Chennai / Remote",
                                    "remote_type": "Remote" if "remote" in t_text.lower() else "Hybrid",
                                    "job_type": "Full-Time",
                                    "url": job_link if job_link.startswith("http") else f"https://www.naukri.com{job_link}",
                                    "source": "Naukri",
                                    "ats_platform": "Naukri 1-Click Apply",
                                    "salary_raw": "₹8,00,000 - ₹16,00,000 INR",
                                    "salary_min": 800000,
                                    "salary_max": 1600000,
                                    "experience_required": "0-2 Years",
                                    "tech_stack": ["React", "Vue.js", "Laravel", "MySQL", "Node.js", "Full Stack"],
                                    "description": f"Live Naukri job listing for {t_text}."
                                })
                except Exception:
                    continue
            logger.info(f"Successfully scraped {len(parsed_jobs)} live Naukri postings across roles.")
            return parsed_jobs
        except Exception as e:
            logger.warning(f"Error fetching live Naukri jobs: {e}")
            return []

    def fetch_ashby_jobs(self) -> List[Dict[str, Any]]:
        parsed_jobs = []
        for comp in self.ashby_companies:
            logger.info(f"Scanning live Ashby career board for {comp}...")
            url = f"https://api.ashbyhq.com/posting-api/job-board/{comp}"
            data = self._fetch_url(url)
            if not data or not isinstance(data, dict):
                continue
            
            jobs = data.get("jobs", data.get("jobPostings", []))
            for j in jobs:
                title = self._clean_text(j.get("title", ""))
                loc = self._clean_text(j.get("locationName", "Remote"))
                is_contract = "contract" in title.lower()
                role_cat = self._categorize_role(title)
                parsed_jobs.append({
                    "id": f"ash_{j.get('id', uuid.uuid4().hex[:6])}",
                    "title": title,
                    "role_category": role_cat,
                    "company": comp.title(),
                    "department": self._clean_text(j.get("departmentName", f"{role_cat} Engineering")),
                    "location": loc,
                    "remote_type": "Remote" if "remote" in loc.lower() or j.get("isRemote") else "Hybrid",
                    "job_type": "Freelance / Contract" if is_contract else "Full-Time",
                    "url": j.get("jobUrl") or f"https://jobs.ashbyhq.com/{comp}/{j.get('id')}",
                    "source": "Ashby",
                    "ats_platform": "Ashby ATS",
                    "salary_raw": "Global Competitive Salary + Remote Benefits",
                    "salary_min": 1500000,
                    "salary_max": 3000000,
                    "experience_required": "1-3 Years",
                    "tech_stack": ["React", "TypeScript", "Node.js", "Python", "Cloud"],
                    "description": f"Live position at {comp.title()}: {title} in {loc}."
                })
        return parsed_jobs

    async def discover_jobs(self, keywords: List[str] = None) -> List[Dict[str, Any]]:
        logger.info("Discovery Agent scanning live web job & multi-portal streams...")
        loop = asyncio.get_event_loop()
        
        fl_task = loop.run_in_executor(None, self.fetch_freelancer_com_projects)
        rok_task = loop.run_in_executor(None, self.fetch_remoteok_jobs)
        an_task = loop.run_in_executor(None, self.fetch_arbeitnow_jobs)
        gh_task = loop.run_in_executor(None, self.fetch_greenhouse_jobs)
        lev_task = loop.run_in_executor(None, self.fetch_lever_jobs)
        ash_task = loop.run_in_executor(None, self.fetch_ashby_jobs)
        li_task = loop.run_in_executor(None, self.fetch_linkedin_jobs)
        ind_task = loop.run_in_executor(None, self.fetch_indeed_jobs)
        ish_task = loop.run_in_executor(None, self.fetch_internshala_jobs)
        uns_task = loop.run_in_executor(None, self.fetch_unstop_jobs)
        nk_task = loop.run_in_executor(None, self.fetch_naukri_jobs)
        
        results = await asyncio.gather(
            fl_task, rok_task, an_task, gh_task, lev_task, ash_task, li_task, ind_task, ish_task, uns_task, nk_task,
            return_exceptions=True
        )
        
        all_jobs = []
        for r in results:
            if isinstance(r, list):
                all_jobs.extend(r)
        
        def is_strictly_remote(job):
            rtype = (job.get("remote_type") or "").lower()
            loc = (job.get("location") or "").lower()
            title = (job.get("title") or "").lower()
            desc = (job.get("description") or "").lower()
            
            # Exclude explicit onsite/relocation requirements
            if "relocation required" in desc or "strictly onsite" in desc or "hybrid only" in loc or "hybrid" in rtype:
                return False
                
            return (
                "remote" in rtype or 
                "remote" in loc or 
                "anywhere" in loc or 
                "worldwide" in loc or 
                "global" in loc or 
                "work from home" in loc or
                "remote" in title
            )
            
        BLACKLISTED_EMPLOYERS = [
            "onemodo", "onemodo technologies", "onemodo technologies services", "onemodo technologies services pvt ltd"
        ]

        def is_blacklisted_employer(job):
            comp = (job.get("company") or "").lower()
            return any(b in comp for b in BLACKLISTED_EMPLOYERS)

        remote_only_jobs = []
        for job in all_jobs:
            if is_blacklisted_employer(job):
                logger.info(f"Safeguard: Excluded blacklisted current employer job posting from {job.get('company')}")
                continue
            if is_strictly_remote(job):
                job["remote_type"] = "Remote"
                job["is_100_remote"] = True
                remote_only_jobs.append(job)
                
        logger.info(f"Discovered {len(remote_only_jobs)} strictly 100% remote live full-time and freelance project postings across 10 job portals & ATS engines.")
        return remote_only_jobs

    async def discover_all_jobs(self, remote_only: bool = True) -> List[Dict[str, Any]]:
        return await self.discover_jobs()

discovery_agent = JobDiscoveryAgent()

